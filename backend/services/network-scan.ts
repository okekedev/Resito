// ===== services/network-scan.ts =====
import fetch, { Response as NodeFetchResponse } from 'node-fetch';

export interface DiscoveredRouter {
  ipAddress: string;
  isAccessible: boolean;
  responseTime?: number;
  detectedBrand?: string;
  authRequired?: boolean;
  supportedProtocols?: string[];
}

export interface NetworkScanOptions {
  timeout?: number;
  retries?: number;
  includeExtended?: boolean;
}

export interface BulkScanResult {
  total: number;
  accessible: DiscoveredRouter[];
  failed: string[];
  duration: number;
}

export class NetworkScanService {
  // Common router IP addresses ordered by popularity
  private static readonly COMMON_ROUTER_IPS = [
    '192.168.1.1',    // Most common (Linksys, Netgear, D-Link)
    '192.168.0.1',    // D-Link, Netgear, some ISPs  
    '10.0.0.1',       // Apple AirPort, some ISPs
    '192.168.2.1',    // Some Linksys models
    '192.168.1.254',  // Some routers use .254
    '192.168.0.254',  // Alternative gateway
    '192.168.10.1',   // Some ISPs (Xfinity, etc.)
    '192.168.100.1',  // Some ISPs
    '172.16.1.1',     // Some enterprise/business
    '192.168.3.1',    // Less common alternative
    '192.168.11.1',   // Some specific models
    '10.0.1.1',       // Apple variations
    '10.1.1.1',       // Some enterprise
    '192.168.8.1',    // Huawei devices
    '192.168.4.1',    // TP-Link access points
  ];

  // Extended IP range for thorough scanning
  private static readonly EXTENDED_IPS = [
    '192.168.1.2', '192.168.1.10', '192.168.1.100',
    '192.168.0.2', '192.168.0.10', '192.168.0.100',
    '10.0.0.2', '10.0.0.10', '10.0.0.100',
    '172.16.0.1', '172.16.0.10',
    '192.168.5.1', '192.168.6.1', '192.168.7.1',
    '192.168.9.1', '192.168.20.1', '192.168.50.1',
  ];

  /**
   * Main router discovery method - tries common IPs first
   */
  static async discoverRouter(options: NetworkScanOptions = {}): Promise<DiscoveredRouter | null> {
    const { timeout = 3000, retries = 1, includeExtended = false } = options;
    
    console.log('🔍 Scanning for routers...');
    const startTime = Date.now();

    // Start with most common IPs
    for (const ip of this.COMMON_ROUTER_IPS) {
      try {
        console.log(`📡 Testing ${ip}...`);

        const result = await this.testIP(ip, { timeout, retries });
        if (result.isAccessible) {
          console.log(`✅ Found working router at ${ip} (${Date.now() - startTime}ms)`);
          return result;
        }

      } catch (error) {
        console.log(`❌ ${ip} failed:`, error instanceof Error ? error.message : 'Unknown error');
        continue;
      }
    }

    // If no common router found and extended scan requested
    if (includeExtended) {
      console.log('🔍 Running extended scan...');
      
      for (const ip of this.EXTENDED_IPS) {
        try {
          console.log(`📡 Testing extended IP ${ip}...`);
          
          const result = await this.testIP(ip, { timeout: timeout / 2, retries: 1 });
          if (result.isAccessible) {
            console.log(`✅ Found router at ${ip} (extended scan)`);
            return result;
          }
        } catch (error) {
          continue;
        }
      }
    }

    console.log(`❌ No router found after ${Date.now() - startTime}ms`);
    return null;
  }

  /**
   * Test a specific IP address for router presence
   */
  static async testConnection(ip: string, options: NetworkScanOptions = {}): Promise<boolean> {
    try {
      const result = await this.testIP(ip, options);
      return result.isAccessible;
    } catch (error) {
      return false;
    }
  }

