/**
 * Agent state management
 * Defines state schemas and persistence for agents
 */

import { z } from 'zod';

/**
 * Article processing state schema
 */
export const ArticleStateSchema = z.object({
  articleId: z.number(),
  url: z.string().url(),
  status: z.enum(['pending', 'scraping', 'analyzing', 'completed', 'failed']),
  content: z.string().optional(),
  analysis: z.object({
    relevance: z.enum(['RELEVANT', 'IRRELEVANT', 'SOMEWHAT_RELEVANT']),
    summary: z.string().optional(),
    category: z.string().optional(),
    entities: z.array(z.string()).optional(),
  }).optional(),
  error: z.string().optional(),
  startedAt: z.number(),
  completedAt: z.number().optional(),
});

export type ArticleState = z.infer<typeof ArticleStateSchema>;

/**
 * Batch processing state schema
 */
export const BatchStateSchema = z.object({
  batchId: z.string(),
  totalArticles: z.number(),
  processedArticles: z.number(),
  failedArticles: z.number(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  articles: z.array(ArticleStateSchema),
  startedAt: z.number(),
  completedAt: z.number().optional(),
});

export type BatchState = z.infer<typeof BatchStateSchema>;

/**
 * Agent conversation state
 */
export const ConversationStateSchema = z.object({
  conversationId: z.string(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    timestamp: z.number(),
  })),
  context: z.record(z.unknown()).optional(),
});

export type ConversationState = z.infer<typeof ConversationStateSchema>;

/**
 * Create initial article state
 */
export function createArticleState(articleId: number, url: string): ArticleState {
  return {
    articleId,
    url,
    status: 'pending',
    startedAt: Date.now(),
  };
}

/**
 * Create initial batch state
 */
export function createBatchState(batchId: string, articleUrls: string[]): BatchState {
  return {
    batchId,
    totalArticles: articleUrls.length,
    processedArticles: 0,
    failedArticles: 0,
    status: 'pending',
    articles: articleUrls.map((url, idx) => createArticleState(idx, url)),
    startedAt: Date.now(),
  };
}

/**
 * State persistence interface
 */
export interface StateStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * KV-based state store
 */
export function createKVStateStore(kv: KVNamespace): StateStore {
  return {
    async get<T>(key: string): Promise<T | null> {
      const value = await kv.get(key, 'json');
      return value as T | null;
    },
    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
      await kv.put(key, JSON.stringify(value), ttl ? { expirationTtl: ttl } : undefined);
    },
    async delete(key: string): Promise<void> {
      await kv.delete(key);
    },
  };
}
