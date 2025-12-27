/**
 * Batch Article Processing with Cloudflare Queues
 * Enables parallel processing of articles with rate limiting and retries
 */

import { logger } from './logger';

/**
 * Batch processing configuration
 */
export interface BatchConfig {
  batchSize: number;
  maxRetries: number;
  retryDelayMs: number;
  concurrency: number;
  timeoutMs: number;
}

/**
 * Default batch configuration
 */
export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  batchSize: 50,
  maxRetries: 3,
  retryDelayMs: 1000,
  concurrency: 10,
  timeoutMs: 30000,
};

/**
 * Batch job status
 */
export type BatchJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'partial';

/**
 * Batch job result
 */
export interface BatchJobResult<T> {
  id: string;
  status: BatchJobStatus;
  totalItems: number;
  processedItems: number;
  successCount: number;
  failureCount: number;
  results: T[];
  errors: BatchError[];
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
}

/**
 * Batch error
 */
export interface BatchError {
  itemId: string | number;
  error: string;
  retryCount: number;
  timestamp: Date;
}

/**
 * Queue message for article processing
 */
export interface ArticleQueueMessage {
  type: 'process_article' | 'analyze_article' | 'scrape_article';
  articleId: number;
  priority: 'high' | 'normal' | 'low';
  retryCount: number;
  metadata?: Record<string, unknown>;
}

/**
 * Queue message for batch operations
 */
export interface BatchQueueMessage {
  type: 'batch_process' | 'batch_analyze' | 'batch_scrape';
  batchId: string;
  articleIds: number[];
  config: Partial<BatchConfig>;
}

/**
 * Batch processor for articles
 */
export class BatchArticleProcessor<T> {
  private config: BatchConfig;

  constructor(config: Partial<BatchConfig> = {}) {
    this.config = { ...DEFAULT_BATCH_CONFIG, ...config };
  }

  /**
   * Process items in batches with concurrency control
   */
  async processBatch<I>(
    items: I[],
    processor: (item: I) => Promise<T>,
    onProgress?: (progress: { completed: number; total: number; success: number; failed: number }) => void
  ): Promise<BatchJobResult<T>> {
    const batchId = crypto.randomUUID();
    const startedAt = new Date();
    const results: T[] = [];
    const errors: BatchError[] = [];
    let successCount = 0;
    let failureCount = 0;

    logger.info('Starting batch processing', {
      batchId,
      totalItems: items.length,
      config: this.config,
    });

    // Process in chunks with concurrency
    const chunks = this.chunkArray(items, this.config.concurrency);

    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map(async (item, index) => {
          const itemId = this.getItemId(item, index);
          return this.processWithRetry(item, itemId, processor);
        })
      );

      for (let i = 0; i < chunkResults.length; i++) {
        const result = chunkResults[i];
        const itemId = this.getItemId(chunk[i], i);

        if (result.status === 'fulfilled') {
          results.push(result.value);
          successCount++;
        } else {
          failureCount++;
          errors.push({
            itemId: String(itemId),
            error: result.reason?.message || String(result.reason),
            retryCount: this.config.maxRetries,
            timestamp: new Date(),
          });
        }
      }

      // Report progress
      if (onProgress) {
        onProgress({
          completed: results.length + errors.length,
          total: items.length,
          success: successCount,
          failed: failureCount,
        });
      }
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    const status = this.determineStatus(successCount, failureCount, items.length);

    logger.info('Batch processing completed', {
      batchId,
      status,
      successCount,
      failureCount,
      durationMs,
    });

