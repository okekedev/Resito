import https from 'https';
import http from 'http';

interface DiscoveredRouter {
  ipAddress: string;
  isAccessible: boolean;
}

// Helper function to safely get error codes from Node.js errors
function getErrorCode(error: Error): string | undefined {
  return 'code' in error ? (error as any).code : undefined;
}

export class NetworkScanService {
  private static readonly COMMON_ROUTER_IPS = [
    // Your specific network first (highest priority)
    '192.168.78.1',   // Your network - test this FIRST
    
    // Most common residential ranges
    '192.168.1.1',    // Most common
    '192.168.0.1',    // D-Link, Netgear, TP-Link
    '192.168.2.1',    // Linksys, Belkin
    '192.168.3.1',    // Some routers
    '10.0.0.1',       // Apple, some ISPs, Xfinity
    
    // ISP and carrier specific
    '192.168.4.1',    // Some ISPs
    '192.168.8.1',    // Huawei routers
    '192.168.10.1',   // Some ISPs
    '192.168.20.1',   // Some ISPs
    '192.168.50.1',   // Some ISPs
    '192.168.68.1',   // Spectrum, Charter
    '192.168.86.1',   // Google Nest
    '192.168.100.1',  // Some ISPs
    '192.168.254.254', // Some ISPs
    
    // Alternative common IPs
    '192.168.1.254',  // Some routers
    '192.168.0.254',  // Alternative
    '192.168.2.254',  // Alternative
    
    // Enterprise and business
    '10.1.1.1',       // Business networks
    '172.16.1.1',     // Enterprise
    '172.16.0.1',     // Enterprise
    
    // Mobile hotspot and satellite
    '192.168.43.1',   // Android hotspot
    '172.20.10.1',    // iPhone hotspot
    '192.168.15.1',   // Some cable providers
  ];

  static async discoverRouter(): Promise<DiscoveredRouter | null> {
    console.log(`🔍 Scanning ${this.COMMON_ROUTER_IPS.length} router IPs in parallel...`);
    const startTime = Date.now();

    // Test all IPs simultaneously with Promise.allSettled
    const testPromises = this.COMMON_ROUTER_IPS.map(async (ip) => {
      try {
        const isWorking = await this.testIP(ip);
        return { ip, isWorking, error: null };
      } catch (error) {
        return { ip, isWorking: false, error: error.message };
      }
    });

    // Wait for all tests to complete (or timeout)
    const results = await Promise.allSettled(testPromises);
    
    // Find the first working router
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.isWorking) {
        const duration = Date.now() - startTime;
        console.log(`✅ Found working router at ${result.value.ip} (scan took ${duration}ms)`);
        
        return {
          ipAddress: result.value.ip,
          isAccessible: true,
        };
      }
    }

    // Log results for debugging
    const duration = Date.now() - startTime;
    const attempted = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`❌ No router found after scanning ${attempted} IPs (${failed} timeouts) in ${duration}ms`);
    console.log('💡 Try running "ipconfig" (Windows) or "ip route" (Linux/Mac) to find your gateway IP');
    
    return null;
  }

  private static async testIP(ip: string): Promise<boolean> {
    console.log(`🔍 Testing ${ip}...`);
    
    // Test both HTTP and HTTPS using Node.js native modules (better certificate handling)
    const testPromises = [
      this.testHTTP(ip),
      this.testHTTPS(ip)
    ];

    const results = await Promise.allSettled(testPromises);
    
    // Return true if either HTTP or HTTPS worked
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        console.log(`  ✅ ${ip} is accessible via router interface`);
        return true;
      }
    }

    console.log(`  ❌ ${ip} is not accessible via either HTTP or HTTPS`);
    return false;
  }

  private static async testHTTP(ip: string): Promise<boolean> {
    return new Promise((resolve) => {
      console.log(`  📡 Trying http://${ip}...`);
      
      const req = http.request({
        hostname: ip,
        port: 80,
        path: '/',
        method: 'GET',
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      }, (res) => {
        console.log(`  ✅ http://${ip} responded: ${res.statusCode || 'unknown'} ${res.statusMessage || ''}`);
        
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          const looksLikeRouter = this.isRouterContent(data, res.statusCode || 200);
          console.log(`  🎯 HTTP router content detected: ${looksLikeRouter}`);
          resolve((res.statusCode || 500) < 500 || looksLikeRouter);
        });
      });

      req.on('error', (error) => {
        if (error.message.includes('ECONNREFUSED')) {
          console.log(`  🚫 http://${ip} connection refused (port 80 closed)`);
        } else if (error.message.includes('timeout')) {
          console.log(`  ⏱️ http://${ip} timed out`);
        } else {
          console.log(`  ❌ http://${ip} error: ${error.message}`);
        }
        resolve(false);
      });

      req.on('timeout', () => {
        console.log(`  ⏱️ http://${ip} timed out after 5 seconds`);
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  private static async testHTTPS(ip: string): Promise<boolean> {
    return new Promise((resolve) => {
      console.log(`  📡 Trying https://${ip}...`);
      
      const req = https.request({
        hostname: ip,
        port: 443,
        path: '/',
        method: 'GET',
        timeout: 5000,
        // IMPORTANT: Accept invalid/self-signed certificates
        rejectUnauthorized: false,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      }, (res) => {
        console.log(`  ✅ https://${ip} responded: ${res.statusCode || 'unknown'} ${res.statusMessage || ''}`);
        console.log(`  🔒 TLS/SSL connection successful (self-signed cert accepted)`);
        
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          const looksLikeRouter = this.isRouterContent(data, res.statusCode || 200);
          console.log(`  🎯 HTTPS router content detected: ${looksLikeRouter}`);
          if (looksLikeRouter) {
            console.log(`  📄 Content preview: ${data.substring(0, 200)}...`);
          }
          resolve((res.statusCode || 500) < 500 || looksLikeRouter);
        });
      });

      req.on('error', (error) => {
        if (error.message.includes('ECONNREFUSED')) {
          console.log(`  🚫 https://${ip} connection refused (port 443 closed)`);
        } else if (error.message.includes('timeout')) {
          console.log(`  ⏱️ https://${ip} timed out`);
        } else {
          const errorCode = getErrorCode(error);
          if (errorCode === 'CERT_HAS_EXPIRED' || errorCode === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
            console.log(`  🔒 https://${ip} certificate issue: ${errorCode} (this means router exists!)`);
            resolve(true); // Certificate errors mean router exists
          } else {
            console.log(`  ❌ https://${ip} error: ${error.message}`);
          }
        }
        resolve(false);
      });

      req.on('timeout', () => {
        console.log(`  ⏱️ https://${ip} timed out after 5 seconds`);
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  private static isRouterContent(content: string, statusCode?: number): boolean {
    if (statusCode === 401) return true; // Auth required = router
    
    const lowerContent = content.toLowerCase();
    return lowerContent.includes('login') ||
           lowerContent.includes('router') ||
           lowerContent.includes('admin') ||
           lowerContent.includes('wireless') ||
           lowerContent.includes('password') ||
           lowerContent.includes('netgear') ||
           lowerContent.includes('linksys') ||
           lowerContent.includes('tp-link') ||
           lowerContent.includes('asus') ||
           lowerContent.includes('dlink') ||
           lowerContent.includes('belkin') ||
           lowerContent.includes('config') ||
           lowerContent.includes('setup');
  }

  // Simple connection test for saved routers
  static async testConnection(ip: string): Promise<boolean> {
    return await this.testIP(ip);
  }
}