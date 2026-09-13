import {
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { chromium, type Browser, type Page } from 'playwright';

@Injectable()
export class BrowserService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserService.name);
  private browserPromise: Promise<Browser> | null = null;

  async withPage<T>(run: (page: Page) => Promise<T>): Promise<T> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      return await run(page);
    } finally {
      await page.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.browserPromise) {
      return;
    }

    const browser = await this.browserPromise;
    await browser.close();
    this.browserPromise = null;
  }

  private getBrowser(): Promise<Browser> {
    process.env.PLAYWRIGHT_BROWSERS_PATH ??= '0';

    this.browserPromise ??= chromium
      .launch({ headless: true })
      .catch((error: unknown) => {
        this.browserPromise = null;
        this.logger.error('Failed to launch Chromium', error);
        throw error;
      });

    return this.browserPromise;
  }
}