    return {
      id: batchId,
      status,
      totalItems: items.length,
      processedItems: successCount + failureCount,
      successCount,
      failureCount,
      results,
      errors,
      startedAt,
      completedAt,
      durationMs,
    };
  }

  /**
   * Process a single item with retry logic
   */
  private async processWithRetry<I>(
    item: I,
    itemId: string | number,
    processor: (item: I) => Promise<T>
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Processing timeout')), this.config.timeoutMs);
        });

        const result = await Promise.race([processor(item), timeoutPromise]);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          logger.warn('Retrying item processing', {
            itemId,
            attempt: attempt + 1,
            maxRetries: this.config.maxRetries,
            delay,
            error: lastError.message,
          });
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Processing failed after retries');
  }

  /**
   * Determine batch status based on results
   */
  private determineStatus(successCount: number, failureCount: number, total: number): BatchJobStatus {
    if (failureCount === 0) return 'completed';
    if (successCount === 0) return 'failed';
    return 'partial';
  }

  /**
   * Get item ID for logging
   */
  private getItemId<I>(item: I, index: number): string | number {
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      if ('id' in obj) return obj.id as string | number;
      if ('articleId' in obj) return obj.articleId as string | number;
    }
    return index;
  }

  /**
   * Split array into chunks
   */
  private chunkArray<I>(arr: I[], size: number): I[][] {
    const chunks: I[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Queue consumer for Cloudflare Queues
 */
export async function handleQueueMessage(
  batch: MessageBatch<ArticleQueueMessage>,
  env: { DATABASE_URL: string },
  processArticle: (articleId: number, type: string) => Promise<void>
): Promise<void> {
  const messages = batch.messages;

  logger.info('Processing queue batch', {
    messageCount: messages.length,
    queue: batch.queue,
  });

  // Sort by priority
  const sorted = [...messages].sort((a, b) => {
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    return priorityOrder[a.body.priority] - priorityOrder[b.body.priority];
  });

  for (const message of sorted) {
    try {
      await processArticle(message.body.articleId, message.body.type);
      message.ack();
    } catch (error) {
      logger.error('Failed to process queue message', {
        messageId: message.id,
        articleId: message.body.articleId,
        error: String(error),
      });

      // Retry if under retry limit
      if (message.body.retryCount < 3) {
        message.retry({ delaySeconds: Math.pow(2, message.body.retryCount) * 60 });
      } else {
        // Dead letter after max retries
        message.ack();
        logger.error('Message exceeded retry limit', {
          messageId: message.id,
          articleId: message.body.articleId,
        });
      }
    }
  }
}

/**
 * Enqueue articles for processing
 */
export async function enqueueArticles(
  queue: Queue<ArticleQueueMessage>,
  articleIds: number[],
  type: ArticleQueueMessage['type'] = 'process_article',
  priority: ArticleQueueMessage['priority'] = 'normal'
): Promise<void> {
  const messages = articleIds.map(articleId => ({
    body: {
      type,
      articleId,
      priority,
      retryCount: 0,
    },
  }));

  // Send in batches of 100 (Cloudflare limit)
  const batchSize = 100;
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    await queue.sendBatch(batch);
  }

  logger.info('Enqueued articles for processing', {
    count: articleIds.length,
    type,
    priority,
  });
}

/**
 * Create batch job for bulk operations
 */
export function createBatchJob(articleIds: number[], config?: Partial<BatchConfig>): BatchQueueMessage {
  return {
    type: 'batch_process',
    batchId: crypto.randomUUID(),
    articleIds,
    config: config || {},
  };
}

/**
 * Batch article analysis
 */
export async function batchAnalyzeArticles(
  articles: Array<{ id: number; content: string }>,
  analyzeFunction: (content: string) => Promise<unknown>,
  config?: Partial<BatchConfig>
): Promise<BatchJobResult<unknown>> {
  const processor = new BatchArticleProcessor(config);

  return processor.processBatch(articles, async article => {
    const analysis = await analyzeFunction(article.content);
    return { articleId: article.id, analysis };
  });
}

/**
 * Batch article scraping
 */
export async function batchScrapeArticles(
  urls: Array<{ id: number; url: string }>,
  scrapeFunction: (url: string) => Promise<string>,
  config?: Partial<BatchConfig>
): Promise<BatchJobResult<{ id: number; content: string }>> {
  const processor = new BatchArticleProcessor<{ id: number; content: string }>(config);

  return processor.processBatch(urls, async item => {
    const content = await scrapeFunction(item.url);
    return { id: item.id, content };
  });
}
