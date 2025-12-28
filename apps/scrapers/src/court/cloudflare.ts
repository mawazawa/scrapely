/**
 * Cloudflare Challenge Handler
 * Handles Cloudflare Turnstile and other challenge pages
 */

import type { Page, BrowserContext } from 'playwright';
import { logger } from '../lib/logger';
import { CloudflareError, CourtScraperError, CourtScraperErrorCode } from './errors';
import { humanDelay, humanMouseMove } from './camoufox';
import { TIMEOUTS } from './crawlee.config';
import type { CloudflareResult } from './types';

/**
 * Cloudflare challenge detection selectors
 */
const CLOUDFLARE_SELECTORS = {
  // Challenge page indicators
  challengePage: [
    '#challenge-running',
    '#challenge-stage',
    '.cf-browser-verification',
    '#cf-challenge-running',
    '#challenge-form',
  ],

  // Turnstile widget
  turnstile: [
    'iframe[src*="challenges.cloudflare.com"]',
    '.cf-turnstile',
    '#cf-turnstile',
    '[data-sitekey]',
  ],

  // Success indicators
  success: [
    '#challenge-success',
    '.challenge-success',
  ],

  // Blocked indicators
  blocked: [
    '#cf-error-details',
    '.cf-error-code',
    'h1:has-text("Access denied")',
    'h1:has-text("Sorry, you have been blocked")',
  ],
};

/**
 * Detect if page has a Cloudflare challenge
 */
export async function detectCloudflareChallenge(page: Page): Promise<{
  hasChallenge: boolean;
  challengeType: 'turnstile' | 'managed' | 'js_challenge' | 'none';
  isBlocked: boolean;
}> {
  const url = page.url();
  const title = await page.title();

  // Check URL patterns
  if (url.includes('challenges.cloudflare.com')) {
    return { hasChallenge: true, challengeType: 'turnstile', isBlocked: false };
  }

  // Check title
  if (title.includes('Just a moment') || title.includes('Checking your browser')) {
    // Determine challenge type
    const hasTurnstile = await page.locator(CLOUDFLARE_SELECTORS.turnstile.join(', ')).count() > 0;
    return {
      hasChallenge: true,
      challengeType: hasTurnstile ? 'turnstile' : 'js_challenge',
      isBlocked: false,
    };
  }

  // Check for challenge elements
  const hasChallengeElement = await page.locator(CLOUDFLARE_SELECTORS.challengePage.join(', ')).count() > 0;
  if (hasChallengeElement) {
    const hasTurnstile = await page.locator(CLOUDFLARE_SELECTORS.turnstile.join(', ')).count() > 0;
    return {
      hasChallenge: true,
      challengeType: hasTurnstile ? 'turnstile' : 'managed',
      isBlocked: false,
    };
  }

  // Check for blocked page
  const isBlocked = await page.locator(CLOUDFLARE_SELECTORS.blocked.join(', ')).count() > 0;
  if (isBlocked) {
    return { hasChallenge: false, challengeType: 'none', isBlocked: true };
  }

  return { hasChallenge: false, challengeType: 'none', isBlocked: false };
}

/**
 * Wait for Cloudflare challenge to be solved
 */
export async function waitForChallengeResolution(
  page: Page,
  timeout: number = TIMEOUTS.cloudflare
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const { hasChallenge, isBlocked } = await detectCloudflareChallenge(page);

    if (isBlocked) {
      throw new CloudflareError('Blocked by Cloudflare', 'managed');
    }

    if (!hasChallenge) {
      return true;
    }

    // Add human-like behavior while waiting
    await humanMouseMove(page);
    await humanDelay(500, 1500);
  }

  return false;
}

/**
 * Handle Cloudflare Turnstile challenge
 * Attempts to solve the challenge automatically using stealth browser
 */
