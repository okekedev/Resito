// ===== src/services/login-service.ts =====
import { BaseRouterService, RouterActionResult } from './base-service.js';

export class RouterLoginService extends BaseRouterService {
  async login(ipAddress: string, username: string, password: string): Promise<RouterActionResult> {
    const startTime = Date.now();

    try {
      await this.initialize();
      
      console.log(`🤖 AI logging into router at ${ipAddress}...`);

      // Navigate to router (Playwright - reliable)
      await this.navigateToRouter(ipAddress);

      // Check if login is needed (AI - adaptive)
      const page = this.stagehand!.page;
      const pageContent = await page.content();
      
      if (pageContent.toLowerCase().includes('login') || 
          pageContent.toLowerCase().includes('sign in') ||
          pageContent.toLowerCase().includes('password')) {
        
        console.log('🔐 Login required, using AI to authenticate...');
        
        // Use AI to handle login form
        await this.performAIAction(
          `Login to this router using username "${username}" and password "${password}". 
           Look for login forms, fill them out with the provided credentials, and submit.`
        );
        
        // Wait for login completion
        await page.waitForLoadState('networkidle');
        
        // Verify login success
        const newContent = await page.content();
        if (newContent.toLowerCase().includes('login') && 
            !newContent.toLowerCase().includes('logout')) {
          throw new Error('Login appeared to fail - still seeing login form');
        }
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        message: 'Successfully logged into router',
        data: { 
          loginMethod: 'stagehand_ai',
          requiresAuth: pageContent.toLowerCase().includes('login')
        },
        duration,
        aiCost: 0.001, // Estimate - Stagehand tracks actual costs
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