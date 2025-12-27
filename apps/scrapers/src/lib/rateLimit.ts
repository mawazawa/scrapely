/**
 * Per-user rate limiting
 * Implements sliding window rate limiting with KV storage
 */

import { logger } from './logger';

/**
 * Rate limit tier configuration
 */
export interface RateLimitTier {
  name: string;
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
}

/**
 * Default rate limit tiers
 */
export const RATE_LIMIT_TIERS: Record<string, RateLimitTier> = {
  free: {
    name: 'Free',
    requestsPerMinute: 20,
    requestsPerHour: 200,
    requestsPerDay: 1000,
  },
  pro: {
    name: 'Pro',
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    requestsPerDay: 10000,
  },
  enterprise: {
    name: 'Enterprise',
    requestsPerMinute: 200,
    requestsPerHour: 5000,
    requestsPerDay: 100000,
  },
  admin: {
    name: 'Admin',
    requestsPerMinute: Infinity,
    requestsPerHour: Infinity,
    requestsPerDay: Infinity,
  },
};

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
  retryAfter?: number;
  tier: string;
}

/**
 * Rate limit headers
 */
export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'X-RateLimit-Tier': string;
  'Retry-After'?: string;
}

/**
 * Sliding window rate limiter
 */
export class SlidingWindowRateLimiter {
  private kv: KVNamespace | undefined;
  private prefix: string;

  constructor(kv: KVNamespace | undefined, prefix: string = 'ratelimit') {
    this.kv = kv;
    this.prefix = prefix;
  }

  /**
   * Check and update rate limit for a user
   */
  async checkLimit(
    userId: string,
    tier: string = 'free',
    window: 'minute' | 'hour' | 'day' = 'minute'
  ): Promise<RateLimitResult> {
    const tierConfig = RATE_LIMIT_TIERS[tier] || RATE_LIMIT_TIERS.free;

    // Admin bypass
    if (tier === 'admin') {
      return {
        allowed: true,
        remaining: Infinity,
        reset: 0,
        tier: 'admin',
      };
    }

    const limit = this.getLimitForWindow(tierConfig, window);
    const windowMs = this.getWindowMs(window);
    const now = Date.now();
    const windowStart = now - windowMs;

    const key = `${this.prefix}:${userId}:${window}`;

    if (!this.kv) {
      // No KV, allow but log warning
      logger.warn('Rate limiter running without KV');
      return {
        allowed: true,
        remaining: limit,
        reset: now + windowMs,
        tier,
      };
    }

    try {
      // Get current window data
      const data = await this.kv.get<{ timestamps: number[] }>(key, 'json');
      let timestamps = data?.timestamps || [];

      // Filter to current window only
      timestamps = timestamps.filter(ts => ts > windowStart);

      // Check if limit exceeded
      if (timestamps.length >= limit) {
        const oldestInWindow = Math.min(...timestamps);
        const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000);

        return {
          allowed: false,
          remaining: 0,
          reset: oldestInWindow + windowMs,
          retryAfter,
          tier,
        };
      }

      // Add current request timestamp
      timestamps.push(now);

      // Store updated timestamps
      await this.kv.put(key, JSON.stringify({ timestamps }), {
        expirationTtl: Math.ceil(windowMs / 1000) + 60, // Extra minute buffer
      });

      return {
        allowed: true,
        remaining: limit - timestamps.length,
        reset: now + windowMs,
        tier,
      };
    } catch (error) {
      logger.error('Rate limit check failed', { error: String(error) });
      // Fail open
      return {
        allowed: true,
        remaining: limit,
        reset: now + windowMs,
        tier,
      };
    }
  }

  /**
   * Get limit for window type
   */
  private getLimitForWindow(tier: RateLimitTier, window: 'minute' | 'hour' | 'day'): number {
    switch (window) {
      case 'minute':
        return tier.requestsPerMinute;
      case 'hour':
        return tier.requestsPerHour;
      case 'day':
        return tier.requestsPerDay;
    }
  }

  /**
   * Get window duration in milliseconds
   */
  private getWindowMs(window: 'minute' | 'hour' | 'day'): number {
    switch (window) {
      case 'minute':
        return 60 * 1000;
      case 'hour':
        return 60 * 60 * 1000;
      case 'day':
        return 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Get current usage for a user
   */
  async getUsage(userId: string): Promise<{
    minute: number;
    hour: number;
    day: number;
  }> {
    if (!this.kv) {
      return { minute: 0, hour: 0, day: 0 };
    }

    const now = Date.now();
    const usage = { minute: 0, hour: 0, day: 0 };

    for (const window of ['minute', 'hour', 'day'] as const) {
      const key = `${this.prefix}:${userId}:${window}`;
      const data = await this.kv.get<{ timestamps: number[] }>(key, 'json');

      if (data?.timestamps) {
        const windowMs = this.getWindowMs(window);
        const windowStart = now - windowMs;
        usage[window] = data.timestamps.filter(ts => ts > windowStart).length;
      }
    }

    return usage;
  }

  /**
   * Reset rate limit for a user
   */
  async reset(userId: string): Promise<void> {
    if (!this.kv) return;

    for (const window of ['minute', 'hour', 'day']) {
      await this.kv.delete(`${this.prefix}:${userId}:${window}`);
    }

    logger.info('Rate limit reset', { userId });
  }
}

/**
 * Create rate limit headers from result
 */
export function createRateLimitHeaders(result: RateLimitResult): RateLimitHeaders {
  const headers: RateLimitHeaders = {
    'X-RateLimit-Limit': String(RATE_LIMIT_TIERS[result.tier]?.requestsPerMinute || 20),
    'X-RateLimit-Remaining': String(result.remaining === Infinity ? 'unlimited' : result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.reset / 1000)),
    'X-RateLimit-Tier': result.tier,
  };

  if (result.retryAfter) {
    headers['Retry-After'] = String(result.retryAfter);
  }

  return headers;
}

/**
 * Rate limit middleware for Hono
 */
export function rateLimitMiddleware(
  kv: KVNamespace | undefined,
  getTier: (userId: string) => Promise<string> = async () => 'free'
) {
  const limiter = new SlidingWindowRateLimiter(kv);

  return async (c: { req: Request; header: (name: string, value: string) => void; json: (body: unknown, status?: number) => Response }, next: () => Promise<void>) => {
    // Extract user ID from request
    const userId = getUserIdFromRequest(c.req);
    const tier = await getTier(userId);

    // Check rate limit
    const result = await limiter.checkLimit(userId, tier, 'minute');

    // Add rate limit headers
    const headers = createRateLimitHeaders(result);
    Object.entries(headers).forEach(([name, value]) => {
      c.header(name, value);
    });

    if (!result.allowed) {
      return c.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: result.retryAfter,
          tier: result.tier,
        },
        429
      );
    }

    await next();
  };
}

/**
 * Extract user ID from request
 */
function getUserIdFromRequest(req: Request): string {
  // Check for API key
  const apiKey = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (apiKey) {
    return `api:${apiKey.slice(0, 16)}`;
  }

  // Check for user cookie
  const cookies = req.headers.get('Cookie') || '';
  const userMatch = cookies.match(/meridian_user=([^;]+)/);
  if (userMatch) {
    return `user:${userMatch[1]}`;
  }

  // Fall back to IP-based
  const ip = req.headers.get('CF-Connecting-IP') ||
    req.headers.get('X-Forwarded-For')?.split(',')[0] ||
    'unknown';
  return `ip:${ip}`;
}
