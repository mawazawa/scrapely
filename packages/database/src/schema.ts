import { sql } from 'drizzle-orm';
import { boolean, integer, jsonb, pgTable, real, serial, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Note: We use $ to denote the table objects
 * This frees up the uses of sources, articles, reports, etc as variables in the codebase
 **/

export const $sources = pgTable('sources', {
  id: serial('id').primaryKey(),
  url: text('url').notNull().unique(),
  name: text('name').notNull(),
  scrape_frequency: integer('scrape_frequency').notNull().default(2), // 1=hourly, 2=4hrs, 3=6hrs, 4=daily
  category: text('category').notNull(),
  lastChecked: timestamp('last_checked', { mode: 'date' }),

  // Health monitoring
  successCount: integer('success_count').default(0),
  failureCount: integer('failure_count').default(0),
  totalScrapes: integer('total_scrapes').default(0),
  successRate: real('success_rate'),
  avgResponseTimeMs: integer('avg_response_time_ms'),
  lastSuccess: timestamp('last_success', { mode: 'date' }),
  lastFailure: timestamp('last_failure', { mode: 'date' }),
  lastError: text('last_error'),

  // Auto-disable
  disabled: boolean('disabled').default(false),
  disabledReason: text('disabled_reason'),
  disabledAt: timestamp('disabled_at', { mode: 'date' }),

  // Discovery metadata
  discoveredFrom: text('discovered_from'),
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
});

export const $articles = pgTable('articles', {
  id: serial('id').primaryKey(),

  title: text('title').notNull(),
  url: text('url').notNull().unique(),
  publishDate: timestamp('publish_date', { mode: 'date' }),

  content: text('content'),
  language: text('language'),
  location: text('location'),
  completeness: text('completeness'),
  relevance: text('relevance'),
  summary: text('summary'),
  failReason: text('fail_reason'),

  // Deduplication
  contentHash: text('content_hash'),
  duplicateOf: integer('duplicate_of').references(() => $articles.id),

  // Moderation
  flagged: boolean('flagged').default(false),
  moderationStatus: text('moderation_status'), // 'pending', 'approved', 'rejected'
  moderationReason: text('moderation_reason'),
  moderatedAt: timestamp('moderated_at', { mode: 'date' }),
  moderatedBy: text('moderated_by'),

  // Entities and analysis
  entities: jsonb('entities'),
  category: text('category'),
  region: text('region'),

  sourceId: integer('source_id')
    .references(() => $sources.id)
    .notNull(),

  processedAt: timestamp('processed_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
});

export const $reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  content: text('content').notNull(),

  totalArticles: integer('total_articles').notNull(),
  totalSources: integer('total_sources').notNull(),

  usedArticles: integer('used_articles').notNull(),
  usedSources: integer('used_sources').notNull(),

  tldr: text('tldr'),

  clustering_params: jsonb('clustering_params'),

  model_author: text('model_author'),

  // Versioning
  version: integer('version').default(1),

  createdAt: timestamp('created_at', { mode: 'date' })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});

export const $reportVersions = pgTable('report_versions', {
  id: serial('id').primaryKey(),
  reportId: integer('report_id')
    .references(() => $reports.id)
    .notNull(),
  version: integer('version').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  author: text('author'),
  reason: text('reason'),
  diff: jsonb('diff'),
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
});

export const $newsletter = pgTable('newsletter', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
  unsubscribedAt: timestamp('unsubscribed_at', { mode: 'date' }),
  lastSentAt: timestamp('last_sent_at', { mode: 'date' }),
});

export const $userPreferences = pgTable('user_preferences', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  topics: jsonb('topics').default([]),
  regions: jsonb('regions').default([]),
  sources: jsonb('sources').default({ included: [], excluded: [] }),
  notifications: jsonb('notifications').default({ email: true, push: false, frequency: 'daily' }),
  display: jsonb('display').default({ language: 'en', theme: 'system', summaryLength: 'medium' }),
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});

export const $pushSubscriptions = pgTable('push_subscriptions', {
  id: serial('id').primaryKey(),
  subscriptionId: text('subscription_id').notNull().unique(),
  userId: text('user_id').notNull(),
  endpoint: text('endpoint').notNull(),
  keys: jsonb('keys').notNull(),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
  lastUsed: timestamp('last_used', { mode: 'date' }),
});

export const $experiments = pgTable('experiments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  variants: jsonb('variants').notNull(), // [{ name: 'control', weight: 50 }, { name: 'treatment', weight: 50 }]
  status: text('status').default('draft'), // 'draft', 'running', 'paused', 'completed'
  targetPercentage: integer('target_percentage').default(100),
  startedAt: timestamp('started_at', { mode: 'date' }),
  endedAt: timestamp('ended_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
});

export const $experimentAssignments = pgTable('experiment_assignments', {
  id: serial('id').primaryKey(),
  experimentId: integer('experiment_id')
    .references(() => $experiments.id)
    .notNull(),
  userId: text('user_id').notNull(),
  variant: text('variant').notNull(),
  assignedAt: timestamp('assigned_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
});

export const $briefSchedules = pgTable('brief_schedules', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  cronExpression: text('cron_expression').notNull(),
  timezone: text('timezone').default('UTC'),
  enabled: boolean('enabled').default(true),
  lastRun: timestamp('last_run', { mode: 'date' }),
  nextRun: timestamp('next_run', { mode: 'date' }),
  config: jsonb('config'), // Additional config like topics, sources to include
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
});
