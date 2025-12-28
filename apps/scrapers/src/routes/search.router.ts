/**
 * Court Search Router
 * REST API for searching court data
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from '../lib/logger';
import { createSearchService } from '../court/search';

/**
 * Environment bindings
 */
interface Env {
  DATABASE_URL: string;
}

/**
 * Create search router
 */
export function createSearchRouter() {
  const router = new Hono<{ Bindings: Env }>();

  /**
   * Unified search
   * GET /search
   */
  router.get('/', async (c) => {
    const query = c.req.query('q');

    if (!query || query.trim().length < 2) {
      throw new HTTPException(400, { message: 'Query must be at least 2 characters' });
    }

    const types = c.req.query('types')?.split(',') as ('case' | 'ruling' | 'party' | 'document')[] | undefined;
    const courtId = c.req.query('courtId');
    const dateFrom = c.req.query('dateFrom');
    const dateTo = c.req.query('dateTo');
    const status = c.req.query('status');
    const limit = parseInt(c.req.query('limit') || '20', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    try {
      const searchService = createSearchService(c.env.DATABASE_URL);

      const results = await searchService.search({
        query,
        types,
        courtId,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        status,
        limit: Math.min(limit, 100),
        offset,
      });

      return c.json({
        success: true,
        ...results,
      });
    } catch (error) {
      logger.error('Search failed', { query, error: String(error) });
      throw new HTTPException(500, { message: 'Search failed' });
    }
  });

  /**
   * Search cases only
   * GET /search/cases
   */
  router.get('/cases', async (c) => {
    const query = c.req.query('q');

    if (!query || query.trim().length < 2) {
      throw new HTTPException(400, { message: 'Query must be at least 2 characters' });
    }

    const courtId = c.req.query('courtId');
    const limit = parseInt(c.req.query('limit') || '20', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    try {
      const searchService = createSearchService(c.env.DATABASE_URL);

      const results = await searchService.searchCases({
        query,
        courtId,
        limit: Math.min(limit, 100),
        offset,
      });

      return c.json({
        success: true,
        query,
        ...results,
      });
    } catch (error) {
      logger.error('Case search failed', { query, error: String(error) });
      throw new HTTPException(500, { message: 'Search failed' });
    }
  });

  /**
   * Search rulings only
   * GET /search/rulings
   */
  router.get('/rulings', async (c) => {
    const query = c.req.query('q');

    if (!query || query.trim().length < 2) {
      throw new HTTPException(400, { message: 'Query must be at least 2 characters' });
    }

    const courtId = c.req.query('courtId');
    const dateFrom = c.req.query('dateFrom');
    const dateTo = c.req.query('dateTo');
    const limit = parseInt(c.req.query('limit') || '20', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    try {
      const searchService = createSearchService(c.env.DATABASE_URL);

      const results = await searchService.searchRulings({
        query,
        courtId,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        limit: Math.min(limit, 100),
        offset,
      });

      return c.json({
        success: true,
        query,
        ...results,
      });
    } catch (error) {
      logger.error('Ruling search failed', { query, error: String(error) });
      throw new HTTPException(500, { message: 'Search failed' });
    }
  });

  /**
   * Search parties only
   * GET /search/parties
   */
  router.get('/parties', async (c) => {
    const query = c.req.query('q');

    if (!query || query.trim().length < 2) {
      throw new HTTPException(400, { message: 'Query must be at least 2 characters' });
    }

    const courtId = c.req.query('courtId');
    const limit = parseInt(c.req.query('limit') || '20', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    try {
      const searchService = createSearchService(c.env.DATABASE_URL);

      const results = await searchService.searchParties({
        query,
        courtId,
        limit: Math.min(limit, 100),
        offset,
      });

      return c.json({
        success: true,
        query,
        ...results,
      });
    } catch (error) {
      logger.error('Party search failed', { query, error: String(error) });
      throw new HTTPException(500, { message: 'Search failed' });
    }
  });

  /**
   * Get search suggestions (autocomplete)
   * GET /search/suggest
   */
  router.get('/suggest', async (c) => {
    const prefix = c.req.query('q');

    if (!prefix || prefix.length < 1) {
      return c.json({ success: true, suggestions: [] });
    }

    const limit = parseInt(c.req.query('limit') || '10', 10);

    try {
      const searchService = createSearchService(c.env.DATABASE_URL);

      const suggestions = await searchService.getSuggestions(
        prefix,
        Math.min(limit, 20)
      );

      return c.json({
        success: true,
        suggestions,
      });
    } catch (error) {
      logger.error('Suggestion failed', { prefix, error: String(error) });
      return c.json({ success: true, suggestions: [] });
    }
  });

  /**
   * Get search facets
   * GET /search/facets
   */
  router.get('/facets', async (c) => {
    const query = c.req.query('q') || '';

    try {
      const searchService = createSearchService(c.env.DATABASE_URL);

      const facets = await searchService.getFacets(query);

      return c.json({
        success: true,
        facets,
      });
    } catch (error) {
      logger.error('Facet retrieval failed', { query, error: String(error) });
      throw new HTTPException(500, { message: 'Failed to get facets' });
    }
  });

  return router;
}
