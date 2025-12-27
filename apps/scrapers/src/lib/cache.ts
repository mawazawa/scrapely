/**
 * KV Caching utilities for Meridian
 * Provides edge caching with TTL support
 *
 * @see https://developers.cloudflare.com/kv/
 */

import { logger } from './logger';

/**
 * Cache key prefixes for different data types
 */
export const CACHE_KEYS = {
  STATS: 'stats',
  REPORTS: 'reports',
  REPORT_DETAIL: 'report',
  SOURCES: 'sources',
  EVENTS: 'events',
} as const;

/**
 * Default TTL values (in seconds)
 */
export const TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 900, // 15 minutes
  HOUR: 3600, // 1 hour
  DAY: 86400, // 24 hours
} as const;

/**
 * Cache options for storing values
 */
interface CacheOptions {
  /** TTL in seconds */
  ttl?: number;
  /** Metadata to store with the value */
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Cache result with metadata
 */
interface CacheResult<T> {
  value: T | null;
  metadata: Record<string, string | number | boolean> | null;
  hit: boolean;
}

/**
 * Build a cache key with prefix
 */
export function buildCacheKey(prefix: keyof typeof CACHE_KEYS, ...parts: (string | number)[]): string {
  return [CACHE_KEYS[prefix], ...parts].join(':');
}

/**
 * Get a value from cache
 */
export async function cacheGet<T>(kv: KVNamespace | undefined, key: string): Promise<CacheResult<T>> {
  if (!kv) {
    return { value: null, metadata: null, hit: false };
  }

  const startTime = performance.now();

  try {
    const { value, metadata } = await kv.getWithMetadata<T>(key, { type: 'json' });

    const duration = performance.now() - startTime;
    const hit = value !== null;

    logger.info(`Cache ${hit ? 'HIT' : 'MISS'}`, {
      key,
      hit,
      durationMs: Math.round(duration),
    });

    return {
      value,
      metadata: metadata as Record<string, string | number | boolean> | null,
      hit,
    };
  } catch (error) {
    logger.error('Cache GET error', { key, error: String(error) });
    return { value: null, metadata: null, hit: false };
  }
}

/**
 * Set a value in cache
 */
export async function cacheSet<T>(
  kv: KVNamespace | undefined,
  key: string,
  value: T,
  options: CacheOptions = {}
): Promise<boolean> {
  if (!kv) {
    return false;
  }

  const { ttl = TTL.MEDIUM, metadata } = options;

  try {
    await kv.put(key, JSON.stringify(value), {
      expirationTtl: ttl,
      metadata: {
        ...metadata,
        cachedAt: Date.now(),
      },
    });

    logger.info('Cache SET', { key, ttl });
    return true;
  } catch (error) {
    logger.error('Cache SET error', { key, error: String(error) });
    return false;
  }
}

/**
 * Delete a value from cache
 */
export async function cacheDelete(kv: KVNamespace | undefined, key: string): Promise<boolean> {
  if (!kv) {
    return false;
  }

  try {
    await kv.delete(key);
    logger.info('Cache DELETE', { key });
    return true;
  } catch (error) {
    logger.error('Cache DELETE error', { key, error: String(error) });
    return false;
  }
}

/**
 * Invalidate all keys with a specific prefix
 */
export async function cacheInvalidatePrefix(kv: KVNamespace | undefined, prefix: string): Promise<number> {
  if (!kv) {
    return 0;
  }

  try {
    const list = await kv.list({ prefix });
    let deleted = 0;

    for (const key of list.keys) {
      await kv.delete(key.name);
      deleted++;
    }

    logger.info('Cache INVALIDATE prefix', { prefix, deleted });
    return deleted;
  } catch (error) {
    logger.error('Cache INVALIDATE error', { prefix, error: String(error) });
    return 0;
  }
}

/**
 * Cache wrapper for async functions
 * Implements stale-while-revalidate pattern
 */
export async function withCache<T>(
  kv: KVNamespace | undefined,
  key: string,
  fn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  // Try to get from cache first
  const cached = await cacheGet<T>(kv, key);

  if (cached.hit && cached.value !== null) {
    // Check if we should revalidate in background
    const cachedAt = (cached.metadata?.cachedAt as number) || 0;
    const age = Date.now() - cachedAt;
    const ttl = (options.ttl || TTL.MEDIUM) * 1000;

    // If cache is more than 80% of TTL, trigger background revalidation
    if (age > ttl * 0.8) {
      // Fire and forget revalidation
      fn()
        .then((freshValue) => cacheSet(kv, key, freshValue, options))
        .catch((error) => logger.error('Background revalidation failed', { key, error: String(error) }));
    }

    return cached.value;
  }

  // Cache miss - fetch fresh data
  const freshValue = await fn();
  await cacheSet(kv, key, freshValue, options);
  return freshValue;
}

/**
 * Get cache statistics
 */
export async function getCacheStats(kv: KVNamespace | undefined): Promise<{
  keys: number;
  prefixes: Record<string, number>;
}> {
  if (!kv) {
    return { keys: 0, prefixes: {} };
  }

  const prefixes: Record<string, number> = {};
  let cursor: string | undefined;
  let totalKeys = 0;

  do {
    const list = await kv.list({ cursor });
    totalKeys += list.keys.length;

    for (const key of list.keys) {
      const prefix = key.name.split(':')[0];
      prefixes[prefix] = (prefixes[prefix] || 0) + 1;
    }

    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  return { keys: totalKeys, prefixes };
}
