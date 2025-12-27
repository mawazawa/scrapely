/**
 * Tests for cache utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildCacheKey,
  CACHE_KEYS,
  TTL,
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheInvalidatePrefix,
  withCache,
} from '../../src/lib/cache';

// Mock KV namespace
const createMockKV = () => {
  const store = new Map<string, { value: string; metadata?: Record<string, unknown> }>();

  return {
    get: vi.fn(async (key: string, options?: { type?: string }) => {
      const item = store.get(key);
      if (!item) return null;
      return options?.type === 'json' ? JSON.parse(item.value) : item.value;
    }),
    getWithMetadata: vi.fn(async <T>(key: string, options?: { type?: string }) => {
      const item = store.get(key);
      if (!item) return { value: null, metadata: null };
      return {
        value: options?.type === 'json' ? JSON.parse(item.value) : item.value,
        metadata: item.metadata || null,
      };
    }),
    put: vi.fn(async (key: string, value: string, options?: { expirationTtl?: number; metadata?: Record<string, unknown> }) => {
      store.set(key, { value, metadata: options?.metadata });
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async (options?: { prefix?: string; cursor?: string }) => {
      const keys = Array.from(store.keys())
        .filter((k) => !options?.prefix || k.startsWith(options.prefix))
        .map((name) => ({ name }));
      return { keys, list_complete: true, cursor: undefined };
    }),
    _store: store, // For test access
  } as unknown as KVNamespace & { _store: Map<string, { value: string; metadata?: Record<string, unknown> }> };
};

describe('Cache Utilities', () => {
  let mockKV: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    mockKV = createMockKV();
    vi.clearAllMocks();
  });

  describe('buildCacheKey', () => {
    it('should build cache key with prefix', () => {
      expect(buildCacheKey('STATS')).toBe('stats');
      expect(buildCacheKey('REPORTS', '2025-12-27')).toBe('reports:2025-12-27');
      expect(buildCacheKey('REPORT_DETAIL', 'slug', 123)).toBe('report:slug:123');
    });
  });

  describe('TTL constants', () => {
    it('should have correct TTL values', () => {
      expect(TTL.SHORT).toBe(60);
      expect(TTL.MEDIUM).toBe(300);
      expect(TTL.LONG).toBe(900);
      expect(TTL.HOUR).toBe(3600);
      expect(TTL.DAY).toBe(86400);
    });
  });

  describe('cacheGet', () => {
    it('should return miss when KV is undefined', async () => {
      const result = await cacheGet(undefined, 'test-key');
      expect(result.hit).toBe(false);
      expect(result.value).toBeNull();
    });

    it('should return miss when key not found', async () => {
      const result = await cacheGet(mockKV, 'nonexistent');
      expect(result.hit).toBe(false);
      expect(result.value).toBeNull();
    });

    it('should return hit when key found', async () => {
      mockKV._store.set('test-key', { value: JSON.stringify({ data: 'test' }), metadata: { cachedAt: Date.now() } });
      const result = await cacheGet<{ data: string }>(mockKV, 'test-key');
      expect(result.hit).toBe(true);
      expect(result.value).toEqual({ data: 'test' });
    });
  });

  describe('cacheSet', () => {
    it('should return false when KV is undefined', async () => {
      const result = await cacheSet(undefined, 'test-key', { data: 'test' });
      expect(result).toBe(false);
    });

    it('should store value with default TTL', async () => {
      await cacheSet(mockKV, 'test-key', { data: 'test' });
      expect(mockKV.put).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify({ data: 'test' }),
        expect.objectContaining({ expirationTtl: TTL.MEDIUM })
      );
    });

    it('should store value with custom TTL', async () => {
      await cacheSet(mockKV, 'test-key', { data: 'test' }, { ttl: TTL.HOUR });
      expect(mockKV.put).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify({ data: 'test' }),
        expect.objectContaining({ expirationTtl: TTL.HOUR })
      );
    });
  });

  describe('cacheDelete', () => {
    it('should return false when KV is undefined', async () => {
      const result = await cacheDelete(undefined, 'test-key');
      expect(result).toBe(false);
    });

    it('should delete key from cache', async () => {
      mockKV._store.set('test-key', { value: 'test' });
      await cacheDelete(mockKV, 'test-key');
      expect(mockKV.delete).toHaveBeenCalledWith('test-key');
    });
  });

  describe('cacheInvalidatePrefix', () => {
    it('should return 0 when KV is undefined', async () => {
      const result = await cacheInvalidatePrefix(undefined, 'stats');
      expect(result).toBe(0);
    });

    it('should delete all keys with prefix', async () => {
      mockKV._store.set('stats:daily', { value: 'a' });
      mockKV._store.set('stats:weekly', { value: 'b' });
      mockKV._store.set('reports:1', { value: 'c' });

      const deleted = await cacheInvalidatePrefix(mockKV, 'stats');
      expect(deleted).toBe(2);
    });
  });

  describe('withCache', () => {
    it('should call function when cache miss', async () => {
      const fn = vi.fn().mockResolvedValue({ data: 'fresh' });
      const result = await withCache(mockKV, 'test-key', fn);
      expect(fn).toHaveBeenCalled();
      expect(result).toEqual({ data: 'fresh' });
    });

    it('should return cached value on hit', async () => {
      const cachedValue = { data: 'cached' };
      mockKV._store.set('test-key', {
        value: JSON.stringify(cachedValue),
        metadata: { cachedAt: Date.now() },
      });

      const fn = vi.fn().mockResolvedValue({ data: 'fresh' });
      const result = await withCache(mockKV, 'test-key', fn);

      expect(fn).not.toHaveBeenCalled();
      expect(result).toEqual(cachedValue);
    });

    it('should skip cache when KV undefined', async () => {
      const fn = vi.fn().mockResolvedValue({ data: 'fresh' });
      const result = await withCache(undefined, 'test-key', fn);
      expect(fn).toHaveBeenCalled();
      expect(result).toEqual({ data: 'fresh' });
    });
  });
});
