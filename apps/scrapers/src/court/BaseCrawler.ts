/**
 * Base Crawler
 * Abstract base class for court scrapers
 */

import type { Browser, BrowserContext, Page } from 'playwright';
import { logger } from '../lib/logger';
import { captureScraperError, addBreadcrumb } from '../lib/sentry';
import { launchCamoufox, createStealthContext, createStealthPage, closeBrowser, humanDelay, saveSession, loadSession } from './camoufox';
import { navigateWithCloudflareBypass, handleCloudflareChallenge } from './cloudflare';
import { CourtScraperError, CourtScraperErrorCode, wrapError, isRetryableError } from './errors';
import { getCourtCrawlerConfig } from './crawlee.config';
import { ProxyManager } from './proxy';
import { CourtRateLimiter } from './rateLimit';
import type { CrawlerConfig, ScrapeResult, SessionData, ScraperMetrics, CourtInfo } from './types';

/**
 * Base crawler options
 */
export interface BaseCrawlerOptions {
  courtId: string;
  config?: Partial<CrawlerConfig>;
  proxyManager?: ProxyManager;
  rateLimiter?: CourtRateLimiter;
  sessionStore?: SessionStore;
}

/**
 * Session store interface
 */
export interface SessionStore {
  get(courtId: string): Promise<SessionData | null>;
  set(session: SessionData): Promise<void>;
  delete(sessionId: string): Promise<void>;
}

/**
 * Abstract base crawler class
 */
export abstract class BaseCrawler {
  protected courtId: string;
  protected config: CrawlerConfig;
  protected browser: Browser | null = null;
  protected context: BrowserContext | null = null;
  protected page: Page | null = null;
  protected proxyManager: ProxyManager | null;
  protected rateLimiter: CourtRateLimiter | null;
  protected sessionStore: SessionStore | null;
  protected currentSession: SessionData | null = null;
  protected metrics: ScraperMetrics;

