/**
 * API Schema definitions for Meridian
 * Used for OpenAPI documentation and validation
 */

import { z } from 'zod';

// Common schemas
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Events endpoint
export const eventsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const eventSchema = z.object({
  id: z.number(),
  sourceId: z.number(),
  url: z.string().url(),
  title: z.string(),
  publishDate: z.string().datetime(),
  content: z.string().nullable(),
  location: z.string().nullable(),
  completeness: z.enum(['COMPLETE', 'PARTIAL', 'PARTIAL_USELESS']).nullable(),
  relevance: z.enum(['RELEVANT', 'NOT_RELEVANT', 'UNKNOWN']).nullable(),
  summary: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const eventsResponseSchema = z.object({
  sources: z.array(z.object({
    id: z.number(),
    name: z.string(),
  })),
  events: z.array(eventSchema),
  dateRange: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
  }),
});

// Reports endpoints
export const reportSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  modelAuthor: z.string().nullable(),
  clusteringParams: z.record(z.unknown()).nullable(),
  totalArticles: z.number().nullable(),
  createdAt: z.string().datetime(),
});

export const reportListItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  createdAt: z.string().datetime(),
  totalArticles: z.number().nullable(),
  slug: z.string(),
});

export const reportsResponseSchema = z.object({
  reports: z.array(reportListItemSchema),
  total: z.number(),
});

// OpenGraph endpoint
export const openGraphQuerySchema = z.object({
  title: z.string(),
  date: z.string().transform(val => new Date(parseInt(val))),
  articles: z.string().transform(val => parseInt(val)),
  sources: z.string().transform(val => parseInt(val)),
});

// Newsletter
export const subscribeBodySchema = z.object({
  email: z.string().email(),
});

export const subscribeResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// Stats endpoint
export const statsResponseSchema = z.object({
  overview: z.object({
    totalSources: z.number(),
    totalArticles: z.number(),
    articlesLast24h: z.number(),
    processedLast24h: z.number(),
    pendingArticles: z.number(),
    failedArticles: z.number(),
  }),
  recentReports: z.array(z.object({
    id: z.number(),
    title: z.string(),
    createdAt: z.string().datetime(),
    totalArticles: z.number().nullable(),
  })),
  sourceBreakdown: z.array(z.object({
    sourceName: z.string(),
    count: z.number(),
  })),
  relevanceBreakdown: z.array(z.object({
    relevance: z.string().nullable(),
    count: z.number(),
  })),
  models: z.object({
    analysis: z.string(),
    synthesis: z.string(),
    ocr: z.string(),
    scraping: z.string(),
  }),
});

// Type exports
export type EventsQuery = z.infer<typeof eventsQuerySchema>;
export type EventsResponse = z.infer<typeof eventsResponseSchema>;
export type Report = z.infer<typeof reportSchema>;
export type ReportsResponse = z.infer<typeof reportsResponseSchema>;
export type SubscribeBody = z.infer<typeof subscribeBodySchema>;
export type StatsResponse = z.infer<typeof statsResponseSchema>;