  /**
   * Detailed IP testing with router detection
   */
  static async testIP(ip: string, options: NetworkScanOptions = {}): Promise<DiscoveredRouter> {
    const { timeout = 3000, retries = 1 } = options;
    const startTime = Date.now();

    // Try both HTTP and HTTPS
    const protocols = [
      { url: `http://${ip}`, protocol: 'http' },
      { url: `https://${ip}`, protocol: 'https' },
    ];

    for (const { url, protocol } of protocols) {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          const response = await fetch(url, {
            method: 'HEAD', // Faster than GET
            signal: controller.signal,
            headers: {
              'User-Agent': 'RouterApp/1.0',
              'Accept': '*/*',
            },
          }) as NodeFetchResponse;

          clearTimeout(timeoutId);
          const responseTime = Date.now() - startTime;

          // Any response (even 401/403/404) indicates a web server exists
          if (response.status < 500) {
            const routerInfo = await this.analyzeRouterResponse(response, ip, protocol);
            
            return {
              ipAddress: ip,
              isAccessible: true,
              responseTime,
              detectedBrand: routerInfo.brand,
              authRequired: routerInfo.authRequired,
              supportedProtocols: [protocol],
            };
          }

        } catch (error: any) {
          // Network errors that might indicate a router
          if (error.name === 'AbortError') {
            console.log(`⏱️ ${url} timed out (attempt ${attempt}/${retries})`);
          } else if (error.code === 'ECONNREFUSED') {
            console.log(`🚫 ${url} connection refused`);
          } else if (error.code === 'ECONNRESET') {
            console.log(`🔄 ${url} connection reset`);
          } else {
            console.log(`❌ ${url} error:`, error.message);
          }
          
          // Don't retry on certain errors
          if (error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH') {
            break;
          }
        }
      }
    }

    return {
      ipAddress: ip,
      isAccessible: false,
    };
  }

  /**
   * Analyze HTTP response to detect router brand and features
   */
  private static async analyzeRouterResponse(response: NodeFetchResponse, ip: string, protocol: string): Promise<{
    brand?: string;
    authRequired: boolean;
  }> {
    const headers = response.headers;
    const server = headers.get('server')?.toLowerCase() || '';
    const wwwAuth = headers.get('www-authenticate');
    
    // Detect router brand from headers
    let brand: string | undefined;
    
    if (server.includes('linksys')) brand = 'Linksys';
    else if (server.includes('netgear')) brand = 'Netgear';
    else if (server.includes('d-link')) brand = 'D-Link';
    else if (server.includes('tplink') || server.includes('tp-link')) brand = 'TP-Link';
    else if (server.includes('asus')) brand = 'ASUS';
    else if (server.includes('belkin')) brand = 'Belkin';
    else if (server.includes('airport')) brand = 'Apple';
    else if (server.includes('cisco')) brand = 'Cisco';
    else if (server.includes('huawei')) brand = 'Huawei';
    else if (server.includes('mikrotik')) brand = 'MikroTik';
    
    // Try to get additional info from response body (if small)
    if (!brand && response.status === 200) {
      try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 1000); // Quick timeout
        
        const fullResponse = await fetch(`${protocol}://${ip}`, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'User-Agent': 'RouterApp/1.0' },
        }) as NodeFetchResponse;
        
        const text = await fullResponse.text();
        const bodyLower = text.toLowerCase();
        
        if (bodyLower.includes('linksys')) brand = 'Linksys';
        else if (bodyLower.includes('netgear')) brand = 'Netgear';
        else if (bodyLower.includes('d-link')) brand = 'D-Link';
        else if (bodyLower.includes('tp-link') || bodyLower.includes('tplink')) brand = 'TP-Link';
        else if (bodyLower.includes('asus')) brand = 'ASUS';
        else if (bodyLower.includes('airport')) brand = 'Apple';
        
      } catch (error) {
        // Ignore errors in brand detection
      }
    }
    
    return {
      brand,
      authRequired: response.status === 401 || !!wwwAuth,
    };
  }

  /**
   * Scan multiple IPs concurrently (for advanced users)
   */
  static async bulkScan(
    ipList: string[], 
    options: NetworkScanOptions = {}
  ): Promise<BulkScanResult> {
    const startTime = Date.now();
    const { timeout = 2000 } = options; // Shorter timeout for bulk scanning
    
    console.log(`🔍 Bulk scanning ${ipList.length} IP addresses...`);
    
    const results = await Promise.allSettled(
      ipList.map(ip => this.testIP(ip, { ...options, timeout }))
    );
    
    const accessible: DiscoveredRouter[] = [];
    const failed: string[] = [];
    
    results.forEach((result, index) => {
      const ip = ipList[index];
      
      if (result.status === 'fulfilled' && result.value.isAccessible) {
        accessible.push(result.value);
      } else {
        failed.push(ip);
      }
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Bulk scan complete: ${accessible.length}/${ipList.length} accessible (${duration}ms)`);
    
    return {
      total: ipList.length,
      accessible,
      failed,
      duration,
    };
  }

  /**
   * Generate IP range for local network scanning
   */
  static generateLocalIPRange(baseIP: string = '192.168.1'): string[] {
    const ips: string[] = [];
    
    // Common gateway addresses first
    ips.push(`${baseIP}.1`, `${baseIP}.254`);
    
    // Then scan range 2-253 (excluding 1 and 254 already added)
    for (let i = 2; i <= 253; i++) {
      if (i !== 254) { // Skip 254 as it's already added
        ips.push(`${baseIP}.${i}`);
      }
    }
    
    return ips;
  }

  /**
   * Smart network discovery - tries to detect current network first
   */
  static async smartDiscovery(): Promise<DiscoveredRouter | null> {
    console.log('🧠 Running smart network discovery...');
    
    // First try common router IPs
    const commonResult = await this.discoverRouter({ timeout: 2000 });
    if (commonResult) {
      return commonResult;
    }
    
    // If that fails, try to detect current network and scan that range
    // This is more advanced and would require additional network detection logic
    console.log('🔍 Common IPs failed, trying extended discovery...');
    
    return await this.discoverRouter({ 
      timeout: 1500, 
      includeExtended: true 
    });
  }

  /**
   * Check if an IP looks like a router based on common patterns
   */
  static isLikelyRouterIP(ip: string): boolean {
    const commonPatterns = [
      /^192\.168\.[0-9]{1,3}\.1$/,      // 192.168.x.1
      /^192\.168\.[0-9]{1,3}\.254$/,    // 192.168.x.254
      /^10\.0\.[0-9]{1,3}\.1$/,         // 10.0.x.1
      /^172\.16\.[0-9]{1,3}\.1$/,       // 172.16.x.1
    ];
    
    return commonPatterns.some(pattern => pattern.test(ip));
  }
}