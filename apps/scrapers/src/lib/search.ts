/**
 * Semantic Search with Vectorize
 * Provides vector-based search for articles
 */

import { logger } from './logger';
import { Env } from '../index';

/**
 * Search result
 */
export interface SearchResult {
  articleId: number;
  title: string;
  url: string;
  score: number;
  snippet?: string;
  publishDate?: Date;
}

/**
 * Vector embedding response
 */
interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
}

/**
 * Generate text embedding using AI Gateway
 */
export async function generateEmbedding(
  env: Env,
  text: string
): Promise<number[] | null> {
  try {
    // Use Gemini embedding model
    const response = await fetch(
      `${env.GOOGLE_BASE_URL}/v1beta/models/text-embedding-004:embedContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': env.GOOGLE_API_KEY,
        },
        body: JSON.stringify({
          content: {
            parts: [{ text: text.slice(0, 10000) }], // Limit text length
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Embedding error: ${response.status}`);
    }

    const data = await response.json() as {
      embedding?: { values?: number[] };
    };

    return data.embedding?.values || null;
  } catch (error) {
    logger.error('Failed to generate embedding', { error: String(error) });
    return null;
  }
}

/**
 * Store embedding in Vectorize
 * Note: Requires Vectorize binding in wrangler.toml
 */
export async function storeEmbedding(
  vectorize: VectorizeIndex | undefined,
  articleId: number,
  embedding: number[],
  metadata: Record<string, string>
): Promise<boolean> {
  if (!vectorize) {
    logger.warn('Vectorize not configured');
    return false;
  }

  try {
    await vectorize.upsert([
      {
        id: articleId.toString(),
        values: embedding,
        metadata,
      },
    ]);

    logger.info('Stored embedding', { articleId });
    return true;
  } catch (error) {
    logger.error('Failed to store embedding', { error: String(error) });
    return false;
  }
}

/**
 * Search for similar articles
 */
export async function searchSimilar(
  vectorize: VectorizeIndex | undefined,
  queryEmbedding: number[],
  topK: number = 10,
  filter?: VectorizeVectorMetadataFilter
): Promise<VectorizeMatches | null> {
  if (!vectorize) {
    logger.warn('Vectorize not configured');
    return null;
  }

  try {
    const results = await vectorize.query(queryEmbedding, {
      topK,
      filter,
      returnValues: false,
      returnMetadata: 'all',
    });

    return results;
  } catch (error) {
    logger.error('Search failed', { error: String(error) });
    return null;
  }
}

/**
 * Hybrid search combining keyword and vector search
 */
export interface HybridSearchOptions {
  query: string;
  vectorWeight?: number; // 0-1, default 0.7
  keywordWeight?: number; // 0-1, default 0.3
  topK?: number;
}

/**
 * Simple keyword search (fallback when Vectorize not available)
 */
export function keywordSearch<T extends { title: string; content?: string }>(
  articles: T[],
  query: string,
  maxResults: number = 10
): Array<T & { score: number }> {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  const scored = articles.map(article => {
    const titleLower = article.title.toLowerCase();
    const contentLower = (article.content || '').toLowerCase();

    let score = 0;
    for (const term of queryTerms) {
      // Title matches worth more
      if (titleLower.includes(term)) score += 2;
      if (contentLower.includes(term)) score += 1;

      // Exact phrase match
      if (titleLower.includes(query.toLowerCase())) score += 5;
    }

    return { ...article, score };
  });

  return scored
    .filter(a => a.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

/**
 * Search suggestions based on popular queries
 */
export interface SearchSuggestion {
  query: string;
  count: number;
}

/**
 * Track search query for analytics
 */
export async function trackSearchQuery(
  kv: KVNamespace | undefined,
  query: string
): Promise<void> {
  if (!kv) return;

  try {
    const key = 'search:queries';
    const queries = await kv.get<Record<string, number>>(key, 'json') || {};

    const normalizedQuery = query.toLowerCase().trim();
    queries[normalizedQuery] = (queries[normalizedQuery] || 0) + 1;

    await kv.put(key, JSON.stringify(queries), {
      expirationTtl: 7 * 24 * 60 * 60, // 7 days
    });
  } catch {
    // Ignore tracking errors
  }
}

/**
 * Get popular search queries
 */
export async function getPopularSearches(
  kv: KVNamespace | undefined,
  limit: number = 10
): Promise<SearchSuggestion[]> {
  if (!kv) return [];

  try {
    const queries = await kv.get<Record<string, number>>('search:queries', 'json') || {};

    return Object.entries(queries)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Generate search snippet with highlighted terms
 */
export function generateSnippet(
  content: string,
  query: string,
  maxLength: number = 200
): string {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const contentLower = content.toLowerCase();

  // Find the best starting position (where query terms appear)
  let bestPos = 0;
  let bestScore = 0;

  for (let i = 0; i < content.length - maxLength; i += 50) {
    const window = contentLower.slice(i, i + maxLength);
    let score = 0;

    for (const term of terms) {
      if (window.includes(term)) score++;
    }

    if (score > bestScore) {
      bestScore = score;
      bestPos = i;
    }
  }

  // Extract snippet
  let snippet = content.slice(bestPos, bestPos + maxLength);

  // Clean up snippet boundaries
  if (bestPos > 0) snippet = '...' + snippet.slice(snippet.indexOf(' ') + 1);
  if (bestPos + maxLength < content.length) {
    snippet = snippet.slice(0, snippet.lastIndexOf(' ')) + '...';
  }

  return snippet;
}
