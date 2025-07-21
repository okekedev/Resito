mport { chromium, Browser, Page } from 'playwright';

export interface RouterActionResult {
  success: boolean;
  message: string;
  data?: any;
  aiCost?: number;
  duration?: number;
}

export abstract class BaseRouterService {
  protected browser: Browser | null = null;
  protected page: Page | null = null;

  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    }

    if (!this.page) {
      this.page = await this.browser.newPage();
      await this.page.setViewportSize({ width: 1280, height: 720 });
    }
  }

  async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  protected async navigateToRouter(ipAddress: string): Promise<void> {
    await this.page!.goto(`http://${ipAddress}`, { timeout: 10000 });
    await this.page!.waitForLoadState('networkidle');
  }
}
