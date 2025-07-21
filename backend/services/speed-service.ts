// ===== src/services/speed-service.ts =====
import { z } from 'zod';
import { BaseRouterService, RouterActionResult } from './base-service.js';
import { RouterLoginService } from './login-service.js';

// Define the structure we want to extract for speed data
const SpeedDataSchema = z.object({
  downloadSpeed: z.number().optional().describe('Download speed in Mbps'),
  uploadSpeed: z.number().optional().describe('Upload speed in Mbps'),
  ping: z.number().optional().describe('Ping/latency in milliseconds'),
  connectionStatus: z.string().describe('Connection status (Connected, Disconnected, etc.)'),
  signalStrength: z.string().optional().describe('Signal strength if available'),
  connectionType: z.string().optional().describe('Connection type (Cable, DSL, Fiber, etc.)'),
  publicIP: z.string().optional().describe('Public/WAN IP address if shown'),
}).describe('Internet speed and connection information from router');

export class RouterSpeedService extends BaseRouterService {
  async getSpeed(ipAddress: string, username: string, password: string): Promise<RouterActionResult> {
    const startTime = Date.now();

    try {
      await this.initialize();

      // Login first
      const loginService = new RouterLoginService();
      const loginResult = await loginService.login(ipAddress, username, password);
      
      if (!loginResult.success) {
        return loginResult;
      }

      await this.navigateToRouter(ipAddress);

      console.log(`🚀 AI running speed test...`);

      // Use AI to navigate to speed/status information
      await this.performAIAction(`
        Navigate to find internet speed, bandwidth, or connection status information. Look for:
        - Menu items like "Internet Status", "WAN Status", "Connection Status"
        - "Traffic Monitor", "Bandwidth Monitor", "Speed Test", "Network Statistics"
        - "Status", "Dashboard", "Overview" sections that show connection info
        - Built-in speed test functionality if available
        - Current upload/download speeds or connection statistics
        Find a page that shows current internet connection details and speeds.
      `);

      // Wait for the status page to load
      await this.stagehand!.page.waitForLoadState('networkidle');

      // Try to extract speed data using AI
      let speedData: any;
      
      try {
        speedData = await this.extractData(
          `Extract internet speed and connection information from this page. Look for:
           - Download/upload speeds (in Mbps, Kbps, or similar units)
           - Ping/latency measurements (in ms)
           - Connection status (Connected, Online, etc.)
           - Signal strength if this is wireless
           - Connection type (Cable, DSL, Fiber, etc.)
           - Public/WAN IP address if shown
           - Any bandwidth usage statistics
           If there's a speed test button, don't click it - just get current status info.
           Convert all speeds to Mbps if possible.`,
          SpeedDataSchema
        );

        // Clean up and standardize the data
        const cleanedData = {
          downloadSpeed: speedData.downloadSpeed || null,
          uploadSpeed: speedData.uploadSpeed || null,
          ping: speedData.ping || null,
          connectionStatus: speedData.connectionStatus || 'Unknown',
          signalStrength: speedData.signalStrength || null,
          connectionType: speedData.connectionType || null,
          publicIP: speedData.publicIP || null,
          unit: 'Mbps',
          timestamp: new Date().toISOString(),
          source: 'router_interface',
          extractionMethod: 'stagehand_ai'
        };

        const duration = Date.now() - startTime;

        return {
          success: true,
          message: 'Speed and connection information retrieved',
          data: cleanedData,
          duration,
          aiCost: 0.003, // Slightly higher for data extraction
        };

      } catch (extractError) {
        console.warn('Could not extract structured speed data, trying fallback...', extractError);
        
        // Fallback: try to get basic connection status
        const page = this.stagehand!.page;
        const pageContent = await page.content();
        const title = await page.title();
        
        // Check if we at least got to a status page
        const isStatusPage = pageContent.toLowerCase().includes('status') ||
                            pageContent.toLowerCase().includes('connection') ||
                            pageContent.toLowerCase().includes('internet') ||
                            title.toLowerCase().includes('status');
        
        const duration = Date.now() - startTime;
        
        if (isStatusPage) {
          return {
            success: true,
            message: 'Router status accessible but could not extract specific speed data',
            data: {
              connectionStatus: 'Connected (details not extractable)',
              timestamp: new Date().toISOString(),
              source: 'router_interface',
              extractionMethod: 'fallback',
              rawPageTitle: title
            },
            duration,
            aiCost: 0.002,
          };
        } else {
          throw new Error('Could not access router status information');
        }
      }

    } catch (error) {
      console.error('Speed test failed:', error);
      return {
        success: false,
        message: `Failed to get speed information: ${error.message}`,
        duration: Date.now() - startTime,
      };
    }
  }
}