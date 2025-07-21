// ===== src/services/reboot-service.ts =====
import { BaseRouterService, RouterActionResult } from './base-service.js';
import { RouterLoginService } from './login-service.js';

export class RouterRebootService extends BaseRouterService {
  async reboot(ipAddress: string, username: string, password: string): Promise<RouterActionResult> {
    const startTime = Date.now();

    try {
      await this.initialize();

      // Login first using the login service
      const loginService = new RouterLoginService();
      const loginResult = await loginService.login(ipAddress, username, password);
      
      if (!loginResult.success) {
        return loginResult;
      }

      // Transfer the session to our service
      await this.navigateToRouter(ipAddress);

      console.log(`🔄 AI rebooting router...`);

      // Use AI to find and click reboot button
      await this.performAIAction(`
        Find and click the router reboot or restart button. Look for:
        - Buttons with text like "Reboot", "Restart", "Reset", "Power Cycle"
        - Navigation menus like "System", "Administration", "Tools", "Maintenance"
        - After clicking reboot, confirm any confirmation dialogs that appear
        - Complete the reboot process
      `);

      // Wait a moment for the reboot to initiate
      await new Promise(resolve => setTimeout(resolve, 2000));

      const duration = Date.now() - startTime;

      return {
        success: true,
        message: 'Router reboot initiated successfully',
        data: { 
          action: 'reboot',
          estimatedDowntime: '60-120 seconds',
          method: 'stagehand_ai'
        },
        duration,
        aiCost: 0.003,
      };

    } catch (error) {
      console.error('Router reboot failed:', error);
      return {
        success: false,
        message: `Failed to reboot router: ${error.message}`,
        duration: Date.now() - startTime,
      };
    }
  }
}