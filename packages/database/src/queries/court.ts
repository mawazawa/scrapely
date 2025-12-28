/**
 * Court Data Query Helpers
 * Common database queries for court data operations
 */

import { and, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  $courts,
  $cases,
  $caseParties,
  $attorneys,
  $caseAttorneys,
  $rulings,
  $caseDocuments,
  $caseEvents,
  $caseTracking,
  $caseSnapshots,
  $caseNotes,
  $courtAlertHistory,
  $courtApiKeys,
} from '../schema';

type Database = PostgresJsDatabase;

// =============================================================================
// COURTS
// =============================================================================

/**
 * Get all enabled courts
 */
export async function getEnabledCourts(db: Database) {
  return db.select().from($courts).where(eq($courts.enabled, true));
}

/**
 * Get court by ID
 */
export async function getCourtById(db: Database, courtId: string) {
  const [court] = await db.select().from($courts).where(eq($courts.id, courtId));
  return court;
}

/**
 * Update court last scraped time
 */
export async function updateCourtLastScraped(db: Database, courtId: string) {
  return db
    .update($courts)
    .set({ lastScrapedAt: new Date() })
    .where(eq($courts.id, courtId));
}

// =============================================================================
// CASES
// =============================================================================

/**
 * Find case by case number and court
 */
export async function findCaseByCaseNumber(
  db: Database,
  caseNumber: string,
  courtId: string
) {
  const [caseRecord] = await db
    .select()
    .from($cases)
    .where(and(eq($cases.caseNumber, caseNumber), eq($cases.courtId, courtId)));
  return caseRecord;
}

/**
 * Search cases by party name
 */
export async function searchCasesByPartyName(
  db: Database,
  name: string,
  options?: { courtId?: string; limit?: number }
) {
  const conditions = [ilike($caseParties.name, `%${name}%`)];

  if (options?.courtId) {
    conditions.push(eq($cases.courtId, options.courtId));
  }

  return db
    .select({
      case: $cases,
      party: $caseParties,
    })
    .from($cases)
    .innerJoin($caseParties, eq($caseParties.caseId, $cases.id))
    .where(and(...conditions))
    .limit(options?.limit || 50);
}

/**
 * Get case with all related data
 */
export async function getCaseWithDetails(db: Database, caseId: number) {
  const [caseRecord] = await db.select().from($cases).where(eq($cases.id, caseId));
  if (!caseRecord) return null;

  const [parties, rulings, documents, events] = await Promise.all([
    db.select().from($caseParties).where(eq($caseParties.caseId, caseId)),
    db
      .select()
      .from($rulings)
      .where(eq($rulings.caseId, caseId))
      .orderBy(desc($rulings.rulingDate)),
    db
      .select()
      .from($caseDocuments)
      .where(eq($caseDocuments.caseId, caseId))
      .orderBy(desc($caseDocuments.filedDate)),
    db
      .select()
      .from($caseEvents)
      .where(eq($caseEvents.caseId, caseId))
      .orderBy(desc($caseEvents.eventDate)),
  ]);

  return {
    ...caseRecord,
    parties,
    rulings,
    documents,
    events,
  };
}

/**
 * Upsert case (create or update)
 */
export async function upsertCase(
  db: Database,
  caseData: typeof $cases.$inferInsert
) {
  const existing = await findCaseByCaseNumber(
    db,
    caseData.caseNumber,
    caseData.courtId
  );

  if (existing) {
    const [updated] = await db
      .update($cases)
      .set({
        ...caseData,
        lastUpdated: new Date(),
        lastScrapedAt: new Date(),
      })
      .where(eq($cases.id, existing.id))
      .returning();
    return { case: updated, isNew: false };
  }

  const [inserted] = await db.insert($cases).values(caseData).returning();
  return { case: inserted, isNew: true };
}

/**
 * Get recently updated cases
 */
export async function getRecentlyUpdatedCases(
  db: Database,
  options?: { courtId?: string; limit?: number; since?: Date }
) {
  const conditions = [];

  if (options?.courtId) {
    conditions.push(eq($cases.courtId, options.courtId));
  }

  if (options?.since) {
    conditions.push(gte($cases.lastUpdated, options.since));
  }

  return db
    .select()
    .from($cases)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc($cases.lastUpdated))
    .limit(options?.limit || 50);
}

