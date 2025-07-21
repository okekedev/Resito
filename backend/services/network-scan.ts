interface DiscoveredRouter {
  ipAddress: string;
  isAccessible: boolean;
}

export class NetworkScanService {
  private static readonly COMMON_ROUTER_IPS = [
    '192.168.1.1',    // Most common
    '192.168.0.1',    // D-Link, Netgear  
    '10.0.0.1',       // Apple, some ISPs
    '192.168.2.1',    // Some Linksys
    '192.168.10.1',   // Some ISPs
    '192.168.100.1',  // Some ISPs
    '172.16.1.1',     // Some enterprise
    '192.168.1.254',  // Some routers
    '192.168.0.254',  // Alternative
    '192.168.3.1',    // Alternative
  ];

  static async discoverRouter(): Promise<DiscoveredRouter | null> {
    console.log('🔍 Scanning for routers...');

    for (const ip of this.COMMON_ROUTER_IPS) {
      try {
        console.log(`📡 Testing ${ip}...`);

        // Simple check - just see if we get any response
        const isWorking = await this.testIP(ip);
        if (isWorking) {
          console.log(`✅ Found working router at ${ip}`);
          return {
            ipAddress: ip,
            isAccessible: true,
          };
        }

      } catch (error) {
        console.log(`❌ ${ip} failed:`, error.message);
        continue;
      }
    }

    console.log('❌ No router found on common IPs');
    return null;
  }

  private static async testIP(ip: string): Promise<boolean> {
    // Try both HTTP and HTTPS
    const urls = [`http://${ip}`, `https://${ip}`];

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(3000), // Quick timeout
        });

        // Any response (even 401/403) means router exists
        if (response.status < 500) {
          return true;
        }

      } catch (error) {
        // Try next URL
        continue;
      }
    }

    return false;
  }

  // Simple connection test for saved routers
  static async testConnection(ip: string): Promise<boolean> {
    return await this.testIP(ip);
  }
}
