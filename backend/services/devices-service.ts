// ===== src/services/devices-service.ts =====
import { z } from 'zod';
import { BaseRouterService, RouterActionResult } from './base-service.js';
import { RouterLoginService } from './login-service.js';

// Define the structure we want to extract
const DeviceSchema = z.object({
  name: z.string().describe('Device name or hostname'),
  ipAddress: z.string().describe('IP address of the device'),
  macAddress: z.string().optional().describe('MAC address if visible'),
  connectionType: z.enum(['Wi-Fi', 'Ethernet', 'Unknown']).describe('Connection type'),
  isActive: z.boolean().describe('Whether the device is currently active/connected'),
});

const DevicesListSchema = z.object({
  devices: z.array(DeviceSchema).describe('List of connected devices'),
  totalCount: z.number().describe('Total number of devices found'),
});

export class RouterDevicesService extends BaseRouterService {
  async getDevices(ipAddress: string, username: string, password: string): Promise<RouterActionResult> {
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

      console.log(`📱 AI getting connected devices...`);

      // Use AI to navigate to devices page
      await this.performAIAction(`
        Navigate to the section that shows connected devices. Look for:
        - Menu items like "Connected Devices", "Client List", "Device Manager"
        - "DHCP Clients", "Network Map", "Wireless Clients"
        - "LAN Status", "Device Status", "Active Devices"
        - Common locations: Wireless, Advanced, Network, Status menus
        Make sure to get to a page that shows a list of connected devices with their details.
      `);

      // Wait for the devices page to load
      await this.stagehand!.page.waitForLoadState('networkidle');

      // Extract device data using AI
      const devicesData = await this.extractData(
        `Extract all connected devices from this page. For each device, get:
         - Device name/hostname (like "iPhone", "MacBook Pro", etc.)
         - IP address (like "192.168.1.100")
         - MAC address if shown (like "AA:BB:CC:DD:EE:FF")
         - Connection type (Wi-Fi, Ethernet, or Unknown if unclear)
         - Whether the device is currently active/connected (true/false)
         - Count the total number of devices found`,
        DevicesListSchema
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        message: `Found ${devicesData.totalCount} connected devices`,
        data: {
          devices: devicesData.devices,
          count: devicesData.totalCount,
          extractionMethod: 'stagehand_ai'
        },
        duration,
        aiCost: 0.004, // Higher cost for data extraction
      };

    } catch (error) {
      console.error('Get devices failed:', error);
      
      // Fallback: return empty list instead of failing completely
      return {
        success: true,
        message: 'Could not extract device data, but router is accessible',
        data: { 
          devices: [], 
          count: 0,
          error: error.message,
          extractionMethod: 'failed'
        },
        duration: Date.now() - startTime,
      };
    }
  }
}