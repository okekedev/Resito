// ===== src/services/router-ai/reboot-service.ts =====
import { Agent } from 'browser-use';
import { getGeminiModel } from '../../config/gemini.js';
import { BaseRouterService, RouterActionResult } from './base-service.js';
import { RouterLoginService } from './login-service.js';

export class RouterRebootService extends BaseRouterService {
  async reboot(ipAddress: string, username: string, password: string): Promise<RouterActionResult> {
    const startTime = Date.now();

    try {
      await this.initialize();

      // Login first
      const loginService = new RouterLoginService();
      const loginResult = await loginService.login(ipAddress, username, password);
      
      if (!loginResult.success) {
        return loginResult;
      }

      // Transfer the browser session
      this.browser = loginService['browser'];
      this.page = loginService['page'];

      console.log(`🔄 AI rebooting router...`);

      // Create AI agent for reboot
      const agent = new Agent({
        task: `Find and click the router reboot/restart button. Look for terms like "Reboot", "Restart", "Reset", "Power Cycle", or "Restart Router". Navigate through menus if needed (System, Administration, etc.). Click the reboot button and confirm if prompted.`,
        llm: getGeminiModel('simple'),
        page: this.page!,
      });

      await agent.run();

      const duration = Date.now() - startTime;

      return {
        success: true,
        message: 'Router reboot initiated successfully',
        data: { 
          action: 'reboot',
          estimatedDowntime: '60-120 seconds',
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