// =============================================================================
// RULINGS
// =============================================================================

/**
 * Get rulings for a date
 */
export async function getRulingsByDate(
  db: Database,
  date: Date,
  courtId?: string
) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const conditions = [
    gte($rulings.rulingDate, startOfDay),
    lte($rulings.rulingDate, endOfDay),
  ];

  if (courtId) {
    conditions.push(eq($cases.courtId, courtId));
  }

  return db
    .select({
      ruling: $rulings,
      case: $cases,
    })
    .from($rulings)
    .innerJoin($cases, eq($rulings.caseId, $cases.id))
    .where(and(...conditions))
    .orderBy($rulings.department, $rulings.rulingDate);
}

/**
 * Get rulings for tracked cases
 */
export async function getRulingsForTrackedCases(
  db: Database,
  userId: string,
  options?: { since?: Date; limit?: number }
) {
  const conditions = [eq($caseTracking.userId, userId)];

  if (options?.since) {
    conditions.push(gte($rulings.rulingDate, options.since));
  }

  return db
    .select({
      ruling: $rulings,
      case: $cases,
      tracking: $caseTracking,
    })
    .from($rulings)
    .innerJoin($cases, eq($rulings.caseId, $cases.id))
    .innerJoin($caseTracking, eq($caseTracking.caseId, $cases.id))
    .where(and(...conditions))
    .orderBy(desc($rulings.rulingDate))
    .limit(options?.limit || 50);
}

/**
 * Insert ruling
 */
export async function insertRuling(
  db: Database,
  rulingData: typeof $rulings.$inferInsert
) {
  const [ruling] = await db.insert($rulings).values(rulingData).returning();
  return ruling;
}

// =============================================================================
// CASE TRACKING
// =============================================================================

/**
 * Get user's tracked cases
 */
export async function getUserTrackedCases(
  db: Database,
  userId: string,
  options?: { limit?: number; offset?: number }
) {
  return db
    .select({
      tracking: $caseTracking,
      case: $cases,
      court: $courts,
    })
    .from($caseTracking)
    .innerJoin($cases, eq($caseTracking.caseId, $cases.id))
    .innerJoin($courts, eq($cases.courtId, $courts.id))
    .where(eq($caseTracking.userId, userId))
    .orderBy(desc($caseTracking.createdAt))
    .limit(options?.limit || 50)
    .offset(options?.offset || 0);
}

/**
 * Track a case
 */
export async function trackCase(
  db: Database,
  userId: string,
  caseId: number,
  options?: { nickname?: string; priority?: string }
) {
  const [tracking] = await db
    .insert($caseTracking)
    .values({
      userId,
      caseId,
      nickname: options?.nickname,
      priority: options?.priority || 'normal',
    })
    .returning();
  return tracking;
}

/**
 * Untrack a case
 */
export async function untrackCase(
  db: Database,
  userId: string,
  caseId: number
) {
  return db
    .delete($caseTracking)
    .where(and(eq($caseTracking.userId, userId), eq($caseTracking.caseId, caseId)));
}

/**
 * Check if user is tracking a case
 */
export async function isTrackingCase(
  db: Database,
  userId: string,
  caseId: number
) {
  const [tracking] = await db
    .select()
    .from($caseTracking)
    .where(and(eq($caseTracking.userId, userId), eq($caseTracking.caseId, caseId)));
  return !!tracking;
}

/**
 * Get all users tracking a case
 */
export async function getUsersTrackingCase(db: Database, caseId: number) {
  return db
    .select({
      userId: $caseTracking.userId,
      alertsEnabled: $caseTracking.alertsEnabled,
    })
    .from($caseTracking)
    .where(and(eq($caseTracking.caseId, caseId), eq($caseTracking.alertsEnabled, true)));
}

// =============================================================================
// SNAPSHOTS (Change Detection)
// =============================================================================

/**
 * Get latest snapshot for a case
 */
