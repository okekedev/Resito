// ===== src/services/router-ai/login-service.ts =====
import { Agent } from 'browser-use';
import { getGeminiModel } from '../../config/gemini.js';
import { BaseRouterService, RouterActionResult } from './base-service.js';

export class RouterLoginService extends BaseRouterService {
  async login(ipAddress: string, username: string, password: string): Promise<RouterActionResult> {
    const startTime = Date.now();

    try {
      await this.initialize();
      
      console.log(`🤖 AI logging into router at ${ipAddress}...`);

      await this.navigateToRouter(ipAddress);

      // Create AI agent for login
      const agent = new Agent({
        task: `Login to this router using username "${username}" and password "${password}". Look for login forms, fill them out, and confirm successful login. If already logged in, just confirm access to the router dashboard.`,
        llm: getGeminiModel('simple'),
        page: this.page!,
      });

      await agent.run();

      const duration = Date.now() - startTime;

      return {
        success: true,
        message: 'Successfully logged into router',
        data: { loginMethod: 'ai_automated' },
        duration,
        aiCost: 0.001,
      };

    } catch (error) {
      console.error('Router login failed:', error);
      return {
        success: false,
        message: `Failed to login to router: ${error.message}`,
        duration: Date.now() - startTime,
      };
    }
  }
}