export async function handleTurnstileChallenge(page: Page): Promise<boolean> {
  logger.info('Attempting to solve Turnstile challenge');

  try {
    // Wait for Turnstile iframe to load
    const turnstileFrame = await page.waitForSelector(
      CLOUDFLARE_SELECTORS.turnstile.join(', '),
      { timeout: 10000 }
    );

    if (!turnstileFrame) {
      logger.warn('Turnstile iframe not found');
      return false;
    }

    // The Camoufox browser should handle Turnstile automatically
    // Just wait for the challenge to complete
    await humanDelay(2000, 4000);

    // Check if challenge was solved
    const solved = await waitForChallengeResolution(page, 30000);

    if (solved) {
      logger.info('Turnstile challenge solved');
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Failed to handle Turnstile challenge', { error: String(error) });
    return false;
  }
}

/**
 * Handle Cloudflare managed challenge (JavaScript challenge)
 */
export async function handleManagedChallenge(page: Page): Promise<boolean> {
  logger.info('Attempting to solve managed challenge');

  try {
    // Managed challenges usually resolve automatically with a proper browser
    // Add some human-like behavior
    await humanMouseMove(page);
    await humanDelay(1000, 2000);

    // Wait for challenge resolution
    const solved = await waitForChallengeResolution(page, 30000);

    if (solved) {
      logger.info('Managed challenge solved');
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Failed to handle managed challenge', { error: String(error) });
    return false;
  }
}

/**
 * Main Cloudflare challenge handler
 * Detects and handles all types of Cloudflare challenges
 */
export async function handleCloudflareChallenge(
  page: Page,
  maxAttempts: number = 3
): Promise<CloudflareResult> {
  const startTime = Date.now();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    logger.info('Checking for Cloudflare challenge', { attempt, maxAttempts });

    const detection = await detectCloudflareChallenge(page);

    // No challenge detected
    if (!detection.hasChallenge && !detection.isBlocked) {
      const cookies = await page.context().cookies();
      return {
        success: true,
        cookies: cookies as unknown as Record<string, string>[],
        userAgent: await page.evaluate(() => navigator.userAgent),
        duration: Date.now() - startTime,
      };
    }

    // Blocked
    if (detection.isBlocked) {
      return {
        success: false,
        cookies: [],
        userAgent: await page.evaluate(() => navigator.userAgent),
        challengeType: 'managed',
        duration: Date.now() - startTime,
        error: 'Blocked by Cloudflare',
      };
    }

    // Handle challenge based on type
    let solved = false;

    switch (detection.challengeType) {
      case 'turnstile':
        solved = await handleTurnstileChallenge(page);
        break;
      case 'managed':
      case 'js_challenge':
        solved = await handleManagedChallenge(page);
        break;
    }

    if (solved) {
      const cookies = await page.context().cookies();
      return {
        success: true,
        cookies: cookies as unknown as Record<string, string>[],
        userAgent: await page.evaluate(() => navigator.userAgent),
        challengeType: detection.challengeType,
        duration: Date.now() - startTime,
      };
    }

    // Wait before retry
    if (attempt < maxAttempts) {
      await humanDelay(2000, 5000);
      await page.reload();
    }
  }

  return {
    success: false,
    cookies: [],
    userAgent: await page.evaluate(() => navigator.userAgent),
    duration: Date.now() - startTime,
    error: `Failed to solve Cloudflare challenge after ${maxAttempts} attempts`,
  };
}

/**
 * Navigate to URL and handle any Cloudflare challenges
 */
export async function navigateWithCloudflareBypass(
  page: Page,
  url: string,
  options: {
    timeout?: number;
    maxAttempts?: number;
    waitForSelector?: string;
  } = {}
): Promise<CloudflareResult> {
  const { timeout = TIMEOUTS.navigation, maxAttempts = 3, waitForSelector } = options;
  const startTime = Date.now();

  try {
    // Navigate to the URL
    await page.goto(url, {
      timeout,
      waitUntil: 'domcontentloaded',
    });

    // Handle any Cloudflare challenge
    const result = await handleCloudflareChallenge(page, maxAttempts);

    if (!result.success) {
      throw new CloudflareError(
        result.error || 'Failed to bypass Cloudflare',
        result.challengeType || 'unknown'
      );
    }

    // Wait for specific selector if provided
    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, {
        timeout: 30000,
      });
    }

    return {
      ...result,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    if (error instanceof CourtScraperError) {
      throw error;
    }

    throw new CourtScraperError(
      `Navigation failed: ${error}`,
      CourtScraperErrorCode.PAGE_LOAD_ERROR,
      { context: { url } }
    );
  }
}

/**
 * Extract Cloudflare cookies for session persistence
 */
export function extractCloudflareCookies(
  cookies: Record<string, string>[]
): Record<string, string>[] {
  const cfCookieNames = [
    'cf_clearance',
    '__cf_bm',
    'cf_chl_2',
    'cf_chl_prog',
    'cf_chl_rc_i',
    'cf_chl_rc_ni',
  ];

  return cookies.filter(cookie =>
    'name' in cookie && cfCookieNames.some(name =>
      (cookie as unknown as { name: string }).name.startsWith(name)
    )
  );
}

/**
 * Check if Cloudflare cookies are still valid
 */
export function areCloudflareCookiesValid(cookies: Record<string, string>[]): boolean {
  const cfClearance = cookies.find(c =>
    'name' in c && (c as unknown as { name: string }).name === 'cf_clearance'
  );

  if (!cfClearance || !('expires' in cfClearance)) {
    return false;
  }

  const expiresAt = (cfClearance as unknown as { expires: number }).expires * 1000;
  return Date.now() < expiresAt;
}
