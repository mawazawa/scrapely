/**
 * Court Search Service
 * Full-text search across court data
 */

import { logger } from '../../lib/logger';
import { getDb } from '@meridian/database';
import { sql } from 'drizzle-orm';

/**
 * Search result item
 */
export interface SearchResult {
  id: string;
  type: 'case' | 'ruling' | 'party' | 'document';
  title: string;
  subtitle?: string;
  snippet?: string;
  caseNumber?: string;
  courtId?: string;
  relevance: number;
  url: string;
  metadata?: Record<string, unknown>;
}

/**
 * Search options
 */
export interface SearchOptions {
  query: string;
  types?: Array<'case' | 'ruling' | 'party' | 'document'>;
  courtId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  status?: string;
  limit?: number;
  offset?: number;
}

/**
 * Search response
 */
export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
  facets: SearchFacets;
  took: number;
}

/**
 * Search facets for filtering
 */
export interface SearchFacets {
  courts: Array<{ id: string; name: string; count: number }>;
  types: Array<{ type: string; count: number }>;
  statuses: Array<{ status: string; count: number }>;
  years: Array<{ year: number; count: number }>;
}

/**
 * Court Search Service
 */
export class SearchService {
  private dbUrl: string;

  constructor(dbUrl: string) {
    this.dbUrl = dbUrl;
  }

  /**
   * Perform a unified search across all court data
   */
  async search(options: SearchOptions): Promise<SearchResponse> {
    const startTime = Date.now();
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const types = options.types || ['case', 'ruling', 'party', 'document'];

    const results: SearchResult[] = [];
    let total = 0;

    // For unified search, we need to fetch enough results from each type
    // to properly merge and rank them. Don't apply the user's offset to sub-queries.
    // Instead, fetch limit + offset results from each type to ensure we have enough
    // for the combined sort to work correctly.
    const subSearchOptions: SearchOptions = {
      ...options,
      limit: limit + offset, // Fetch enough to handle offset after merge
      offset: 0, // Don't apply offset to individual searches
    };

    // Search each type and merge results
    if (types.includes('case')) {
      const caseResults = await this.searchCases(subSearchOptions);
      results.push(...caseResults.results);
      total += caseResults.total;
    }

    if (types.includes('ruling')) {
      const rulingResults = await this.searchRulings(subSearchOptions);
      results.push(...rulingResults.results);
      total += rulingResults.total;
    }

    if (types.includes('party')) {
      const partyResults = await this.searchParties(subSearchOptions);
      results.push(...partyResults.results);
      total += partyResults.total;
    }

    if (types.includes('document')) {
      const docResults = await this.searchDocuments(subSearchOptions);
      results.push(...docResults.results);
      total += docResults.total;
    }

    // Sort all results by relevance and then apply pagination
    const sortedResults = results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(offset, offset + limit);

    // Get facets
    const facets = await this.getFacets(options.query);

    return {
      query: options.query,
      results: sortedResults,
      total, // Total is the sum of all matching records across types
      facets,
      took: Date.now() - startTime,
    };
  }

