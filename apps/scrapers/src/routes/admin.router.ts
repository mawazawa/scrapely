/**
 * Admin API Router for Source Management
 * Provides CRUD operations for sources with authentication
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { logger } from '../lib/logger';
import type { Env } from '../types';

// Validation schemas
const CreateSourceSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(50),
  scrapeFrequency: z.number().int().min(1).max(4).default(2),
  enabled: z.boolean().default(true),
  firecrawlMode: z.enum(['none', 'scrape', 'agent']).optional(),
  customHeaders: z.record(z.string()).optional(),
});

const UpdateSourceSchema = z.object({
  url: z.string().url().optional(),
  name: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(50).optional(),
  scrapeFrequency: z.number().int().min(1).max(4).optional(),
  enabled: z.boolean().optional(),
  firecrawlMode: z.enum(['none', 'scrape', 'agent']).optional(),
  customHeaders: z.record(z.string()).optional(),
});

const BulkActionSchema = z.object({
  action: z.enum(['enable', 'disable', 'delete', 'update_frequency']),
  sourceIds: z.array(z.number().int()),
  value: z.unknown().optional(),
});

const SourceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().optional(),
  status: z.enum(['all', 'enabled', 'disabled', 'healthy', 'degraded', 'failing']).default('all'),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'category', 'successRate', 'lastScrape', 'createdAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// Admin router
export const adminRouter = new Hono<{ Bindings: Env }>();

/**
 * Middleware to require admin authentication
 */
adminRouter.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  const secretKey = c.env.MERIDIAN_SECRET_KEY;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized', message: 'Missing authorization header' }, 401);
  }

  const token = authHeader.replace('Bearer ', '');
  if (token !== secretKey) {
    logger.warn('Invalid admin authentication attempt');
    return c.json({ error: 'Unauthorized', message: 'Invalid API key' }, 401);
  }

  await next();
});

/**
 * List sources with filtering and pagination
 */
adminRouter.get('/sources', async c => {
  try {
    const query = SourceQuerySchema.parse(Object.fromEntries(new URL(c.req.url).searchParams));

    // In a real implementation, this would query the database
    // For now, return a mock response structure
    const response = {
      sources: [],
      pagination: {
        page: query.page,
        limit: query.limit,
        total: 0,
        totalPages: 0,
      },
      filters: {
        category: query.category,
        status: query.status,
        search: query.search,
      },
    };

    return c.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation Error', details: error.errors }, 400);
    }
    throw error;
  }
});

/**
 * Get single source by ID
 */
adminRouter.get('/sources/:id', async c => {
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return c.json({ error: 'Invalid source ID' }, 400);
  }

  // Mock response - would query database
  return c.json({
    source: null,
    health: {
      status: 'unknown',
      successRate: 0,
      totalScrapes: 0,
      lastSuccess: null,
      lastFailure: null,
    },
    recentArticles: [],
  });
});

/**
 * Create new source
 */
adminRouter.post('/sources', async c => {
  try {
    const body = await c.req.json();
    const data = CreateSourceSchema.parse(body);

    logger.info('Creating new source', { name: data.name, url: data.url });

    // Mock response - would insert into database
    const source = {
      id: Math.floor(Math.random() * 10000),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      successRate: 1.0,
      totalScrapes: 0,
    };

    return c.json({ source }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation Error', details: error.errors }, 400);
    }
    throw error;
  }
});

/**
 * Update source
 */
adminRouter.put('/sources/:id', async c => {
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return c.json({ error: 'Invalid source ID' }, 400);
  }

  try {
    const body = await c.req.json();
    const data = UpdateSourceSchema.parse(body);

    logger.info('Updating source', { id, updates: Object.keys(data) });

    // Mock response - would update database
    return c.json({
      source: {
        id,
        ...data,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation Error', details: error.errors }, 400);
    }
    throw error;
  }
});

/**
 * Delete source
 */
adminRouter.delete('/sources/:id', async c => {
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return c.json({ error: 'Invalid source ID' }, 400);
  }

  logger.info('Deleting source', { id });

  // Mock response - would delete from database
  return c.json({ success: true, deletedId: id });
});

/**
 * Bulk actions on sources
 */
