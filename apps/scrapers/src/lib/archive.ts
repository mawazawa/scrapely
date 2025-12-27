/**
 * Article Archive System
 * Long-term storage and retrieval of archived articles using R2
 */

import { logger } from './logger';

/**
 * Archive configuration
 */
export interface ArchiveConfig {
  // Storage
  bucket: R2Bucket;
  prefix: string;

  // Retention
  hotStorageDays: number;      // Keep in primary DB
  warmStorageDays: number;     // Keep in R2 with quick access
  coldStorageMonths: number;   // Archive with slower access

  // Compression
  compressionEnabled: boolean;
  compressionThreshold: number;

  // Indexing
  indexEnabled: boolean;
  indexBucket?: R2Bucket;
}

/**
 * Archived article
 */
export interface ArchivedArticle {
  id: number;
  title: string;
  url: string;
  content: string;
  publishedAt: string;
  scrapedAt: string;
  archivedAt: string;

  // Metadata
  sourceId: number;
  sourceName: string;
  topics: string[];
  entities: string[];

  // Analysis
  analysis?: Record<string, unknown>;
  sentiment?: { score: number; label: string };

  // Archive metadata
  archiveTier: 'hot' | 'warm' | 'cold';
  compressed: boolean;
  checksum: string;
}

/**
 * Archive index entry
 */
export interface ArchiveIndexEntry {
  id: number;
  title: string;
  url: string;
  publishedAt: string;
  sourceId: number;
  topics: string[];
  archiveKey: string;
  tier: 'hot' | 'warm' | 'cold';
  size: number;
}

/**
 * Archive search options
 */
export interface ArchiveSearchOptions {
  query?: string;
  sourceIds?: number[];
  topics?: string[];
  dateRange?: { start: Date; end: Date };
  limit?: number;
  offset?: number;
  tier?: 'hot' | 'warm' | 'cold' | 'all';
}

/**
 * Archive search results
 */
