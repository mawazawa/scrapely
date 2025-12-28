/**
 * Rate Limiting
 * Rate limiting for court scraping operations
 */

import { logger } from '../lib/logger';
import { RateLimitError } from './errors';
import type { RateLimitInfo } from './types';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  maxRequestsPerWindow: number;
  windowSizeMs: number;
  minDelayMs: number;
  burstLimit?: number;
}

/**
 * Default rate limits for court domains
 */
export const COURT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // San Francisco Superior Court
  'sf.courts.ca.gov': {
    maxRequestsPerWindow: 1,
    windowSizeMs: 60000,  // 1 request per minute
    minDelayMs: 5000,
  },

  // Los Angeles Superior Court
  'www.lacourt.org': {
    maxRequestsPerWindow: 2,
    windowSizeMs: 60000,  // 2 requests per minute
    minDelayMs: 3000,
  },

  // California Courts (general)
  'www.courts.ca.gov': {
    maxRequestsPerWindow: 5,
    windowSizeMs: 60000,
    minDelayMs: 2000,
  },

  // Default for unknown courts
  default: {
    maxRequestsPerWindow: 1,
    windowSizeMs: 60000,
    minDelayMs: 10000,  // Very conservative default
  },
};

/**
 * In-memory rate limiter for court scraping
 */
export class CourtRateLimiter {
  private limits: Map<string, RateLimitInfo> = new Map();
  private config: Map<string, RateLimitConfig> = new Map();

  constructor(customConfigs?: Record<string, RateLimitConfig>) {
    // Initialize with default configs
    for (const [domain, config] of Object.entries(COURT_RATE_LIMITS)) {
      this.config.set(domain, config);
    }

    // Override with custom configs
    if (customConfigs) {
      for (const [domain, config] of Object.entries(customConfigs)) {
        this.config.set(domain, config);
      }
    }
  }

  /**
   * Get rate limit config for a domain
   */
  private getConfig(domain: string): RateLimitConfig {
    return this.config.get(domain) || this.config.get('default') || COURT_RATE_LIMITS.default;
  }

  /**
   * Get rate limit info for a domain
   */
  private getInfo(domain: string): RateLimitInfo {
    let info = this.limits.get(domain);
    const config = this.getConfig(domain);

    if (!info) {
      info = {
        domain,
        requestCount: 0,
        windowStart: new Date(),
        isBlocked: false,
        nextAllowedRequest: new Date(),
        maxRequestsPerWindow: config.maxRequestsPerWindow,
        windowSizeMs: config.windowSizeMs,
      };
      this.limits.set(domain, info);
    }

    // Reset window if expired
    const now = Date.now();
    if (now - info.windowStart.getTime() >= config.windowSizeMs) {
      info.windowStart = new Date();
      info.requestCount = 0;
      info.isBlocked = false;
    }

    return info;
  }

  /**
   * Check if a request is allowed
   */
  canRequest(domain: string): boolean {
    const info = this.getInfo(domain);
    const config = this.getConfig(domain);

    if (info.isBlocked) {
      return false;
    }

    if (info.requestCount >= config.maxRequestsPerWindow) {
      return false;
    }

    if (Date.now() < info.nextAllowedRequest.getTime()) {
      return false;
    }

    return true;
  }

  /**
   * Record a request
   */
  recordRequest(domain: string): void {
    const info = this.getInfo(domain);
    const config = this.getConfig(domain);

    info.requestCount++;
    info.nextAllowedRequest = new Date(Date.now() + config.minDelayMs);

    logger.debug('Rate limit: Request recorded', {
      domain,
      requestCount: info.requestCount,
      maxRequests: config.maxRequestsPerWindow,
      nextAllowed: info.nextAllowedRequest.toISOString(),
    });
  }

  /**
   * Wait until a request is allowed
   */
  async waitForSlot(domain: string): Promise<void> {
    const config = this.getConfig(domain);

    while (!this.canRequest(domain)) {
      const info = this.getInfo(domain);
      const waitTime = Math.max(
        info.nextAllowedRequest.getTime() - Date.now(),
        config.minDelayMs
      );

      // Check if we need to wait for window reset
      const windowResetTime = info.windowStart.getTime() + config.windowSizeMs - Date.now();
      if (info.requestCount >= config.maxRequestsPerWindow && windowResetTime > 0) {
        const actualWait = Math.max(waitTime, windowResetTime);

        logger.info('Rate limit: Waiting for window reset', {
          domain,
          waitTime: actualWait,
          requestCount: info.requestCount,
        });

        await new Promise(resolve => setTimeout(resolve, actualWait + 100));
      } else {
        logger.debug('Rate limit: Waiting for slot', {
          domain,
          waitTime,
        });

        await new Promise(resolve => setTimeout(resolve, waitTime + 100));
      }
    }

    this.recordRequest(domain);
  }

  /**
   * Check remaining requests in current window
   */
  getRemainingRequests(domain: string): number {
    const info = this.getInfo(domain);
    return Math.max(0, info.maxRequestsPerWindow - info.requestCount);
  }