export async function getLatestSnapshot(db: Database, caseId: number) {
  const [snapshot] = await db
    .select()
    .from($caseSnapshots)
    .where(eq($caseSnapshots.caseId, caseId))
    .orderBy(desc($caseSnapshots.createdAt))
    .limit(1);
  return snapshot;
}

/**
 * Create snapshot
 */
export async function createSnapshot(
  db: Database,
  snapshotData: typeof $caseSnapshots.$inferInsert
) {
  const [snapshot] = await db.insert($caseSnapshots).values(snapshotData).returning();
  return snapshot;
}

/**
 * Get change history for a case
 */
export async function getCaseChangeHistory(
  db: Database,
  caseId: number,
  limit: number = 20
) {
  return db
    .select()
    .from($caseSnapshots)
    .where(eq($caseSnapshots.caseId, caseId))
    .orderBy(desc($caseSnapshots.createdAt))
    .limit(limit);
}

// =============================================================================
// API KEYS
// =============================================================================

/**
 * Get API key by key string
 */
export async function getApiKeyByKey(db: Database, key: string) {
  const [apiKey] = await db
    .select()
    .from($courtApiKeys)
    .where(and(eq($courtApiKeys.key, key), sql`${$courtApiKeys.revokedAt} IS NULL`));
  return apiKey;
}

/**
 * Get user's API keys
 */
export async function getUserApiKeys(db: Database, userId: string) {
  return db
    .select({
      id: $courtApiKeys.id,
      name: $courtApiKeys.name,
      prefix: $courtApiKeys.prefix,
      tier: $courtApiKeys.tier,
      rateLimit: $courtApiKeys.rateLimit,
      usageCount: $courtApiKeys.usageCount,
      lastUsedAt: $courtApiKeys.lastUsedAt,
      createdAt: $courtApiKeys.createdAt,
      expiresAt: $courtApiKeys.expiresAt,
    })
    .from($courtApiKeys)
    .where(and(eq($courtApiKeys.userId, userId), sql`${$courtApiKeys.revokedAt} IS NULL`));
}

/**
 * Create API key
 */
export async function createApiKey(
  db: Database,
  keyData: typeof $courtApiKeys.$inferInsert
) {
  const [apiKey] = await db.insert($courtApiKeys).values(keyData).returning();
  return apiKey;
}

/**
 * Revoke API key
 */
export async function revokeApiKey(db: Database, keyId: number, userId: string) {
  return db
    .update($courtApiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq($courtApiKeys.id, keyId), eq($courtApiKeys.userId, userId)));
}

/**
 * Increment API key usage
 */
export async function incrementApiKeyUsage(db: Database, keyId: number) {
  return db
    .update($courtApiKeys)
    .set({
      usageCount: sql`${$courtApiKeys.usageCount} + 1`,
      lastUsedAt: new Date(),
    })
    .where(eq($courtApiKeys.id, keyId));
}

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * Get court statistics
 */
export async function getCourtStats(db: Database, courtId?: string) {
  const conditions = courtId ? [eq($cases.courtId, courtId)] : [];

  const [stats] = await db
    .select({
      totalCases: sql<number>`count(*)`,
      openCases: sql<number>`count(*) filter (where ${$cases.status} = 'open')`,
      closedCases: sql<number>`count(*) filter (where ${$cases.status} = 'closed')`,
    })
    .from($cases)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const [rulingStats] = await db
    .select({
      totalRulings: sql<number>`count(*)`,
      grantedRulings: sql<number>`count(*) filter (where ${$rulings.outcome} = 'granted')`,
      deniedRulings: sql<number>`count(*) filter (where ${$rulings.outcome} = 'denied')`,
    })
    .from($rulings);

  return {
    ...stats,
    ...rulingStats,
  };
}

/**
 * Get tracking statistics for a user
 */
export async function getUserTrackingStats(db: Database, userId: string) {
  const [stats] = await db
    .select({
      trackedCases: sql<number>`count(*)`,
      highPriority: sql<number>`count(*) filter (where ${$caseTracking.priority} = 'high')`,
      urgentPriority: sql<number>`count(*) filter (where ${$caseTracking.priority} = 'urgent')`,
    })
    .from($caseTracking)
    .where(eq($caseTracking.userId, userId));

  return stats;
}
