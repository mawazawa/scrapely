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

// =============================================================================
// COURT DATA TABLES
// =============================================================================

/**
 * Courts - Registry of supported courts
 */
export const $courts = pgTable('courts', {
  id: text('id').primaryKey(), // e.g., 'sf-superior', 'la-superior'
  name: text('name').notNull(),
  county: text('county').notNull(),
  state: text('state').notNull().default('CA'),
  type: text('type').notNull(), // 'superior', 'appellate', 'supreme', 'federal'
  baseUrl: text('base_url').notNull(),
  timezone: text('timezone').default('America/Los_Angeles'),
  enabled: boolean('enabled').default(true),
  lastScrapedAt: timestamp('last_scraped_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
});

/**
 * Cases - Court case records
 */
export const $cases = pgTable('cases', {
  id: serial('id').primaryKey(),
  caseNumber: text('case_number').notNull(),
  courtId: text('court_id')
    .references(() => $courts.id)
    .notNull(),
  title: text('title').notNull(),
  caseType: text('case_type').notNull(), // 'civil', 'family', 'criminal', 'probate', etc.
  caseSubType: text('case_sub_type'),
  status: text('status').notNull().default('open'), // 'open', 'closed', 'pending', 'disposed'
  filedDate: timestamp('filed_date', { mode: 'date' }),
  dispositionDate: timestamp('disposition_date', { mode: 'date' }),
  department: text('department'),
  judge: text('judge'),
  lastUpdated: timestamp('last_updated', { mode: 'date' }),
  lastScrapedAt: timestamp('last_scraped_at', { mode: 'date' }),
  sourceUrl: text('source_url'),
  rawData: jsonb('raw_data'),
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
});

/**
 * Case parties - Plaintiffs, defendants, etc.
 */
export const $caseParties = pgTable('case_parties', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id')
    .references(() => $cases.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'plaintiff', 'defendant', 'petitioner', 'respondent'
  isLead: boolean('is_lead').default(false),
  entityType: text('entity_type'), // 'individual', 'corporation', 'government'
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
});

/**
 * Attorneys on cases
 */
export const $attorneys = pgTable('attorneys', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  barNumber: text('bar_number'),
  firm: text('firm'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
});

/**
 * Case-attorney relationships
 */
export const $caseAttorneys = pgTable('case_attorneys', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id')
    .references(() => $cases.id, { onDelete: 'cascade' })
    .notNull(),
  attorneyId: integer('attorney_id')
    .references(() => $attorneys.id)
    .notNull(),
  partyId: integer('party_id')
    .references(() => $caseParties.id),
  isLeadCounsel: boolean('is_lead_counsel').default(false),
  role: text('role'), // 'attorney', 'co-counsel', 'of counsel'
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
});

/**
 * Court rulings (tentative and final)
 */
export const $rulings = pgTable('rulings', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id')
    .references(() => $cases.id, { onDelete: 'cascade' })
    .notNull(),
  rulingDate: timestamp('ruling_date', { mode: 'date' }).notNull(),
  hearingDate: timestamp('hearing_date', { mode: 'date' }),
  department: text('department').notNull(),
  judge: text('judge'),
  motionType: text('motion_type').notNull(),
  rulingType: text('ruling_type').notNull().default('tentative'), // 'tentative', 'final'
  outcome: text('outcome').notNull(), // 'granted', 'denied', 'continued', 'moot', etc.
  text: text('text').notNull(),
  movingParty: text('moving_party'),
  respondingParty: text('responding_party'),
  sourceUrl: text('source_url'),
  scrapedAt: timestamp('scraped_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
});

/**
 * Case documents (filings)
 */
export const $caseDocuments = pgTable('case_documents', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id')
    .references(() => $cases.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  description: text('description'),
  documentType: text('document_type').notNull(), // 'complaint', 'motion', 'order', etc.
  filedDate: timestamp('filed_date', { mode: 'date' }),
  filedBy: text('filed_by'),
  pageCount: integer('page_count'),
  fileSize: integer('file_size'),
  storageKey: text('storage_key'), // R2 storage key
  ocrText: text('ocr_text'),
  sourceUrl: text('source_url'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
});

/**
 * Case events (calendar, hearings)
 */
export const $caseEvents = pgTable('case_events', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id')
    .references(() => $cases.id, { onDelete: 'cascade' })
    .notNull(),
  eventType: text('event_type').notNull(), // 'hearing', 'trial', 'conference', 'filing'
  eventDate: timestamp('event_date', { mode: 'date' }).notNull(),
  eventTime: text('event_time'),
  department: text('department'),
  judge: text('judge'),
  description: text('description'),
  result: text('result'),
  location: text('location'),
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
});

/**
 * User case tracking
 */
export const $caseTracking = pgTable('case_tracking', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  caseId: integer('case_id')
    .references(() => $cases.id, { onDelete: 'cascade' })
    .notNull(),
  nickname: text('nickname'), // User's label for the case
  priority: text('priority').default('normal'), // 'low', 'normal', 'high', 'urgent'
  notes: text('notes'),
  alertsEnabled: boolean('alerts_enabled').default(true),
  lastViewedAt: timestamp('last_viewed_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
});

/**
 * Case update snapshots (for change detection)
 */
export const $caseSnapshots = pgTable('case_snapshots', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id')
    .references(() => $cases.id, { onDelete: 'cascade' })
    .notNull(),
  snapshotData: jsonb('snapshot_data').notNull(),
  hash: text('hash').notNull(),
  changeType: text('change_type'), // 'new_ruling', 'new_filing', 'status_change', etc.
  changeDetails: jsonb('change_details'),
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
});

/**
 * Case notes (user annotations)
 */
export const $caseNotes = pgTable('case_notes', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  caseId: integer('case_id')
    .references(() => $cases.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title'),
  content: text('content').notNull(),
  isPinned: boolean('is_pinned').default(false),
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});

/**
 * Alert history
 */
export const $courtAlertHistory = pgTable('court_alert_history', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  caseId: integer('case_id')
    .references(() => $cases.id),
  alertType: text('alert_type').notNull(), // 'new_ruling', 'hearing_reminder', 'status_change'
  title: text('title').notNull(),
  message: text('message'),
  channel: text('channel').notNull(), // 'email', 'push', 'webhook'
  deliveredAt: timestamp('delivered_at', { mode: 'date' }),
  readAt: timestamp('read_at', { mode: 'date' }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
});

/**
 * Court API keys
 */
export const $courtApiKeys = pgTable('court_api_keys', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  key: text('key').notNull().unique(),
  hashedKey: text('hashed_key').notNull(),
  prefix: text('prefix').notNull(), // First 8 chars for identification
  scopes: jsonb('scopes').default([]), // ['read:cases', 'read:rulings', 'search']
  tier: text('tier').default('free'), // 'free', 'pro', 'enterprise'
  rateLimit: integer('rate_limit').default(100), // Requests per minute
  usageCount: integer('usage_count').default(0),
  lastUsedAt: timestamp('last_used_at', { mode: 'date' }),
  expiresAt: timestamp('expires_at', { mode: 'date' }),
  revokedAt: timestamp('revoked_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
});
