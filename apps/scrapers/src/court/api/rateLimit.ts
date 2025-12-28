/**
 * API Rate Limiting
 * Rate limit enforcement for the public court API
 */

import { logger } from '../../lib/logger';
import type { ApiKey } from './apiKeys';

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

/**
 * Rate limit state
 */
interface RateLimitState {
  minuteCount: number;
  minuteReset: number;
  dayCount: number;
  dayReset: number;
}

/**
 * API Rate Limiter using KV
 */
export class ApiRateLimiter {
  private kv: KVNamespace;
  private prefix: string;

  constructor(kv: KVNamespace, prefix: string = 'rate_limit:') {
    this.kv = kv;
    this.prefix = prefix;
  }

  /**
   * Check and update rate limit
   */
  async checkLimit(apiKey: ApiKey): Promise<RateLimitResult> {
    const key = `${this.prefix}${apiKey.id}`;
    const now = Date.now();

    // Get current state
    let state = await this.getState(key);

    // Reset minute counter if needed
    if (now > state.minuteReset) {
      state.minuteCount = 0;
      state.minuteReset = now + 60000;  // 1 minute
    }

    // Reset day counter if needed
    if (now > state.dayReset) {
      state.dayCount = 0;
      state.dayReset = now + 86400000;  // 24 hours
    }

    // Check limits
    const { requestsPerMinute, requestsPerDay } = apiKey.rateLimit;

    if (state.minuteCount >= requestsPerMinute) {
      const retryAfter = Math.ceil((state.minuteReset - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        reset: state.minuteReset,
        retryAfter,
      };
    }

    if (state.dayCount >= requestsPerDay) {
      const retryAfter = Math.ceil((state.dayReset - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        reset: state.dayReset,
        retryAfter,
      };
    }

    // Increment counters
    state.minuteCount++;
    state.dayCount++;

    // Save state
    await this.saveState(key, state);

    const remaining = Math.min(
      requestsPerMinute - state.minuteCount,
      requestsPerDay - state.dayCount
    );

    return {
      allowed: true,
      remaining,
      reset: state.minuteReset,
    };
  }

  /**
   * Get current rate limit state
   */
  private async getState(key: string): Promise<RateLimitState> {
    const data = await this.kv.get(key, 'json');

    if (!data) {
      const now = Date.now();
      return {
        minuteCount: 0,
        minuteReset: now + 60000,
        dayCount: 0,
        dayReset: now + 86400000,
      };
    }

    return data as RateLimitState;
  }

  /**
   * Save rate limit state
   */
  private async saveState(key: string, state: RateLimitState): Promise<void> {
    // Set TTL to day reset time plus a buffer
    const ttl = Math.ceil((state.dayReset - Date.now()) / 1000) + 3600;

    await this.kv.put(key, JSON.stringify(state), {
      expirationTtl: ttl,
    });
  }

  /**
   * Get rate limit headers
   */
  getHeaders(result: RateLimitResult, apiKey: ApiKey): Record<string, string> {
    return {
      'X-RateLimit-Limit': apiKey.rateLimit.requestsPerMinute.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': Math.floor(result.reset / 1000).toString(),
      ...(result.retryAfter && { 'Retry-After': result.retryAfter.toString() }),
    };
  }

  /**
   * Get usage stats for an API key
   */
  async getUsageStats(
    apiKeyId: string
  ): Promise<{ minuteUsage: number; dayUsage: number }> {
    const key = `${this.prefix}${apiKeyId}`;
    const state = await this.getState(key);

    return {
      minuteUsage: state.minuteCount,
      dayUsage: state.dayCount,
    };
  }

  /**
   * Reset rate limit for an API key (admin use)
   */
  async resetLimit(apiKeyId: string): Promise<void> {
    const key = `${this.prefix}${apiKeyId}`;
    await this.kv.delete(key);

    logger.info('Rate limit reset', { apiKeyId });
  }
}

/**
 * Create rate limiter
 */
export function createApiRateLimiter(kv: KVNamespace): ApiRateLimiter {
  return new ApiRateLimiter(kv);
}

/**
 * Rate limit middleware for Hono
 */
export function rateLimitMiddleware(rateLimiter: ApiRateLimiter, apiKey: ApiKey) {
  return async (c: { header: (key: string, value: string) => void }, next: () => Promise<void>) => {
    const result = await rateLimiter.checkLimit(apiKey);
    const headers = rateLimiter.getHeaders(result, apiKey);

    // Add headers to response
    for (const [key, value] of Object.entries(headers)) {
      c.header(key, value);
    }

    if (!result.allowed) {
      throw new Error('Rate limit exceeded');
    }

    await next();
  };
}