  constructor(options: BaseCrawlerOptions) {
    this.courtId = options.courtId;
    this.config = getCourtCrawlerConfig(options.courtId);
    if (options.config) {
      this.config = { ...this.config, ...options.config };
    }
    this.proxyManager = options.proxyManager || null;
    this.rateLimiter = options.rateLimiter || null;
    this.sessionStore = options.sessionStore || null;
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      blockedRequests: 0,
      averageResponseTime: 0,
      cloudflareBypasses: 0,
      cloudflareFailures: 0,
    };
  }

  /**
   * Get court information (must be implemented by subclass)
   */
  abstract getCourtInfo(): CourtInfo;

  /**
   * Initialize the crawler
   */
  async initialize(): Promise<void> {
    logger.info('Initializing crawler', { courtId: this.courtId });

    // Launch browser
    const proxyConfig = this.proxyManager?.getPlaywrightProxy();
    this.browser = await launchCamoufox({
      headless: this.config.headless,
      proxy: proxyConfig,
    });

    // Create context
    this.context = await createStealthContext(this.browser);

    // Try to load existing session
    if (this.config.sessionPersistence && this.sessionStore) {
      const session = await this.sessionStore.get(this.courtId);
      if (session) {
        await loadSession(this.context, session);
        this.currentSession = session;
        logger.info('Loaded existing session', { sessionId: session.id });
      }
    }

    // Create page
    this.page = await createStealthPage(this.context);

    logger.info('Crawler initialized', { courtId: this.courtId });
  }

  /**
   * Navigate to a URL with Cloudflare bypass
   */
  protected async navigate(url: string, waitForSelector?: string): Promise<void> {
    if (!this.page) {
      throw new CourtScraperError('Crawler not initialized', CourtScraperErrorCode.INTERNAL_ERROR);
    }

    // Check rate limit
    if (this.rateLimiter) {
      await this.rateLimiter.waitForSlot(new URL(url).hostname);
    }

    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const result = await navigateWithCloudflareBypass(this.page, url, {
        timeout: this.config.requestTimeout,
        waitForSelector,
      });

      if (result.success && result.challengeType) {
        this.metrics.cloudflareBypasses++;
        logger.info('Cloudflare challenge bypassed', { challengeType: result.challengeType });
      }

      this.metrics.successfulRequests++;
      this.updateAverageResponseTime(Date.now() - startTime);

      // Save session after successful navigation
      if (this.config.sessionPersistence && this.context && this.sessionStore) {
        const session = await saveSession(this.context, this.courtId);
        await this.sessionStore.set(session);
        this.currentSession = session;
      }
    } catch (error) {
      this.metrics.failedRequests++;

      if (error instanceof CourtScraperError && error.code === CourtScraperErrorCode.CLOUDFLARE_BLOCKED) {
        this.metrics.blockedRequests++;
        this.metrics.cloudflareFailures++;
      }

      // Report to Sentry with scraper context
      captureScraperError(error, {
        courtId: this.courtId,
        operation: 'navigate',
        url,
      });

      throw error;
    }
  }

  /**
   * Execute a scrape operation with retries
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<ScrapeResult<T>> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    // Add breadcrumb for the operation
    addBreadcrumb({
      category: 'scraper',
      message: `Starting operation: ${operationName}`,
      level: 'info',
      data: { courtId: this.courtId },
    });

    for (let attempt = 1; attempt <= this.config.retryCount; attempt++) {
      try {
        logger.debug('Executing operation', { operation: operationName, attempt });

        const data = await operation();

        return {
          success: true,
          data,
          duration: Date.now() - startTime,
          retries: attempt - 1,
          timestamp: new Date(),
          sourceUrl: this.page?.url() || '',
        };
      } catch (error) {
        lastError = error as Error;
        const wrapped = wrapError(error);

        logger.warn('Operation failed', {
          operation: operationName,
          attempt,
          error: wrapped.message,
          isRetryable: wrapped.isRetryable,
        });

        if (!wrapped.isRetryable || attempt >= this.config.retryCount) {
          break;
        }

        // Exponential backoff
        const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
        await humanDelay(delay, delay + 1000);

        // Rotate proxy on retry if available
        if (this.proxyManager && attempt > 1) {
          this.proxyManager.rotateSession();
          await this.reinitialize();
        }
      }
    }

    // Report final failure to Sentry after all retries exhausted
    if (lastError) {
      captureScraperError(lastError, {
        courtId: this.courtId,
        operation: operationName,
        url: this.page?.url(),
        attempt: this.config.retryCount,
        maxAttempts: this.config.retryCount,
      });
    }

    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      errorCode: lastError instanceof CourtScraperError ? lastError.code : 'UNKNOWN_ERROR',
      duration: Date.now() - startTime,
      retries: this.config.retryCount,
      timestamp: new Date(),
      sourceUrl: this.page?.url() || '',
    };
  }

  /**
   * Reinitialize browser (for retry after failure)
   */
  protected async reinitialize(): Promise<void> {
    await this.close();
    await this.initialize();
  }

  /**
   * Wait for an element with timeout
   */
  protected async waitForElement(selector: string, timeout?: number): Promise<void> {
    if (!this.page) {
      throw new CourtScraperError('Crawler not initialized', CourtScraperErrorCode.INTERNAL_ERROR);
    }

    await this.page.waitForSelector(selector, {
      timeout: timeout || this.config.requestTimeout,
    });
  }

  /**
   * Get text content of an element
   */
  protected async getText(selector: string): Promise<string | null> {
    if (!this.page) return null;

    try {
      const element = await this.page.$(selector);
      if (!element) return null;
      return await element.textContent();
    } catch {
      return null;
    }
  }

  /**
   * Get all text contents matching a selector
   */
  protected async getAllText(selector: string): Promise<string[]> {
    if (!this.page) return [];

    try {
      const elements = await this.page.$$(selector);
      const texts: string[] = [];

      for (const element of elements) {
        const text = await element.textContent();
        if (text) texts.push(text.trim());
      }

      return texts;
    } catch {
      return [];
    }
  }

  /**
   * Get attribute of an element
   */
  protected async getAttribute(selector: string, attribute: string): Promise<string | null> {
    if (!this.page) return null;

    try {
      const element = await this.page.$(selector);
      if (!element) return null;
      return await element.getAttribute(attribute);
    } catch {
      return null;
    }
  }

  /**
   * Type text into an input field
   */
  protected async typeText(selector: string, text: string): Promise<void> {
    if (!this.page) {
      throw new CourtScraperError('Crawler not initialized', CourtScraperErrorCode.INTERNAL_ERROR);
    }

    // Focus and clear the input field first
    await this.page.click(selector, { clickCount: 3 }); // Triple-click to select all
    await humanDelay(50, 150);

    // Clear any existing text
    await this.page.keyboard.press('Backspace');
    await humanDelay(100, 300);

    // Type the entire text with human-like delay between characters
    // Playwright's type() handles character-by-character typing with delay
    const avgDelay = 75; // Average delay between keystrokes (50-100ms range)
    await this.page.type(selector, text, { delay: avgDelay });
  }

  /**
   * Click an element with human-like delay
   */
  protected async click(selector: string): Promise<void> {
    if (!this.page) {
      throw new CourtScraperError('Crawler not initialized', CourtScraperErrorCode.INTERNAL_ERROR);
    }

    await humanDelay(100, 300);
    await this.page.click(selector);
    await humanDelay(200, 500);
  }

  /**
   * Submit a form
   */
  protected async submitForm(formSelector: string): Promise<void> {
    if (!this.page) {
      throw new CourtScraperError('Crawler not initialized', CourtScraperErrorCode.INTERNAL_ERROR);
    }

    await this.page.evaluate((selector) => {
      const form = document.querySelector(selector) as HTMLFormElement;
      if (form) form.submit();
    }, formSelector);

    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Get page HTML
   */
  protected async getHtml(): Promise<string> {
    if (!this.page) return '';
    return await this.page.content();
  }

  /**
   * Take a screenshot (for debugging)
   */
  protected async screenshot(path: string): Promise<void> {
    if (!this.page) return;
    await this.page.screenshot({ path, fullPage: true });
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(duration: number): void {
    const total = this.metrics.successfulRequests;
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (total - 1) + duration) / total;
  }

  /**
   * Get crawler metrics
   */
  getMetrics(): ScraperMetrics {
    return { ...this.metrics };
  }

  /**
   * Check if crawler is healthy
   */
  async checkHealth(): Promise<{ healthy: boolean; details: Record<string, unknown> }> {
    const courtInfo = this.getCourtInfo();

    try {
      await this.initialize();
      await this.navigate(courtInfo.baseUrl);

      return {
        healthy: true,
        details: {
          courtId: this.courtId,
          baseUrl: courtInfo.baseUrl,
          sessionValid: !!this.currentSession?.isValid,
          metrics: this.metrics,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          courtId: this.courtId,
          error: String(error),
          metrics: this.metrics,
        },
      };
    } finally {
      await this.close();
    }
  }

  /**
   * Close the crawler
   */
  async close(): Promise<void> {
    if (this.page) {
      await this.page.close().catch(() => {});
      this.page = null;
    }

    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }

    if (this.browser) {
      await closeBrowser(this.browser);
      this.browser = null;
    }

    logger.info('Crawler closed', { courtId: this.courtId });
  }
}
