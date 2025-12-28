/**
 * Public Court Data API Router
 * REST API for external integrations
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { cors } from 'hono/cors';
import { logger } from '../lib/logger';
import {
  createApiKeyStore,
  createApiRateLimiter,
  type ApiKey,
  type ApiPermission,
} from '../court/api';
import { createSearchService } from '../court/search';

/**
 * Environment bindings
 */
interface Env {
  DATABASE_URL: string;
  COURT_SESSIONS: KVNamespace;
}

/**
 * Variables passed through middleware
 */
interface Variables {
  apiKey: ApiKey;
}

/**
 * Create public court API router
 */
export function createCourtApiRouter() {
  const router = new Hono<{ Bindings: Env; Variables: Variables }>();

  // Enable CORS for API
  router.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'X-API-Key'],
    exposeHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Request-Id',
    ],
    maxAge: 86400,
  }));

  // API Key authentication middleware
  router.use('*', async (c, next) => {
    const apiKeyHeader = c.req.header('X-API-Key') || c.req.header('Authorization')?.replace('Bearer ', '');

    if (!apiKeyHeader) {
      throw new HTTPException(401, {
        message: 'API key required. Include X-API-Key header.',
      });
    }

    const keyStore = createApiKeyStore(c.env.COURT_SESSIONS);
    const apiKey = await keyStore.validateKey(apiKeyHeader);

    if (!apiKey) {
      throw new HTTPException(401, { message: 'Invalid or expired API key' });
    }

    // Check rate limit
    const rateLimiter = createApiRateLimiter(c.env.COURT_SESSIONS);
    const rateResult = await rateLimiter.checkLimit(apiKey);

    // Add rate limit headers
    const headers = rateLimiter.getHeaders(rateResult, apiKey);
    for (const [key, value] of Object.entries(headers)) {
      c.header(key, value);
    }

    if (!rateResult.allowed) {
      throw new HTTPException(429, {
        message: `Rate limit exceeded. Retry after ${rateResult.retryAfter} seconds.`,
      });
    }

    // Add request ID
    c.header('X-Request-Id', crypto.randomUUID());

    // Store API key for later use
    c.set('apiKey', apiKey);

    await next();
  });

  /**
   * Check permission helper
   */
  function checkPermission(apiKey: ApiKey, permission: ApiPermission): boolean {
    return apiKey.permissions.includes(permission);
  }

  /**
   * API info
   * GET /api/v1
   */
  router.get('/', (c) => {
    const apiKey = c.get('apiKey');

    return c.json({
      name: 'Court Data API',
      version: '1.0.0',
      tier: apiKey.tier,
      permissions: apiKey.permissions,
      rateLimit: apiKey.rateLimit,
      documentation: 'https://docs.example.com/court-api',
    });
  });

  /**
   * Search cases
   * GET /api/v1/cases/search
   */
  router.get('/cases/search', async (c) => {
    const apiKey = c.get('apiKey');

    if (!checkPermission(apiKey, 'cases:search')) {
      throw new HTTPException(403, { message: 'Permission denied: cases:search required' });
    }

    const query = c.req.query('q');
    if (!query) {
      throw new HTTPException(400, { message: 'Query parameter "q" is required' });
    }

    const courtId = c.req.query('court_id');
    const status = c.req.query('status');
    const dateFrom = c.req.query('date_from');
    const dateTo = c.req.query('date_to');
    const page = parseInt(c.req.query('page') || '1', 10);
    const perPage = Math.min(parseInt(c.req.query('per_page') || '20', 10), 100);

    try {
      const searchService = createSearchService(c.env.DATABASE_URL);

      const results = await searchService.searchCases({
        query,
        courtId,
        status,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        limit: perPage,
        offset: (page - 1) * perPage,
      });

      return c.json({
        data: results.results,
        meta: {
          total: results.total,
          page,
          per_page: perPage,
          total_pages: Math.ceil(results.total / perPage),
        },
      });
    } catch (error) {
      logger.error('API case search failed', { query, error: String(error) });
      throw new HTTPException(500, { message: 'Search failed' });
    }
  });

  /**
   * Get case by number
   * GET /api/v1/cases/:caseNumber
   */
  router.get('/cases/:caseNumber', async (c) => {
    const apiKey = c.get('apiKey');

    if (!checkPermission(apiKey, 'cases:read')) {
      throw new HTTPException(403, { message: 'Permission denied: cases:read required' });
    }

    const { caseNumber } = c.req.param();

    try {
      const searchService = createSearchService(c.env.DATABASE_URL);

      const results = await searchService.searchCases({
        query: caseNumber,
        limit: 1,
      });

      if (results.results.length === 0) {
        throw new HTTPException(404, { message: 'Case not found' });
      }

      const caseData = results.results[0];

      return c.json({
        data: caseData,
      });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      logger.error('API get case failed', { caseNumber, error: String(error) });
      throw new HTTPException(500, { message: 'Failed to get case' });
    }
  });

  /**
   * Get rulings for a case
   * GET /api/v1/cases/:caseNumber/rulings
   */
  router.get('/cases/:caseNumber/rulings', async (c) => {
    const apiKey = c.get('apiKey');

    if (!checkPermission(apiKey, 'rulings:read')) {
      throw new HTTPException(403, { message: 'Permission denied: rulings:read required' });
    }

    const { caseNumber } = c.req.param();
    const page = parseInt(c.req.query('page') || '1', 10);
    const perPage = Math.min(parseInt(c.req.query('per_page') || '20', 10), 100);

    try {
      const searchService = createSearchService(c.env.DATABASE_URL);

      const results = await searchService.searchRulings({
        query: caseNumber,
        limit: perPage,
        offset: (page - 1) * perPage,
      });

      return c.json({
        data: results.results.filter(r => r.caseNumber === caseNumber),
        meta: {
          total: results.total,
          page,
          per_page: perPage,
        },
      });
    } catch (error) {
      logger.error('API get rulings failed', { caseNumber, error: String(error) });
      throw new HTTPException(500, { message: 'Failed to get rulings' });
    }
  });

  /**
   * Search rulings
   * GET /api/v1/rulings/search
   */
  router.get('/rulings/search', async (c) => {
    const apiKey = c.get('apiKey');

    if (!checkPermission(apiKey, 'rulings:read')) {
      throw new HTTPException(403, { message: 'Permission denied: rulings:read required' });
    }

    const query = c.req.query('q');
    if (!query) {
      throw new HTTPException(400, { message: 'Query parameter "q" is required' });
    }

    const courtId = c.req.query('court_id');
    const dateFrom = c.req.query('date_from');
    const dateTo = c.req.query('date_to');
    const page = parseInt(c.req.query('page') || '1', 10);
    const perPage = Math.min(parseInt(c.req.query('per_page') || '20', 10), 100);

    try {
      const searchService = createSearchService(c.env.DATABASE_URL);

      const results = await searchService.searchRulings({
        query,
        courtId,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        limit: perPage,
        offset: (page - 1) * perPage,
      });

      return c.json({
        data: results.results,
        meta: {
          total: results.total,
          page,
          per_page: perPage,
          total_pages: Math.ceil(results.total / perPage),
        },
      });
    } catch (error) {
      logger.error('API ruling search failed', { query, error: String(error) });
      throw new HTTPException(500, { message: 'Search failed' });
    }
  });

  /**
   * Get parties for a case
   * GET /api/v1/cases/:caseNumber/parties
   */
  router.get('/cases/:caseNumber/parties', async (c) => {
    const apiKey = c.get('apiKey');

    if (!checkPermission(apiKey, 'parties:read')) {
      throw new HTTPException(403, { message: 'Permission denied: parties:read required' });
    }

    const { caseNumber } = c.req.param();

    try {
      const searchService = createSearchService(c.env.DATABASE_URL);

      const results = await searchService.searchParties({
        query: caseNumber,
        limit: 100,
      });

      return c.json({
        data: results.results.filter(r => r.caseNumber === caseNumber),
      });
    } catch (error) {
      logger.error('API get parties failed', { caseNumber, error: String(error) });
      throw new HTTPException(500, { message: 'Failed to get parties' });
    }
  });

  /**
   * Search parties
   * GET /api/v1/parties/search
   */
  router.get('/parties/search', async (c) => {
    const apiKey = c.get('apiKey');

    if (!checkPermission(apiKey, 'parties:read')) {
      throw new HTTPException(403, { message: 'Permission denied: parties:read required' });
    }

    const query = c.req.query('q');
    if (!query) {
      throw new HTTPException(400, { message: 'Query parameter "q" is required' });
    }

    const courtId = c.req.query('court_id');
    const page = parseInt(c.req.query('page') || '1', 10);
    const perPage = Math.min(parseInt(c.req.query('per_page') || '20', 10), 100);

    try {
      const searchService = createSearchService(c.env.DATABASE_URL);

      const results = await searchService.searchParties({
        query,
        courtId,
        limit: perPage,
        offset: (page - 1) * perPage,
      });

      return c.json({
        data: results.results,
        meta: {
          total: results.total,
          page,
          per_page: perPage,
          total_pages: Math.ceil(results.total / perPage),
        },
      });
    } catch (error) {
      logger.error('API party search failed', { query, error: String(error) });
      throw new HTTPException(500, { message: 'Search failed' });
    }
  });

  /**
   * Get documents for a case
   * GET /api/v1/cases/:caseNumber/documents
   */
  router.get('/cases/:caseNumber/documents', async (c) => {
    const apiKey = c.get('apiKey');

    if (!checkPermission(apiKey, 'documents:read')) {
      throw new HTTPException(403, { message: 'Permission denied: documents:read required' });
    }

    const { caseNumber } = c.req.param();
    const page = parseInt(c.req.query('page') || '1', 10);
    const perPage = Math.min(parseInt(c.req.query('per_page') || '20', 10), 100);

    try {
      const searchService = createSearchService(c.env.DATABASE_URL);

      const results = await searchService.searchDocuments({
        query: caseNumber,
        limit: perPage,
        offset: (page - 1) * perPage,
      });

      return c.json({
        data: results.results.filter(r => r.caseNumber === caseNumber),
        meta: {
          total: results.total,
          page,
          per_page: perPage,
        },
      });
    } catch (error) {
      logger.error('API get documents failed', { caseNumber, error: String(error) });
      throw new HTTPException(500, { message: 'Failed to get documents' });
    }
  });

  /**
   * Get courts
   * GET /api/v1/courts
   */
  router.get('/courts', async (c) => {
    // No permission required for courts list
    try {
      // Return list of supported courts
      return c.json({
        data: [
          {
            id: 'sf-superior',
            name: 'San Francisco Superior Court',
            state: 'CA',
            county: 'San Francisco',
            website: 'https://sf.courts.ca.gov',
          },
        ],
      });
    } catch (error) {
      logger.error('API get courts failed', { error: String(error) });
      throw new HTTPException(500, { message: 'Failed to get courts' });
    }
  });

  /**
   * API usage stats
   * GET /api/v1/usage
   */
  router.get('/usage', async (c) => {
    const apiKey = c.get('apiKey');

    try {
      const rateLimiter = createApiRateLimiter(c.env.COURT_SESSIONS);
      const usage = await rateLimiter.getUsageStats(apiKey.id);

      return c.json({
        data: {
          tier: apiKey.tier,
          limits: apiKey.rateLimit,
          current: {
            minute: usage.minuteUsage,
            day: usage.dayUsage,
          },
          remaining: {
            minute: apiKey.rateLimit.requestsPerMinute - usage.minuteUsage,
            day: apiKey.rateLimit.requestsPerDay - usage.dayUsage,
          },
        },
      });
    } catch (error) {
      logger.error('API get usage failed', { error: String(error) });
      throw new HTTPException(500, { message: 'Failed to get usage' });
    }
  });

  return router;
}
