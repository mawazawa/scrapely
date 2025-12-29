/**
 * Camoufox Browser Launcher
 * Stealth Firefox browser for bypassing Cloudflare detection
 */

import type { Browser, Page, BrowserContext } from 'playwright';
import { logger } from '../lib/logger';
import { BrowserError, CourtScraperErrorCode } from './errors';
import { getRandomViewport, getRandomUserAgent, TIMEOUTS } from './crawlee.config';
import type { SessionData } from './types';

/**
 * Camoufox launch options
 */
export interface CamoufoxOptions {
  headless?: boolean;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
  timeout?: number;
  viewport?: { width: number; height: number };
  userAgent?: string;
  locale?: string;
  timezone?: string;
}

/**
 * Default Camoufox options
 */
const DEFAULT_OPTIONS: CamoufoxOptions = {
  headless: true,
  timeout: TIMEOUTS.navigation,
  locale: 'en-US',
  timezone: 'America/Los_Angeles',
};

/**
 * Launch Camoufox browser
 * Uses camoufox-js for stealth Firefox with anti-detection
 * See: https://github.com/apify/camoufox-js and https://camoufox.com/
 */
export async function launchCamoufox(options: CamoufoxOptions = {}): Promise<Browser> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    // Dynamic import of camoufox-js
    // The correct API is Camoufox() function, not launch()
    const { Camoufox } = await import('camoufox-js');

    // Build Camoufox options - see https://camoufox.com/ for full documentation
    const camoufoxOptions: Record<string, unknown> = {
      // Headless mode - 'new' for headless, false for headed
      headless: opts.headless ? 'new' : false,
    };

    // Add proxy configuration if specified
    if (opts.proxy) {
      camoufoxOptions.proxy = {
        server: opts.proxy.server,
        username: opts.proxy.username,
        password: opts.proxy.password,
      };
    }

    // Add locale for fingerprint consistency
    if (opts.locale) {
      camoufoxOptions.locale = opts.locale;
    }

    // Enable humanization features for more realistic behavior
    camoufoxOptions.humanize = true;

    const browser = await Camoufox(camoufoxOptions);

    logger.info('Camoufox browser launched', {
      headless: opts.headless,
      hasProxy: !!opts.proxy,
    });

    return browser as unknown as Browser;
  } catch (error) {
    logger.error('Failed to launch Camoufox', { error: String(error) });
    throw new BrowserError(
      `Failed to launch Camoufox: ${error}`,
      CourtScraperErrorCode.BROWSER_CRASH
    );
  }
}

/**
 * Create a new browser context with stealth settings
 */
export async function createStealthContext(
  browser: Browser,
  options: CamoufoxOptions = {}
): Promise<BrowserContext> {
  const viewport = options.viewport || getRandomViewport();
  const userAgent = options.userAgent || getRandomUserAgent();

  const context = await browser.newContext({
    viewport,
    userAgent,
    locale: options.locale || 'en-US',
    timezoneId: options.timezone || 'America/Los_Angeles',
    permissions: ['geolocation'],
    geolocation: { latitude: 37.7749, longitude: -122.4194 }, // San Francisco
    colorScheme: 'light',
    hasTouch: false,
    isMobile: false,
    javaScriptEnabled: true,
    bypassCSP: true,
    ignoreHTTPSErrors: true,
  });

  // Add stealth scripts to all pages
  await context.addInitScript(() => {
    // Hide webdriver
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // Mock permissions
    const originalQuery = Notification.permission;
    Object.defineProperty(Notification, 'permission', {
      get: () => originalQuery,
    });

    // Mock plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin' },
        { name: 'Chrome PDF Viewer' },
        { name: 'Native Client' },
      ],
    });

    // Mock languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });

    // Mock hardware concurrency
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => 8,
    });

    // Mock device memory
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => 8,
    });

    // Mock connection
    Object.defineProperty(navigator, 'connection', {
      get: () => ({
        effectiveType: '4g',
        rtt: 50,
        downlink: 10,
        saveData: false,
      }),
    });
  });

  logger.debug('Stealth context created', { viewport, userAgent });

  return context;
}

