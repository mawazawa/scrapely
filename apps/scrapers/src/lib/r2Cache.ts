/**
 * R2 Caching Layer
 * Cloudflare R2 storage for article content and API response caching
 */

import { logger } from './logger';

/**
 * Cache entry metadata
 */
export interface CacheMetadata {
  contentType: string;
  createdAt: string;
  expiresAt?: string;
  etag?: string;
  size: number;
  compression?: 'gzip' | 'br' | 'none';
  tags?: string[];
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  defaultTtlSeconds: number;
  maxSizeBytes: number;
  compressionThreshold: number;  // Compress if larger than this
  prefix: string;
}

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  defaultTtlSeconds: 60 * 60 * 24,  // 24 hours
  maxSizeBytes: 50 * 1024 * 1024,    // 50MB per object
  compressionThreshold: 1024,        // 1KB
  prefix: 'cache/',
};

/**
 * Cache key builders
 */
export const CacheKeys = {
  article: (id: number) => `articles/${id}/content`,
  articleAnalysis: (id: number) => `articles/${id}/analysis`,
  source: (id: number) => `sources/${id}/metadata`,
  report: (slug: string) => `reports/${slug}/content`,
  apiResponse: (path: string, params: string) => `api/${path}/${hashString(params)}`,
  embedding: (id: number) => `embeddings/${id}`,
  pdf: (url: string) => `pdfs/${hashString(url)}`,
};

/**
 * R2 Cache Manager
 */
export class R2Cache {
  private r2: R2Bucket;
  private config: CacheConfig;

  constructor(r2: R2Bucket, config: Partial<CacheConfig> = {}) {
    this.r2 = r2;
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
  }

  /**
   * Get item from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.config.prefix + key;

    try {
      const object = await this.r2.get(fullKey);

      if (!object) {
        logger.debug('Cache miss', { key });
        return null;
      }

      // Check expiration
      const metadata = object.customMetadata as unknown as CacheMetadata;
      if (metadata?.expiresAt && new Date(metadata.expiresAt) < new Date()) {
        logger.debug('Cache expired', { key });
        await this.delete(key);
        return null;
      }

      // Decompress if needed
      let data = await object.text();
      if (metadata?.compression === 'gzip') {
        data = await this.decompress(data);
      }

      logger.debug('Cache hit', { key, size: metadata?.size });

      return JSON.parse(data) as T;
    } catch (error) {
      logger.error('Cache get error', { key, error: String(error) });
      return null;
    }
  }

  /**
   * Get raw bytes from cache
   */
  async getBytes(key: string): Promise<ArrayBuffer | null> {
    const fullKey = this.config.prefix + key;

    try {
      const object = await this.r2.get(fullKey);

      if (!object) {
        return null;
      }

      return object.arrayBuffer();
    } catch (error) {
      logger.error('Cache getBytes error', { key, error: String(error) });
      return null;
    }
  }

  /**
   * Get with ETag validation (conditional request)
   */
  async getIfModified<T>(key: string, etag: string): Promise<{ data: T | null; modified: boolean }> {
    const fullKey = this.config.prefix + key;

    try {
      const object = await this.r2.get(fullKey, {
        onlyIf: {
          etagDoesNotMatch: etag,
        },
      });

      if (object === null) {
        // ETag matched, content not modified
        return { data: null, modified: false };
      }

      const data = await object.text();
      return { data: JSON.parse(data) as T, modified: true };
    } catch {
      return { data: null, modified: true };
    }
  }

  /**
   * Set item in cache
   */
  async set<T>(
    key: string,
    value: T,
    options: {
      ttlSeconds?: number;
      contentType?: string;
      tags?: string[];
    } = {}
  ): Promise<boolean> {
    const fullKey = this.config.prefix + key;
    const ttl = options.ttlSeconds || this.config.defaultTtlSeconds;

    try {
      let data = JSON.stringify(value);
      let compression: 'gzip' | 'none' = 'none';

      // Compress if above threshold
      if (data.length > this.config.compressionThreshold) {
        data = await this.compress(data);
        compression = 'gzip';
      }

      // Check size limit
      if (data.length > this.config.maxSizeBytes) {
        logger.warn('Cache item too large', { key, size: data.length });
        return false;
      }

      const metadata: CacheMetadata = {
        contentType: options.contentType || 'application/json',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        size: data.length,
        compression,
        tags: options.tags,
      };

      await this.r2.put(fullKey, data, {
        customMetadata: metadata as unknown as Record<string, string>,
        httpMetadata: {
          contentType: metadata.contentType,
          cacheControl: `public, max-age=${ttl}`,
        },
      });

      logger.debug('Cache set', { key, size: data.length, ttl });

      return true;
    } catch (error) {
      logger.error('Cache set error', { key, error: String(error) });
      return false;
    }
  }

  /**
   * Set raw bytes in cache
   */
  async setBytes(
    key: string,
    data: ArrayBuffer,
    options: {
      ttlSeconds?: number;
      contentType?: string;
    } = {}
  ): Promise<boolean> {
    const fullKey = this.config.prefix + key;
    const ttl = options.ttlSeconds || this.config.defaultTtlSeconds;

    try {
      await this.r2.put(fullKey, data, {
        httpMetadata: {
          contentType: options.contentType || 'application/octet-stream',
          cacheControl: `public, max-age=${ttl}`,
        },
      });

      return true;
    } catch (error) {
      logger.error('Cache setBytes error', { key, error: String(error) });
      return false;
    }
  }

  /**
   * Delete item from cache
   */
  async delete(key: string): Promise<boolean> {
    const fullKey = this.config.prefix + key;

    try {
      await this.r2.delete(fullKey);
      logger.debug('Cache delete', { key });
      return true;
    } catch (error) {
      logger.error('Cache delete error', { key, error: String(error) });
      return false;
    }
  }

