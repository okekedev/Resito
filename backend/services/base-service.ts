// ===== src/services/base-service.ts =====
import { Stagehand } from '@browserbasehq/stagehand';
import { z } from 'zod';

export interface RouterActionResult {
  success: boolean;
  message: string;
  data?: any;
  aiCost?: number;
  duration?: number;
}

export abstract class BaseRouterService {
  protected stagehand: Stagehand | null = null;

  async initialize(): Promise<void> {
    if (!this.stagehand) {
      this.stagehand = new Stagehand({
        env: 'BROWSERBASE',
        apiKey: process.env.BROWSERBASE_API_KEY,
        projectId: process.env.BROWSERBASE_PROJECT_ID,
        // Alternative: run locally
        // env: 'LOCAL',
      });

      await this.stagehand.init();
    }
  }

  async cleanup(): Promise<void> {
    if (this.stagehand) {
      await this.stagehand.close();
      this.stagehand = null;
    }
  }

  protected async navigateToRouter(ipAddress: string): Promise<void> {
    if (!this.stagehand) {
      throw new Error('Stagehand not initialized');
    }

    // Use Playwright for reliable navigation
    const page = this.stagehand.page;
    await page.goto(`http://${ipAddress}`, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  }

  protected async performAIAction(instruction: string): Promise<void> {
    if (!this.stagehand) {
      throw new Error('Stagehand not initialized');
    }

    // Use AI for complex navigation
    await this.stagehand.page.act(instruction);
  }

  protected async extractData<T>(instruction: string, schema: z.ZodSchema<T>): Promise<T> {
    if (!this.stagehand) {
      throw new Error('Stagehand not initialized');
    }

    // Use AI to extract structured data
    return await this.stagehand.page.extract({
      instruction,
      schema,
    });
  }
}