  /**
   * Get time until window resets
   */
  getTimeUntilReset(domain: string): number {
    const info = this.getInfo(domain);
    const resetTime = info.windowStart.getTime() + info.windowSizeMs;
    return Math.max(0, resetTime - Date.now());
  }

  /**
   * Mark domain as blocked (e.g., after receiving 429)
   */
  markBlocked(domain: string, blockDurationMs: number = 300000): void {
    const info = this.getInfo(domain);
    info.isBlocked = true;
    info.nextAllowedRequest = new Date(Date.now() + blockDurationMs);

    logger.warn('Rate limit: Domain blocked', {
      domain,
      blockDuration: blockDurationMs,
      unblockAt: info.nextAllowedRequest.toISOString(),
    });
  }

  /**
   * Unblock a domain
   */
  unblock(domain: string): void {
    const info = this.limits.get(domain);
    if (info) {
      info.isBlocked = false;
    }
  }

  /**
   * Get rate limit status for a domain
   */
  getStatus(domain: string): RateLimitInfo {
    return { ...this.getInfo(domain) };
  }

  /**
   * Get all rate limit statuses
   */
  getAllStatuses(): RateLimitInfo[] {
    return Array.from(this.limits.values()).map(info => ({ ...info }));
  }

  /**
   * Clear rate limit state for a domain
   */
  clear(domain: string): void {
    this.limits.delete(domain);
  }

  /**
   * Clear all rate limit state
   */
  clearAll(): void {
    this.limits.clear();
  }
}

/**
 * Distributed rate limiter using KV storage
 */
export class DistributedRateLimiter {
  private kv: KVNamespace;
  private localLimiter: CourtRateLimiter;
  private prefix: string;

  constructor(kv: KVNamespace, prefix: string = 'rate_limit:') {
    this.kv = kv;
    this.prefix = prefix;
    this.localLimiter = new CourtRateLimiter();
  }

  /**
   * Check and record a request (atomic operation)
   */
  async checkAndRecord(domain: string): Promise<{ allowed: boolean; retryAfterMs?: number }> {
    const config = this.localLimiter['getConfig'](domain);
    const key = `${this.prefix}${domain}`;

    // Get current state from KV
    const stored = await this.kv.get<RateLimitInfo>(key, 'json');
    const now = Date.now();

    let info: RateLimitInfo;

    if (!stored || now - new Date(stored.windowStart).getTime() >= config.windowSizeMs) {
      // New window
      info = {
        domain,
        requestCount: 1,
        windowStart: new Date(),
        isBlocked: false,
        nextAllowedRequest: new Date(now + config.minDelayMs),
        maxRequestsPerWindow: config.maxRequestsPerWindow,
        windowSizeMs: config.windowSizeMs,
      };
    } else {
      info = {
        ...stored,
        windowStart: new Date(stored.windowStart),
        nextAllowedRequest: new Date(stored.nextAllowedRequest),
      };

      // Check if request is allowed
      if (info.requestCount >= config.maxRequestsPerWindow) {
        const retryAfterMs = info.windowStart.getTime() + config.windowSizeMs - now;
        return { allowed: false, retryAfterMs };
      }

      if (now < info.nextAllowedRequest.getTime()) {
        const retryAfterMs = info.nextAllowedRequest.getTime() - now;
        return { allowed: false, retryAfterMs };
      }

      // Increment counter
      info.requestCount++;
      info.nextAllowedRequest = new Date(now + config.minDelayMs);
    }

    // Save to KV with TTL
    await this.kv.put(key, JSON.stringify(info), {
      expirationTtl: Math.ceil(config.windowSizeMs / 1000) + 60,
    });

    return { allowed: true };
  }

  /**
   * Wait until a request is allowed
   */
  async waitForSlot(domain: string): Promise<void> {
    let result = await this.checkAndRecord(domain);

    while (!result.allowed) {
      const waitTime = result.retryAfterMs || 5000;

      logger.debug('Distributed rate limit: Waiting', {
        domain,
        waitTime,
      });

      await new Promise(resolve => setTimeout(resolve, waitTime + 100));
      result = await this.checkAndRecord(domain);
    }
  }

  /**
   * Mark domain as blocked
   */
  async markBlocked(domain: string, durationMs: number = 300000): Promise<void> {
    const key = `${this.prefix}${domain}:blocked`;
    await this.kv.put(key, 'true', {
      expirationTtl: Math.ceil(durationMs / 1000),
    });
  }

  /**
   * Check if domain is blocked
   */
  async isBlocked(domain: string): Promise<boolean> {
    const key = `${this.prefix}${domain}:blocked`;
    const blocked = await this.kv.get(key);
    return blocked === 'true';
  }
}

/**
 * Create rate limiter instance
 */
export function createRateLimiter(customConfigs?: Record<string, RateLimitConfig>): CourtRateLimiter {
  return new CourtRateLimiter(customConfigs);
}

/**
 * Create distributed rate limiter
 */
export function createDistributedRateLimiter(kv: KVNamespace): DistributedRateLimiter {
  return new DistributedRateLimiter(kv);
}
