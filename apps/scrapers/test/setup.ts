/**
 * Test setup for Meridian scrapers
 */

import { vi } from 'vitest';

// Mock environment variables
export const mockEnv = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  GOOGLE_API_KEY: 'test-google-key',
  GOOGLE_BASE_URL: 'https://generativelanguage.googleapis.com',
  MERIDIAN_SECRET_KEY: 'test-secret-key',
  OPENAI_API_KEY: 'test-openai-key',
  ANTHROPIC_API_KEY: 'test-anthropic-key',
  MISTRAL_API_KEY: 'test-mistral-key',
  FIRECRAWL_API_KEY: 'test-firecrawl-key',
  CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
  PROCESS_ARTICLES: {
    create: vi.fn().mockResolvedValue({ id: 'test-workflow-id' }),
  },
  RSS_FEED: {
    create: vi.fn().mockResolvedValue({ id: 'test-workflow-id' }),
  },
  BROWSER: {
    fetch: vi.fn().mockResolvedValue(new Response('<html></html>')),
  },
};

// Mock database
export const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  execute: vi.fn().mockResolvedValue([]),
  onConflictDoNothing: vi.fn().mockResolvedValue([]),
  innerJoin: vi.fn().mockReturnThis(),
  groupBy: vi.fn().mockReturnThis(),
};

// Mock fetch
export function mockFetch(response: Partial<Response> = {}) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue(''),
    json: vi.fn().mockResolvedValue({}),
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    ...response,
  });
}

// Test fixtures
export const fixtures = {
  article: {
    id: 1,
    url: 'https://example.com/article',
    title: 'Test Article',
    publishedAt: new Date(),
    content: 'This is test content.',
    relevance: 'RELEVANT',
    completeness: 'COMPLETE',
    location: 'US',
    summary: 'Test summary',
  },
  source: {
    id: 1,
    name: 'Test Source',
    url: 'https://example.com/feed.xml',
    category: 'news',
    scrapeFrequency: 'hourly',
  },
  rssItem: {
    title: 'Test Article',
    link: 'https://example.com/article',
    pubDate: new Date().toISOString(),
    description: 'Test description',
  },
};