  /**
   * Delete multiple items
   */
  async deleteMany(keys: string[]): Promise<number> {
    const fullKeys = keys.map(k => this.config.prefix + k);

    try {
      await this.r2.delete(fullKeys);
      return keys.length;
    } catch (error) {
      logger.error('Cache deleteMany error', { count: keys.length, error: String(error) });
      return 0;
    }
  }

  /**
   * Delete items by prefix
   */
  async deleteByPrefix(prefix: string): Promise<number> {
    const fullPrefix = this.config.prefix + prefix;
    let deleted = 0;

    try {
      let cursor: string | undefined;

      do {
        const listed = await this.r2.list({
          prefix: fullPrefix,
          cursor,
          limit: 1000,
        });

        if (listed.objects.length > 0) {
          const keys = listed.objects.map(obj => obj.key);
          await this.r2.delete(keys);
          deleted += keys.length;
        }

        cursor = listed.truncated ? listed.cursor : undefined;
      } while (cursor);

      logger.info('Cache prefix deleted', { prefix, deleted });

      return deleted;
    } catch (error) {
      logger.error('Cache deleteByPrefix error', { prefix, error: String(error) });
      return deleted;
    }
  }

  /**
   * Delete items by tag
   */
  async deleteByTag(tag: string): Promise<number> {
    // R2 doesn't support tag-based queries natively
    // This would need to be implemented with a separate index
    logger.warn('deleteByTag not fully implemented', { tag });
    return 0;
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const fullKey = this.config.prefix + key;

    try {
      const head = await this.r2.head(fullKey);
      return head !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get item metadata without fetching content
   */
  async getMetadata(key: string): Promise<CacheMetadata | null> {
    const fullKey = this.config.prefix + key;

    try {
      const head = await this.r2.head(fullKey);
      if (!head) return null;

      return head.customMetadata as unknown as CacheMetadata;
    } catch {
      return null;
    }
  }

  /**
   * List items in cache
   */
  async list(options: {
    prefix?: string;
    limit?: number;
    cursor?: string;
  } = {}): Promise<{ keys: string[]; cursor?: string }> {
    const fullPrefix = this.config.prefix + (options.prefix || '');

    try {
      const listed = await this.r2.list({
        prefix: fullPrefix,
        limit: options.limit || 100,
        cursor: options.cursor,
      });

      const keys = listed.objects.map(obj =>
        obj.key.replace(this.config.prefix, '')
      );

      return {
        keys,
        cursor: listed.truncated ? listed.cursor : undefined,
      };
    } catch (error) {
      logger.error('Cache list error', { error: String(error) });
      return { keys: [] };
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    itemCount: number;
    totalSize: number;
  }> {
    let itemCount = 0;
    let totalSize = 0;
    let cursor: string | undefined;

    try {
      do {
        const listed = await this.r2.list({
          prefix: this.config.prefix,
          cursor,
          limit: 1000,
        });

        itemCount += listed.objects.length;
        totalSize += listed.objects.reduce((sum, obj) => sum + obj.size, 0);

        cursor = listed.truncated ? listed.cursor : undefined;
      } while (cursor);

      return { itemCount, totalSize };
    } catch {
      return { itemCount: 0, totalSize: 0 };
    }
  }

  /**
   * Compress data using gzip
   */
  private async compress(data: string): Promise<string> {
    // In Workers, use CompressionStream
    const encoder = new TextEncoder();
    const stream = new Blob([encoder.encode(data)])
      .stream()
      .pipeThrough(new CompressionStream('gzip'));

    const compressed = await new Response(stream).arrayBuffer();
    return btoa(String.fromCharCode(...new Uint8Array(compressed)));
  }

  /**
   * Decompress gzip data
   */
  private async decompress(data: string): Promise<string> {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const stream = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'));

    return new Response(stream).text();
  }
}

/**
 * Simple string hash for cache keys
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Cached function wrapper
 */
export function withCache<T>(
  cache: R2Cache,
  keyFn: (...args: unknown[]) => string,
  fn: (...args: unknown[]) => Promise<T>,
  ttlSeconds?: number
): (...args: unknown[]) => Promise<T> {
  return async (...args: unknown[]): Promise<T> => {
    const key = keyFn(...args);

    // Try cache first
    const cached = await cache.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function
    const result = await fn(...args);

    // Cache result
    await cache.set(key, result, { ttlSeconds });

    return result;
  };
}

/**
 * Response cache for API endpoints
 */
export async function cacheApiResponse(
  cache: R2Cache,
  request: Request,
  handler: () => Promise<Response>,
  ttlSeconds: number = 300
): Promise<Response> {
  const url = new URL(request.url);
  const cacheKey = CacheKeys.apiResponse(url.pathname, url.search);

  // Only cache GET requests
  if (request.method !== 'GET') {
    return handler();
  }

  // Check cache
  const cached = await cache.get<{
    status: number;
    headers: Record<string, string>;
    body: string;
  }>(cacheKey);

  if (cached) {
    return new Response(cached.body, {
      status: cached.status,
      headers: {
        ...cached.headers,
        'X-Cache': 'HIT',
      },
    });
  }

  // Execute handler
  const response = await handler();

  // Cache successful responses
  if (response.ok) {
    const body = await response.text();
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    await cache.set(
      cacheKey,
      { status: response.status, headers, body },
      { ttlSeconds }
    );

    return new Response(body, {
      status: response.status,
      headers: {
        ...headers,
        'X-Cache': 'MISS',
      },
    });
  }

  return response;
}
