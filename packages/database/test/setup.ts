/**
 * Database test setup for Meridian
 */

import { getDb } from '../src/index';

// Test database URL (use a separate test database)
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/meridian_test';

export function getTestDb() {
  return getDb(TEST_DATABASE_URL);
}

export async function setupTestDb() {
  const db = getTestDb();
  // Run any setup needed for tests
  return db;
}

export async function cleanupTestDb() {
  const db = getTestDb();
  // Clean up test data if needed
}

// Test fixtures
export const testFixtures = {
  source: {
    name: 'Test Source',
    url: 'https://example.com/feed.xml',
    category: 'news',
    scrapeFrequency: 'hourly',
  },
  article: {
    url: 'https://example.com/article',
    title: 'Test Article',
    content: 'This is test content for the article.',
    publishDate: new Date(),
    relevance: 'RELEVANT' as const,
    completeness: 'COMPLETE' as const,
    language: 'en',
    location: 'US',
  },
  report: {
    title: 'Test Brief',
    content: '# Test Brief\n\nThis is a test intelligence brief.',
    modelAuthor: 'gpt-5.2',
    totalArticles: 10,
  },
};
