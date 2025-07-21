// ===== src/services/router-ai/index.ts =====
import { RouterLoginService } from './login-service.js';
import { RouterRebootService } from './reboot-service.js';
import { RouterSpeedService } from './speed-service.js';
import { RouterDevicesService } from './devices-service.js';
import { RouterActionResult } from './base-service.js';

export class RouterAIService {
  async testConnection(ipAddress: string, username: string, password: string): Promise<RouterActionResult> {
    const loginService = new RouterLoginService();
    try {
      return await loginService.login(ipAddress, username, password);
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error.message}`,
        duration: 0,
      };
    } finally {
      await loginService.cleanup();
    }
  }

  async rebootRouter(ipAddress: string, username: string, password: string): Promise<RouterActionResult> {
    const rebootService = new RouterRebootService();
    try {
      return await rebootService.reboot(ipAddress, username, password);
    } catch (error) {
      return {
        success: false,
        message: `Reboot failed: ${error.message}`,
        duration: 0,
      };
    } finally {
      await rebootService.cleanup();
    }
  }

  async getSpeedTest(ipAddress: string, username: string, password: string): Promise<RouterActionResult> {
    const speedService = new RouterSpeedService();
    try {
      return await speedService.getSpeed(ipAddress, username, password);
    } catch (error) {
      return {
        success: false,
        message: `Speed test failed: ${error.message}`,
        duration: 0,
      };
    } finally {
      await speedService.cleanup();
    }
  }

  async getConnectedDevices(ipAddress: string, username: string, password: string): Promise<RouterActionResult> {
    const devicesService = new RouterDevicesService();
    try {
      return await devicesService.getDevices(ipAddress, username, password);
    } catch (error) {
      return {
        success: false,
        message: `Device scan failed: ${error.message}`,
        duration: 0,
      };
    } finally {
      await devicesService.cleanup();
    }
  }
}