export interface ArchiveSearchResults {
  entries: ArchiveIndexEntry[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * Default archive configuration
 */
export const DEFAULT_ARCHIVE_CONFIG: Omit<ArchiveConfig, 'bucket'> = {
  prefix: 'archive/',
  hotStorageDays: 30,
  warmStorageDays: 180,
  coldStorageMonths: 24,
  compressionEnabled: true,
  compressionThreshold: 1024,
  indexEnabled: true,
};

/**
 * Article archive manager
 */
export class ArticleArchive {
  private config: ArchiveConfig;

  constructor(bucket: R2Bucket, config: Partial<Omit<ArchiveConfig, 'bucket'>> = {}) {
    this.config = {
      ...DEFAULT_ARCHIVE_CONFIG,
      ...config,
      bucket,
    };
  }

  /**
   * Archive an article
   */
  async archive(article: Omit<ArchivedArticle, 'archivedAt' | 'archiveTier' | 'compressed' | 'checksum'>): Promise<string> {
    const tier = this.determineTier(new Date(article.scrapedAt));
    const archiveKey = this.generateArchiveKey(article.id, article.publishedAt);

    let content = JSON.stringify(article);
    let compressed = false;

    // Compress if enabled and above threshold
    if (this.config.compressionEnabled && content.length > this.config.compressionThreshold) {
      content = await this.compress(content);
      compressed = true;
    }

    const checksum = await this.calculateChecksum(content);

    const archivedArticle: ArchivedArticle = {
      ...article,
      archivedAt: new Date().toISOString(),
      archiveTier: tier,
      compressed,
      checksum,
    };

    // Store in R2
    await this.config.bucket.put(
      `${this.config.prefix}${archiveKey}`,
      compressed ? content : JSON.stringify(archivedArticle),
      {
        customMetadata: {
          id: String(article.id),
          tier,
          compressed: String(compressed),
          checksum,
          publishedAt: article.publishedAt,
        },
      }
    );

    // Update index
    if (this.config.indexEnabled) {
      await this.updateIndex({
        id: article.id,
        title: article.title,
        url: article.url,
        publishedAt: article.publishedAt,
        sourceId: article.sourceId,
        topics: article.topics,
        archiveKey,
        tier,
        size: content.length,
      });
    }

    logger.info('Article archived', { id: article.id, tier, compressed });

    return archiveKey;
  }

  /**
   * Retrieve an archived article
   */
  async retrieve(archiveKey: string): Promise<ArchivedArticle | null> {
    try {
      const object = await this.config.bucket.get(`${this.config.prefix}${archiveKey}`);

      if (!object) {
        return null;
      }

      const metadata = object.customMetadata;
      let content = await object.text();

      // Decompress if needed
      if (metadata?.compressed === 'true') {
        content = await this.decompress(content);
      }

      // Verify checksum
      if (metadata?.checksum) {
        const currentChecksum = await this.calculateChecksum(content);
        if (currentChecksum !== metadata.checksum) {
          logger.error('Archive checksum mismatch', { archiveKey });
          return null;
        }
      }

      return JSON.parse(content) as ArchivedArticle;
    } catch (error) {
      logger.error('Failed to retrieve archived article', {
        archiveKey,
        error: String(error),
      });
      return null;
    }
  }

  /**
   * Retrieve by article ID
   */
  async retrieveById(articleId: number): Promise<ArchivedArticle | null> {
    // Search index for archive key
    const results = await this.search({ limit: 1 });

    for (const entry of results.entries) {
      if (entry.id === articleId) {
        return this.retrieve(entry.archiveKey);
      }
    }

    return null;
  }

  /**
   * Search archived articles
   */
  async search(options: ArchiveSearchOptions = {}): Promise<ArchiveSearchResults> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    if (!this.config.indexEnabled) {
      // Without index, do basic list
      return this.searchWithoutIndex(options);
    }

    // With index, search the index
    const indexKey = `${this.config.prefix}index/main.json`;
    const indexObject = await this.config.bucket.get(indexKey);

    if (!indexObject) {
      return { entries: [], totalCount: 0, hasMore: false };
    }

    const index = await indexObject.json<ArchiveIndexEntry[]>();
    let filtered = index;

    // Apply filters
    if (options.sourceIds?.length) {
      filtered = filtered.filter(e => options.sourceIds!.includes(e.sourceId));
    }

    if (options.topics?.length) {
      filtered = filtered.filter(e =>
        e.topics.some(t => options.topics!.includes(t))
      );
    }

    if (options.dateRange) {
      const start = options.dateRange.start.getTime();
      const end = options.dateRange.end.getTime();
      filtered = filtered.filter(e => {
        const date = new Date(e.publishedAt).getTime();
        return date >= start && date <= end;
      });
    }

    if (options.tier && options.tier !== 'all') {
      filtered = filtered.filter(e => e.tier === options.tier);
    }

    if (options.query) {
      const query = options.query.toLowerCase();
      filtered = filtered.filter(e =>
        e.title.toLowerCase().includes(query)
      );
    }

    const totalCount = filtered.length;
    const entries = filtered.slice(offset, offset + limit);
    const hasMore = offset + limit < totalCount;

    return { entries, totalCount, hasMore };
  }

  /**
   * Delete archived article
   */
  async delete(archiveKey: string): Promise<boolean> {
    try {
      await this.config.bucket.delete(`${this.config.prefix}${archiveKey}`);

      // Update index
      if (this.config.indexEnabled) {
        await this.removeFromIndex(archiveKey);
      }

      logger.info('Archived article deleted', { archiveKey });
      return true;
    } catch (error) {
      logger.error('Failed to delete archived article', {
        archiveKey,
        error: String(error),
      });
      return false;
    }
  }

  /**
   * Migrate articles between tiers
   */
  async migrateTier(archiveKey: string, newTier: 'hot' | 'warm' | 'cold'): Promise<boolean> {
    const article = await this.retrieve(archiveKey);
    if (!article) return false;

    article.archiveTier = newTier;

    // Re-archive with new tier
    const newKey = this.generateArchiveKey(article.id, article.publishedAt, newTier);

    let content = JSON.stringify(article);
    if (this.config.compressionEnabled && content.length > this.config.compressionThreshold) {
      content = await this.compress(content);
      article.compressed = true;
    }

    article.checksum = await this.calculateChecksum(content);

    await this.config.bucket.put(
      `${this.config.prefix}${newKey}`,
      content,
      {
        customMetadata: {
          id: String(article.id),
          tier: newTier,
          compressed: String(article.compressed),
          checksum: article.checksum,
          publishedAt: article.publishedAt,
        },
      }
    );

    // Delete old
    await this.config.bucket.delete(`${this.config.prefix}${archiveKey}`);

    logger.info('Article migrated', { from: archiveKey, to: newKey, tier: newTier });

    return true;
  }

  /**
   * Get archive statistics
   */
  async getStats(): Promise<{
    totalArticles: number;
    byTier: Record<string, { count: number; size: number }>;
    totalSize: number;
  }> {
    const stats = {
      totalArticles: 0,
      byTier: {
        hot: { count: 0, size: 0 },
        warm: { count: 0, size: 0 },
        cold: { count: 0, size: 0 },
      },
      totalSize: 0,
    };

    let cursor: string | undefined;

    do {
      const listed = await this.config.bucket.list({
        prefix: this.config.prefix,
        cursor,
        limit: 1000,
      });

      for (const object of listed.objects) {
        const tier = object.customMetadata?.tier as 'hot' | 'warm' | 'cold' || 'warm';

        stats.totalArticles++;
        stats.byTier[tier].count++;
        stats.byTier[tier].size += object.size;
        stats.totalSize += object.size;
      }

      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    return stats;
  }

  /**
   * Bulk archive articles
   */
  async bulkArchive(articles: Array<Omit<ArchivedArticle, 'archivedAt' | 'archiveTier' | 'compressed' | 'checksum'>>): Promise<{
    success: number;
    failed: number;
    keys: string[];
  }> {
    const results = await Promise.allSettled(
      articles.map(article => this.archive(article))
    );

    let success = 0;
    let failed = 0;
    const keys: string[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        success++;
        keys.push(result.value);
      } else {
        failed++;
      }
    }

    logger.info('Bulk archive completed', { success, failed });

    return { success, failed, keys };
  }

  /**
   * Run archive maintenance (tier migration, cleanup)
   */
  async runMaintenance(): Promise<{
    migrated: number;
    deleted: number;
    errors: number;
  }> {
    const now = new Date();
    const results = { migrated: 0, deleted: 0, errors: 0 };

    let cursor: string | undefined;

    do {
      const listed = await this.config.bucket.list({
        prefix: this.config.prefix,
        cursor,
        limit: 100,
      });

      for (const object of listed.objects) {
        try {
          const publishedAt = object.customMetadata?.publishedAt;
          if (!publishedAt) continue;

          const articleDate = new Date(publishedAt);
          const daysSince = (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60 * 24);
          const currentTier = object.customMetadata?.tier as 'hot' | 'warm' | 'cold';

          // Determine if migration needed
          let targetTier: 'hot' | 'warm' | 'cold' | null = null;

          if (daysSince > this.config.coldStorageMonths * 30 && currentTier !== 'cold') {
            targetTier = 'cold';
          } else if (daysSince > this.config.warmStorageDays && currentTier === 'hot') {
            targetTier = 'warm';
          }

          if (targetTier) {
            const key = object.key.replace(this.config.prefix, '');
            await this.migrateTier(key, targetTier);
            results.migrated++;
          }
        } catch {
          results.errors++;
        }
      }

      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    logger.info('Archive maintenance completed', results);

    return results;
  }

  /**
   * Determine storage tier based on article age
   */
  private determineTier(scrapedAt: Date): 'hot' | 'warm' | 'cold' {
    const now = new Date();
    const daysSince = (now.getTime() - scrapedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSince <= this.config.hotStorageDays) return 'hot';
    if (daysSince <= this.config.warmStorageDays) return 'warm';
    return 'cold';
  }

  /**
   * Generate archive key
   */
  private generateArchiveKey(id: number, publishedAt: string, tier?: string): string {
    const date = new Date(publishedAt);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const tierPrefix = tier || this.determineTier(date);

    return `${tierPrefix}/${year}/${month}/${id}.json`;
  }

  /**
   * Update archive index
   */
  private async updateIndex(entry: ArchiveIndexEntry): Promise<void> {
    const indexKey = `${this.config.prefix}index/main.json`;

    let index: ArchiveIndexEntry[] = [];

    const existing = await this.config.bucket.get(indexKey);
    if (existing) {
      index = await existing.json<ArchiveIndexEntry[]>();
    }

    // Remove if exists, then add
    index = index.filter(e => e.id !== entry.id);
    index.push(entry);

    await this.config.bucket.put(indexKey, JSON.stringify(index));
  }

  /**
   * Remove from archive index
   */
  private async removeFromIndex(archiveKey: string): Promise<void> {
    const indexKey = `${this.config.prefix}index/main.json`;

    const existing = await this.config.bucket.get(indexKey);
    if (!existing) return;

    let index = await existing.json<ArchiveIndexEntry[]>();
    index = index.filter(e => e.archiveKey !== archiveKey);

    await this.config.bucket.put(indexKey, JSON.stringify(index));
  }

  /**
   * Search without index (slower)
   */
  private async searchWithoutIndex(options: ArchiveSearchOptions): Promise<ArchiveSearchResults> {
    const entries: ArchiveIndexEntry[] = [];
    let cursor: string | undefined;

    do {
      const listed = await this.config.bucket.list({
        prefix: this.config.prefix,
        cursor,
        limit: 100,
      });

      for (const object of listed.objects) {
        if (object.key.includes('/index/')) continue;

        entries.push({
          id: parseInt(object.customMetadata?.id || '0'),
          title: '',
          url: '',
          publishedAt: object.customMetadata?.publishedAt || '',
          sourceId: 0,
          topics: [],
          archiveKey: object.key.replace(this.config.prefix, ''),
          tier: (object.customMetadata?.tier as 'hot' | 'warm' | 'cold') || 'warm',
          size: object.size,
        });

        if (entries.length >= (options.limit || 50)) break;
      }

      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor && entries.length < (options.limit || 50));

    return {
      entries,
      totalCount: entries.length,
      hasMore: !!cursor,
    };
  }

  /**
   * Compress content
   */
  private async compress(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const stream = new Blob([encoder.encode(data)])
      .stream()
      .pipeThrough(new CompressionStream('gzip'));

    const compressed = await new Response(stream).arrayBuffer();
    return btoa(String.fromCharCode(...new Uint8Array(compressed)));
  }

  /**
   * Decompress content
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

  /**
   * Calculate checksum
   */
  private async calculateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

/**
 * Create archive instance
 */
export function createArchive(
  bucket: R2Bucket,
  config?: Partial<Omit<ArchiveConfig, 'bucket'>>
): ArticleArchive {
  return new ArticleArchive(bucket, config);
}