/**
 * Create a new page with stealth settings
 */
export async function createStealthPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();

  // Randomize page behavior
  await page.addInitScript(() => {
    // Override WebGL vendor
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter: number) {
      if (parameter === 37445) return 'Intel Inc.';
      if (parameter === 37446) return 'Intel Iris Pro Graphics';
      return getParameter.call(this, parameter);
    };

    // Mock canvas fingerprint
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type?: string) {
      if (type === 'image/webp') {
        return originalToDataURL.call(this, type);
      }
      // Add minimal noise to canvas
      const context = this.getContext('2d');
      if (context) {
        const imageData = context.getImageData(0, 0, this.width, this.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          data[i] ^= 1; // XOR with 1 for minimal noise
        }
        context.putImageData(imageData, 0, 0);
      }
      return originalToDataURL.call(this, type);
    };
  });

  return page;
}

/**
 * Load session data into a browser context
 */
export async function loadSession(
  context: BrowserContext,
  session: SessionData
): Promise<void> {
  if (!session.isValid || new Date() > session.expiresAt) {
    logger.warn('Session expired or invalid', { sessionId: session.id });
    return;
  }

  // Add cookies
  if (session.cookies && session.cookies.length > 0) {
    await context.addCookies(session.cookies as Parameters<BrowserContext['addCookies']>[0]);
    logger.debug('Session cookies loaded', { count: session.cookies.length });
  }

  // Add localStorage if available
  if (session.localStorage) {
    await context.addInitScript((storage: Record<string, string>) => {
      for (const [key, value] of Object.entries(storage)) {
        localStorage.setItem(key, value);
      }
    }, session.localStorage);
  }
}

/**
 * Save session data from a browser context
 */
export async function saveSession(
  context: BrowserContext,
  courtId: string,
  ttlHours: number = 24
): Promise<SessionData> {
  const cookies = await context.cookies();

  // Get localStorage from the first page
  let localStorage: Record<string, string> | undefined;
  const pages = context.pages();
  if (pages.length > 0) {
    try {
      localStorage = await pages[0].evaluate(() => {
        const storage: Record<string, string> = {};
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            const value = window.localStorage.getItem(key);
            if (value) storage[key] = value;
          }
        }
        return storage;
      });
    } catch {
      // Page might be closed
    }
  }

  const now = new Date();
  const session: SessionData = {
    id: crypto.randomUUID(),
    courtId,
    cookies: cookies as unknown as Record<string, string>[],
    localStorage,
    createdAt: now,
    expiresAt: new Date(now.getTime() + ttlHours * 60 * 60 * 1000),
    isValid: true,
  };

  logger.debug('Session saved', {
    sessionId: session.id,
    cookieCount: cookies.length,
    expiresAt: session.expiresAt.toISOString(),
  });

  return session;
}

/**
 * Wait for random time to simulate human behavior
 */
export async function humanDelay(minMs: number = 500, maxMs: number = 2000): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs)) + minMs;
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Simulate human-like mouse movement
 */
export async function humanMouseMove(page: Page): Promise<void> {
  const width = await page.evaluate(() => window.innerWidth);
  const height = await page.evaluate(() => window.innerHeight);

  const x = Math.floor(Math.random() * width);
  const y = Math.floor(Math.random() * height);

  await page.mouse.move(x, y, { steps: 10 + Math.floor(Math.random() * 20) });
}

/**
 * Simulate human-like scrolling
 */
export async function humanScroll(page: Page): Promise<void> {
  const scrollAmount = 100 + Math.floor(Math.random() * 300);
  await page.mouse.wheel(0, scrollAmount);
  await humanDelay(200, 500);
}

/**
 * Close browser safely
 */
export async function closeBrowser(browser: Browser): Promise<void> {
  try {
    await browser.close();
    logger.debug('Browser closed');
  } catch (error) {
    logger.warn('Error closing browser', { error: String(error) });
  }
}
