/**
 * Crawlee Configuration
 * Configuration for Crawlee web scraping framework
 */

import type { PlaywrightCrawlerOptions } from '@crawlee/playwright';
import type { CrawlerConfig } from './types';
import { DEFAULT_CRAWLER_CONFIG } from './types';

/**
 * Court-specific user agents (realistic browser fingerprints)
 */
export const USER_AGENTS = {
  chrome_windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  chrome_mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  firefox_windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  firefox_mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0',
  safari_mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
};

/**
 * Default Playwright launch options for stealth
 */
export const STEALTH_LAUNCH_OPTIONS = {
  args: [
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
  ],
  ignoreDefaultArgs: ['--enable-automation'],
};

/**
 * Create Playwright crawler options for court scraping
 */
export function createPlaywrightCrawlerOptions(
  config: Partial<CrawlerConfig> = {}
): Partial<PlaywrightCrawlerOptions> {
  const mergedConfig = { ...DEFAULT_CRAWLER_CONFIG, ...config };

  return {
    maxConcurrency: mergedConfig.maxConcurrency,
    maxRequestsPerMinute: mergedConfig.maxRequestsPerMinute,
    requestHandlerTimeoutSecs: Math.ceil(mergedConfig.requestTimeout / 1000),
    maxRequestRetries: mergedConfig.retryCount,
    headless: mergedConfig.headless,

    // Browser launch options
    launchContext: {
      launchOptions: STEALTH_LAUNCH_OPTIONS,
      useChrome: false,  // Use Firefox via Camoufox for better stealth
    },

    // Request options
    browserPoolOptions: {
      retireBrowserAfterPageCount: 10,
      maxOpenPagesPerBrowser: 1,
    },

    // Pre-navigation hooks
    preNavigationHooks: [
      async ({ page }) => {
        // Randomize viewport
        const width = 1280 + Math.floor(Math.random() * 200);
        const height = 720 + Math.floor(Math.random() * 200);
        await page.setViewportSize({ width, height });

        // Add stealth scripts
        await page.addInitScript(() => {
          // Override webdriver detection
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
          });

          // Override plugins
          Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
          });

          // Override languages
          Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
          });

          // Chrome-specific overrides
          (window as unknown as { chrome: unknown }).chrome = {
            runtime: {},
          };
        });
      },
    ],

    // Navigation options
    navigationTimeoutSecs: Math.ceil(mergedConfig.requestTimeout / 1000),
  };
}

/**
 * Court-specific crawler configuration
 */
export const COURT_CRAWLER_CONFIGS: Record<string, Partial<CrawlerConfig>> = {
  'sf-superior': {
    maxConcurrency: 1,
    maxRequestsPerMinute: 1,  // Very conservative for court sites
    requestTimeout: 90000,     // Courts are slow
    retryCount: 3,
    retryDelayMs: 10000,       // Long delay between retries
    sessionPersistence: true,
    headless: true,
  },
  'la-superior': {
    maxConcurrency: 1,
    maxRequestsPerMinute: 2,
    requestTimeout: 60000,
    retryCount: 3,
    retryDelayMs: 8000,
    sessionPersistence: true,
    headless: true,
  },
};

/**
 * Get crawler configuration for a specific court
 */
export function getCourtCrawlerConfig(courtId: string): CrawlerConfig {
  const courtConfig = COURT_CRAWLER_CONFIGS[courtId] || {};
  return { ...DEFAULT_CRAWLER_CONFIG, ...courtConfig };
}

/**
 * Viewport configurations for realistic browsing
 */
export const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
];

/**
 * Get a random viewport
 */
export function getRandomViewport(): { width: number; height: number } {
  return VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];
}

/**
 * Get a random user agent
 */
export function getRandomUserAgent(): string {
  const agents = Object.values(USER_AGENTS);
  return agents[Math.floor(Math.random() * agents.length)];
}

/**
 * Navigation wait options
 */
export const WAIT_OPTIONS = {
  domContentLoaded: { waitUntil: 'domcontentloaded' as const },
  networkIdle: { waitUntil: 'networkidle' as const },
  load: { waitUntil: 'load' as const },
};

/**
 * Default timeouts
 */
export const TIMEOUTS = {
  navigation: 60000,
  element: 30000,
  cloudflare: 45000,
  shortWait: 1000,
  mediumWait: 3000,
  longWait: 5000,
};