  /**
   * Search cases
   */
  async searchCases(options: SearchOptions): Promise<{ results: SearchResult[]; total: number }> {
    const db = getDb(this.dbUrl);
    const query = this.normalizeQuery(options.query);

    try {
      // Using PostgreSQL full-text search with ts_rank
      const results = await db.execute(sql`
        SELECT
          id,
          case_number,
          case_type,
          status,
          filing_date,
          court_id,
          ts_rank(
            to_tsvector('english', coalesce(case_number, '') || ' ' || coalesce(case_type, '') || ' ' || coalesce(status, '')),
            plainto_tsquery('english', ${query})
          ) as relevance
        FROM cases
        WHERE
          to_tsvector('english', coalesce(case_number, '') || ' ' || coalesce(case_type, '') || ' ' || coalesce(status, ''))
          @@ plainto_tsquery('english', ${query})
          ${options.courtId ? sql`AND court_id = ${options.courtId}` : sql``}
          ${options.dateFrom ? sql`AND filing_date >= ${options.dateFrom}` : sql``}
          ${options.dateTo ? sql`AND filing_date <= ${options.dateTo}` : sql``}
        ORDER BY relevance DESC
        LIMIT ${options.limit || 10}
        OFFSET ${options.offset || 0}
      `);

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM cases
        WHERE
          to_tsvector('english', coalesce(case_number, '') || ' ' || coalesce(case_type, '') || ' ' || coalesce(status, ''))
          @@ plainto_tsquery('english', ${query})
      `);

      const total = parseInt((countResult.rows[0] as { count: string })?.count || '0', 10);

      return {
        results: (results.rows as unknown[]).map((row: unknown) => {
          const r = row as Record<string, unknown>;
          return {
            id: String(r.id),
            type: 'case' as const,
            title: `Case ${r.case_number}`,
            subtitle: String(r.case_type || ''),
            caseNumber: String(r.case_number),
            courtId: String(r.court_id),
            relevance: Number(r.relevance),
            url: `/cases/${r.case_number}`,
            metadata: {
              status: r.status,
              filingDate: r.filing_date,
            },
          };
        }),
        total,
      };
    } catch (error) {
      logger.error('Case search failed', { query: options.query, error: String(error) });
      return { results: [], total: 0 };
    }
  }

  /**
   * Search rulings
   */
  async searchRulings(options: SearchOptions): Promise<{ results: SearchResult[]; total: number }> {
    const db = getDb(this.dbUrl);
    const query = this.normalizeQuery(options.query);

    try {
      const results = await db.execute(sql`
        SELECT
          r.id,
          r.case_id,
          r.motion_type,
          r.outcome,
          r.ruling_date,
          r.ruling_text,
          c.case_number,
          c.court_id,
          ts_rank(
            to_tsvector('english', coalesce(r.motion_type, '') || ' ' || coalesce(r.outcome, '') || ' ' || coalesce(r.ruling_text, '')),
            plainto_tsquery('english', ${query})
          ) as relevance
        FROM rulings r
        JOIN cases c ON r.case_id = c.id
        WHERE
          to_tsvector('english', coalesce(r.motion_type, '') || ' ' || coalesce(r.outcome, '') || ' ' || coalesce(r.ruling_text, ''))
          @@ plainto_tsquery('english', ${query})
          ${options.courtId ? sql`AND c.court_id = ${options.courtId}` : sql``}
          ${options.dateFrom ? sql`AND r.ruling_date >= ${options.dateFrom}` : sql``}
          ${options.dateTo ? sql`AND r.ruling_date <= ${options.dateTo}` : sql``}
        ORDER BY relevance DESC
        LIMIT ${options.limit || 10}
        OFFSET ${options.offset || 0}
      `);

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM rulings r
        JOIN cases c ON r.case_id = c.id
        WHERE
          to_tsvector('english', coalesce(r.motion_type, '') || ' ' || coalesce(r.outcome, '') || ' ' || coalesce(r.ruling_text, ''))
          @@ plainto_tsquery('english', ${query})
      `);

      const total = parseInt((countResult.rows[0] as { count: string })?.count || '0', 10);

      return {
        results: (results.rows as unknown[]).map((row: unknown) => {
          const r = row as Record<string, unknown>;
          const text = String(r.ruling_text || '');
          return {
            id: String(r.id),
            type: 'ruling' as const,
            title: String(r.motion_type || 'Ruling'),
            subtitle: String(r.outcome || ''),
            snippet: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
            caseNumber: String(r.case_number),
            courtId: String(r.court_id),
            relevance: Number(r.relevance),
            url: `/cases/${r.case_number}/rulings/${r.id}`,
            metadata: {
              rulingDate: r.ruling_date,
              outcome: r.outcome,
            },
          };
        }),
        total,
      };
    } catch (error) {
      logger.error('Ruling search failed', { query: options.query, error: String(error) });
      return { results: [], total: 0 };
    }
  }

  /**
   * Search parties
   */
  async searchParties(options: SearchOptions): Promise<{ results: SearchResult[]; total: number }> {
    const db = getDb(this.dbUrl);
    const query = this.normalizeQuery(options.query);

    try {
      const results = await db.execute(sql`
        SELECT
          p.id,
          p.name,
          p.party_type,
          p.case_id,
          c.case_number,
          c.court_id,
          ts_rank(
            to_tsvector('english', coalesce(p.name, '')),
            plainto_tsquery('english', ${query})
          ) as relevance
        FROM case_parties p
        JOIN cases c ON p.case_id = c.id
        WHERE
          to_tsvector('english', coalesce(p.name, ''))
          @@ plainto_tsquery('english', ${query})
          ${options.courtId ? sql`AND c.court_id = ${options.courtId}` : sql``}
        ORDER BY relevance DESC
        LIMIT ${options.limit || 10}
        OFFSET ${options.offset || 0}
      `);

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM case_parties p
        WHERE
          to_tsvector('english', coalesce(p.name, ''))
          @@ plainto_tsquery('english', ${query})
      `);

      const total = parseInt((countResult.rows[0] as { count: string })?.count || '0', 10);

      return {
        results: (results.rows as unknown[]).map((row: unknown) => {
          const r = row as Record<string, unknown>;
          return {
            id: String(r.id),
            type: 'party' as const,
            title: String(r.name),
            subtitle: String(r.party_type || ''),
            caseNumber: String(r.case_number),
            courtId: String(r.court_id),
            relevance: Number(r.relevance),
            url: `/cases/${r.case_number}`,
            metadata: {
              partyType: r.party_type,
            },
          };
        }),
        total,
      };
    } catch (error) {
      logger.error('Party search failed', { query: options.query, error: String(error) });
      return { results: [], total: 0 };
    }
  }

  /**
   * Search documents
   */
  async searchDocuments(options: SearchOptions): Promise<{ results: SearchResult[]; total: number }> {
    const db = getDb(this.dbUrl);
    const query = this.normalizeQuery(options.query);

    try {
      const results = await db.execute(sql`
        SELECT
          d.id,
          d.title,
          d.document_type,
          d.filed_date,
          d.ocr_text,
          d.case_id,
          c.case_number,
          c.court_id,
          ts_rank(
            to_tsvector('english', coalesce(d.title, '') || ' ' || coalesce(d.document_type, '') || ' ' || coalesce(d.ocr_text, '')),
            plainto_tsquery('english', ${query})
          ) as relevance
        FROM case_documents d
        JOIN cases c ON d.case_id = c.id
        WHERE
          to_tsvector('english', coalesce(d.title, '') || ' ' || coalesce(d.document_type, '') || ' ' || coalesce(d.ocr_text, ''))
          @@ plainto_tsquery('english', ${query})
          ${options.courtId ? sql`AND c.court_id = ${options.courtId}` : sql``}
          ${options.dateFrom ? sql`AND d.filed_date >= ${options.dateFrom}` : sql``}
          ${options.dateTo ? sql`AND d.filed_date <= ${options.dateTo}` : sql``}
        ORDER BY relevance DESC
        LIMIT ${options.limit || 10}
        OFFSET ${options.offset || 0}
      `);

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM case_documents d
        WHERE
          to_tsvector('english', coalesce(d.title, '') || ' ' || coalesce(d.document_type, ''))
          @@ plainto_tsquery('english', ${query})
      `);

      const total = parseInt((countResult.rows[0] as { count: string })?.count || '0', 10);

      return {
        results: (results.rows as unknown[]).map((row: unknown) => {
          const r = row as Record<string, unknown>;
          const ocrText = String(r.ocr_text || '');
          return {
            id: String(r.id),
            type: 'document' as const,
            title: String(r.title),
            subtitle: String(r.document_type || ''),
            snippet: ocrText.substring(0, 200) + (ocrText.length > 200 ? '...' : ''),
            caseNumber: String(r.case_number),
            courtId: String(r.court_id),
            relevance: Number(r.relevance),
            url: `/cases/${r.case_number}/documents/${r.id}`,
            metadata: {
              documentType: r.document_type,
              filedDate: r.filed_date,
            },
          };
        }),
        total,
      };
    } catch (error) {
      logger.error('Document search failed', { query: options.query, error: String(error) });
      return { results: [], total: 0 };
    }
  }

  /**
   * Get search facets
   */
  async getFacets(query: string): Promise<SearchFacets> {
    const db = getDb(this.dbUrl);
    const normalizedQuery = this.normalizeQuery(query);

    try {
      // Court facets
      const courtFacets = await db.execute(sql`
        SELECT
          c.court_id,
          ct.name as court_name,
          COUNT(*) as count
        FROM cases c
        LEFT JOIN courts ct ON c.court_id = ct.id
        WHERE
          to_tsvector('english', coalesce(c.case_number, '') || ' ' || coalesce(c.case_type, ''))
          @@ plainto_tsquery('english', ${normalizedQuery})
        GROUP BY c.court_id, ct.name
        ORDER BY count DESC
        LIMIT 10
      `);

      // Status facets
      const statusFacets = await db.execute(sql`
        SELECT status, COUNT(*) as count
        FROM cases
        WHERE
          to_tsvector('english', coalesce(case_number, '') || ' ' || coalesce(case_type, ''))
          @@ plainto_tsquery('english', ${normalizedQuery})
        GROUP BY status
        ORDER BY count DESC
      `);

      // Year facets
      const yearFacets = await db.execute(sql`
        SELECT EXTRACT(YEAR FROM filing_date)::int as year, COUNT(*) as count
        FROM cases
        WHERE
          filing_date IS NOT NULL AND
          to_tsvector('english', coalesce(case_number, '') || ' ' || coalesce(case_type, ''))
          @@ plainto_tsquery('english', ${normalizedQuery})
        GROUP BY year
        ORDER BY year DESC
        LIMIT 10
      `);

      return {
        courts: (courtFacets.rows as unknown[]).map((r: unknown) => {
          const row = r as Record<string, unknown>;
          return {
            id: String(row.court_id),
            name: String(row.court_name || row.court_id),
            count: Number(row.count),
          };
        }),
        types: [
          { type: 'case', count: 0 },
          { type: 'ruling', count: 0 },
          { type: 'party', count: 0 },
          { type: 'document', count: 0 },
        ],
        statuses: (statusFacets.rows as unknown[]).map((r: unknown) => {
          const row = r as Record<string, unknown>;
          return {
            status: String(row.status),
            count: Number(row.count),
          };
        }),
        years: (yearFacets.rows as unknown[]).map((r: unknown) => {
          const row = r as Record<string, unknown>;
          return {
            year: Number(row.year),
            count: Number(row.count),
          };
        }),
      };
    } catch (error) {
      logger.error('Failed to get facets', { query, error: String(error) });
      return {
        courts: [],
        types: [],
        statuses: [],
        years: [],
      };
    }
  }

  /**
   * Get search suggestions/autocomplete
   */
  async getSuggestions(prefix: string, limit: number = 10): Promise<string[]> {
    const db = getDb(this.dbUrl);

    try {
      // Get case number suggestions
      const caseResults = await db.execute(sql`
        SELECT DISTINCT case_number
        FROM cases
        WHERE case_number ILIKE ${prefix + '%'}
        ORDER BY case_number
        LIMIT ${limit}
      `);

      // Get party name suggestions
      const partyResults = await db.execute(sql`
        SELECT DISTINCT name
        FROM case_parties
        WHERE name ILIKE ${prefix + '%'}
        ORDER BY name
        LIMIT ${limit}
      `);

      const suggestions: string[] = [];

      for (const row of caseResults.rows as unknown[]) {
        const r = row as { case_number: string };
        suggestions.push(r.case_number);
      }

      for (const row of partyResults.rows as unknown[]) {
        const r = row as { name: string };
        suggestions.push(r.name);
      }

      return [...new Set(suggestions)].slice(0, limit);
    } catch (error) {
      logger.error('Failed to get suggestions', { prefix, error: String(error) });
      return [];
    }
  }

  /**
   * Normalize search query
   */
  private normalizeQuery(query: string): string {
    return query
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')  // Remove special chars except hyphen
      .replace(/\s+/g, ' ');      // Normalize whitespace
  }
}

/**
 * Create search service instance
 */
export function createSearchService(dbUrl: string): SearchService {
  return new SearchService(dbUrl);
}