adminRouter.post('/sources/bulk', async c => {
  try {
    const body = await c.req.json();
    const { action, sourceIds, value } = BulkActionSchema.parse(body);

    logger.info('Bulk action on sources', { action, count: sourceIds.length });

    const results = {
      action,
      affected: sourceIds.length,
      success: sourceIds,
      failed: [] as number[],
    };

    return c.json(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation Error', details: error.errors }, 400);
    }
    throw error;
  }
});

/**
 * Test source scraping
 */
adminRouter.post('/sources/:id/test', async c => {
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return c.json({ error: 'Invalid source ID' }, 400);
  }

  logger.info('Testing source scrape', { id });

  // Mock test result
  return c.json({
    success: true,
    testResult: {
      responseTime: 234,
      articlesFound: 15,
      sampleArticle: {
        title: 'Sample Article Title',
        url: 'https://example.com/article',
        publishDate: new Date().toISOString(),
      },
      errors: [],
    },
  });
});

/**
 * Trigger manual scrape for source
 */
adminRouter.post('/sources/:id/scrape', async c => {
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return c.json({ error: 'Invalid source ID' }, 400);
  }

  logger.info('Triggering manual scrape', { id });

  return c.json({
    success: true,
    message: 'Scrape triggered',
    jobId: crypto.randomUUID(),
  });
});

/**
 * Get source health metrics
 */
adminRouter.get('/sources/:id/health', async c => {
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return c.json({ error: 'Invalid source ID' }, 400);
  }

  return c.json({
    sourceId: id,
    health: {
      status: 'healthy',
      successRate: 0.95,
      totalScrapes: 150,
      successfulScrapes: 142,
      failedScrapes: 8,
      avgResponseTimeMs: 456,
      lastSuccess: new Date().toISOString(),
      lastFailure: null,
      lastError: null,
    },
    history: [],
  });
});

/**
 * Reset source health metrics
 */
adminRouter.post('/sources/:id/health/reset', async c => {
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return c.json({ error: 'Invalid source ID' }, 400);
  }

  logger.info('Resetting source health', { id });

  return c.json({ success: true, message: 'Health metrics reset' });
});

/**
 * Get dashboard statistics
 */
adminRouter.get('/stats', async c => {
  return c.json({
    sources: {
      total: 800,
      enabled: 750,
      disabled: 50,
      healthy: 680,
      degraded: 45,
      failing: 25,
    },
    articles: {
      today: 1250,
      thisWeek: 8500,
      thisMonth: 35000,
      total: 150000,
    },
    processing: {
      pending: 45,
      inProgress: 12,
      failed: 3,
      avgProcessingTime: 2.5,
    },
    briefs: {
      published: 180,
      scheduled: 5,
      draft: 2,
    },
  });
});

/**
 * Get category statistics
 */
adminRouter.get('/stats/categories', async c => {
  return c.json({
    categories: [
      { name: 'Politics', sourceCount: 150, articleCount: 25000 },
      { name: 'Technology', sourceCount: 120, articleCount: 18000 },
      { name: 'Finance', sourceCount: 100, articleCount: 15000 },
      { name: 'World', sourceCount: 180, articleCount: 30000 },
      { name: 'Science', sourceCount: 80, articleCount: 12000 },
    ],
  });
});

/**
 * Get recent errors
 */
adminRouter.get('/errors', async c => {
  const limit = parseInt(c.req.query('limit') || '50', 10);

  return c.json({
    errors: [],
    total: 0,
    limit,
  });
});

/**
 * Export sources as JSON/CSV
 */
adminRouter.get('/sources/export', async c => {
  const format = c.req.query('format') || 'json';

  if (format === 'csv') {
    c.header('Content-Type', 'text/csv');
    c.header('Content-Disposition', 'attachment; filename="sources.csv"');
    return c.text('id,name,url,category,enabled,successRate\n');
  }

  return c.json({ sources: [], exportedAt: new Date().toISOString() });
});

/**
 * Import sources from JSON
 */
adminRouter.post('/sources/import', async c => {
  try {
    const body = await c.req.json();
    const sources = z.array(CreateSourceSchema).parse(body.sources || body);

    logger.info('Importing sources', { count: sources.length });

    return c.json({
      imported: sources.length,
      skipped: 0,
      errors: [],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation Error', details: error.errors }, 400);
    }
    throw error;
  }
});
