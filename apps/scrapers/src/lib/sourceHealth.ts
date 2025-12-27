/**
 * Source health monitoring
 * Tracks scrape success rates and manages source reliability
 */

import { $sources, eq, sql } from '@meridian/database';
import { getDb } from './utils';
import { logger } from './logger';

/**
 * Source health metrics
 */
export interface SourceHealthMetrics {
  sourceId: number;
  sourceName: string;
  successRate: number;
  totalScrapes: number;
  successfulScrapes: number;
  failedScrapes: number;
  lastSuccess: Date | null;
  lastFailure: Date | null;
  lastError: string | null;
  avgResponseTimeMs: number | null;
  status: 'healthy' | 'degraded' | 'failing' | 'disabled';
}

/**
 * Health thresholds
 */
export const HEALTH_THRESHOLDS = {
  HEALTHY: 0.9, // 90%+ success rate
  DEGRADED: 0.7, // 70-90% success rate
  FAILING: 0.5, // 50-70% success rate
  // Below 50% = critical
};

/**
 * Auto-disable threshold
 */
export const AUTO_DISABLE_THRESHOLD = 0.3; // Below 30% success rate

/**
 * Calculate source health status
 */
export function calculateHealthStatus(successRate: number): SourceHealthMetrics['status'] {
  if (successRate >= HEALTH_THRESHOLDS.HEALTHY) return 'healthy';
  if (successRate >= HEALTH_THRESHOLDS.DEGRADED) return 'degraded';
  if (successRate >= HEALTH_THRESHOLDS.FAILING) return 'failing';
  return 'disabled';
}

/**
 * Record a scrape result for a source
 */
export async function recordScrapeResult(
  dbUrl: string,
  sourceId: number,
  success: boolean,
  responseTimeMs?: number,
  error?: string
): Promise<void> {
  const db = getDb(dbUrl);

  try {
    // Update source with new metrics
    // Using raw SQL for atomic increment operations
    if (success) {
      await db.execute(sql`
        UPDATE sources
        SET
          success_count = COALESCE(success_count, 0) + 1,
          total_scrapes = COALESCE(total_scrapes, 0) + 1,
          last_success = NOW(),
          avg_response_time_ms = CASE
            WHEN avg_response_time_ms IS NULL THEN ${responseTimeMs || 0}
            ELSE (avg_response_time_ms * 0.9 + ${responseTimeMs || 0} * 0.1)
          END,
          success_rate = CAST(COALESCE(success_count, 0) + 1 AS FLOAT) / (COALESCE(total_scrapes, 0) + 1)
        WHERE id = ${sourceId}
      `);
    } else {
      await db.execute(sql`
        UPDATE sources
        SET
          failure_count = COALESCE(failure_count, 0) + 1,
          total_scrapes = COALESCE(total_scrapes, 0) + 1,
          last_failure = NOW(),
          last_error = ${error || 'Unknown error'},
          success_rate = CAST(COALESCE(success_count, 0) AS FLOAT) / (COALESCE(total_scrapes, 0) + 1)
        WHERE id = ${sourceId}
      `);
    }

    logger.info('Recorded scrape result', {
      sourceId,
      success,
      responseTimeMs,
    });
  } catch (err) {
    logger.error('Failed to record scrape result', {
      sourceId,
      error: String(err),
    });
  }
}

/**
 * Get health metrics for all sources
 */
export async function getAllSourceHealth(dbUrl: string): Promise<SourceHealthMetrics[]> {
  const db = getDb(dbUrl);

  const sources = await db
    .select({
      id: $sources.id,
      name: $sources.name,
      url: $sources.url,
      // These columns need to exist in schema
    })
    .from($sources);

  // For now, return placeholder data until schema is updated
  return sources.map(source => ({
    sourceId: source.id,
    sourceName: source.name || source.url,
    successRate: 1.0, // Will be calculated from actual data
    totalScrapes: 0,
    successfulScrapes: 0,
    failedScrapes: 0,
    lastSuccess: null,
    lastFailure: null,
    lastError: null,
    avgResponseTimeMs: null,
    status: 'healthy' as const,
  }));
}

/**
 * Get health metrics for a specific source
 */
export async function getSourceHealth(
  dbUrl: string,
  sourceId: number
): Promise<SourceHealthMetrics | null> {
  const allHealth = await getAllSourceHealth(dbUrl);
  return allHealth.find(h => h.sourceId === sourceId) || null;
}

/**
 * Get sources that need attention (degraded or failing)
 */
export async function getUnhealthySources(dbUrl: string): Promise<SourceHealthMetrics[]> {
  const allHealth = await getAllSourceHealth(dbUrl);
  return allHealth.filter(h => h.status !== 'healthy');
}

/**
 * Check if a source should be auto-disabled
 */
export function shouldAutoDisable(metrics: SourceHealthMetrics): boolean {
  // Need at least 10 scrapes to make a decision
  if (metrics.totalScrapes < 10) return false;
  return metrics.successRate < AUTO_DISABLE_THRESHOLD;
}

/**
 * Disable a source due to poor health
 */
export async function disableSource(
  dbUrl: string,
  sourceId: number,
  reason: string
): Promise<void> {
  const db = getDb(dbUrl);

  await db.execute(sql`
    UPDATE sources
    SET
      disabled = TRUE,
      disabled_reason = ${reason},
      disabled_at = NOW()
    WHERE id = ${sourceId}
  `);

  logger.warn('Source auto-disabled due to poor health', {
    sourceId,
    reason,
  });
}

/**
 * Re-enable a previously disabled source
 */
export async function enableSource(
  dbUrl: string,
  sourceId: number
): Promise<void> {
  const db = getDb(dbUrl);

  await db.execute(sql`
    UPDATE sources
    SET
      disabled = FALSE,
      disabled_reason = NULL,
      disabled_at = NULL,
      success_count = 0,
      failure_count = 0,
      total_scrapes = 0,
      success_rate = NULL
    WHERE id = ${sourceId}
  `);

  logger.info('Source re-enabled', { sourceId });
}

/**
 * Get health summary for dashboard
 */
export async function getHealthSummary(dbUrl: string): Promise<{
  total: number;
  healthy: number;
  degraded: number;
  failing: number;
  disabled: number;
  avgSuccessRate: number;
}> {
  const allHealth = await getAllSourceHealth(dbUrl);

  const summary = {
    total: allHealth.length,
    healthy: 0,
    degraded: 0,
    failing: 0,
    disabled: 0,
    avgSuccessRate: 0,
  };

  let totalRate = 0;
  for (const health of allHealth) {
    switch (health.status) {
      case 'healthy':
        summary.healthy++;
        break;
      case 'degraded':
        summary.degraded++;
        break;
      case 'failing':
        summary.failing++;
        break;
      case 'disabled':
        summary.disabled++;
        break;
    }
    totalRate += health.successRate;
  }

  summary.avgSuccessRate = allHealth.length > 0 ? totalRate / allHealth.length : 0;

  return summary;
}

/**
 * Send health alert
 */
export async function sendHealthAlert(
  metrics: SourceHealthMetrics,
  alertType: 'degraded' | 'failing' | 'disabled'
): Promise<void> {
  logger.warn(`Source health alert: ${alertType}`, {
    sourceId: metrics.sourceId,
    sourceName: metrics.sourceName,
    successRate: metrics.successRate,
    lastError: metrics.lastError,
  });

  // In production, this would send to Slack/Discord/email
  // For now, just log the alert
}
