/**
 * Alert Batching
 * Combine multiple alerts into digest emails
 */

import { logger } from '../../lib/logger';
import type {
  CourtAlert,
  AlertBatch,
  AlertPreferences,
  CourtAlertType,
  AlertPriority,
} from './types';
import { getPriorityLevel } from './types';

/**
 * Batching configuration
 */
export interface BatchingConfig {
  defaultIntervalMinutes: number;
  maxAlertsPerBatch: number;
  maxBatchAgeMinutes: number;
}

/**
 * Default batching config
 */
const DEFAULT_BATCHING_CONFIG: BatchingConfig = {
  defaultIntervalMinutes: 30,
  maxAlertsPerBatch: 50,
  maxBatchAgeMinutes: 60,
};

/**
 * Alert batch manager using KV storage
 */
export class AlertBatcher {
  private kv: KVNamespace;
  private config: BatchingConfig;
  private prefix: string;

  constructor(
    kv: KVNamespace,
    config: Partial<BatchingConfig> = {},
    prefix: string = 'alert_batch:'
  ) {
    this.kv = kv;
    this.config = { ...DEFAULT_BATCHING_CONFIG, ...config };
    this.prefix = prefix;
  }

  /**
   * Add an alert to the batch for a user
   */
  async addToBatch(
    alert: CourtAlert,
    prefs: AlertPreferences
  ): Promise<{ batched: boolean; batchId?: string }> {
    // Check if this alert type should skip batching
    if (this.shouldSkipBatching(alert, prefs)) {
      return { batched: false };
    }

    try {
      // Get or create batch
      let batch = await this.getBatch(alert.userId);

      // If batch exists and is already full, don't add to it
      // Return false so the alert is sent immediately instead
      if (batch && batch.alerts.length >= this.config.maxAlertsPerBatch) {
        logger.debug('Batch is full, alert will be sent immediately', {
          alertId: alert.id,
          batchId: batch.id,
          batchSize: batch.alerts.length,
        });
        return { batched: false };
      }

      if (!batch) {
        batch = this.createBatch(alert.userId, prefs);
      }

      // Add alert to batch
      batch.alerts.push(alert);

      // Check if batch is now full and mark for sending
      if (batch.alerts.length >= this.config.maxAlertsPerBatch) {
        batch.status = 'pending';
      }

      // Save batch
      await this.saveBatch(batch);

      logger.debug('Alert added to batch', {
        alertId: alert.id,
        batchId: batch.id,
        batchSize: batch.alerts.length,
      });

      return { batched: true, batchId: batch.id };
    } catch (error) {
      logger.error('Failed to add alert to batch', {
        alertId: alert.id,
        error: String(error),
      });
      return { batched: false };
    }
  }

  /**
   * Get pending batch for a user
   */
  async getBatch(userId: string): Promise<AlertBatch | null> {
    const key = `${this.prefix}${userId}`;
    const data = await this.kv.get(key, 'json');

    if (!data) return null;

    const batch = data as AlertBatch;
    batch.scheduledFor = new Date(batch.scheduledFor);
    batch.createdAt = new Date(batch.createdAt);

    return batch;
  }

  /**
   * Get all pending batches ready to send
   */
  async getPendingBatches(): Promise<AlertBatch[]> {
    const batches: AlertBatch[] = [];
    let cursor: string | undefined;

    do {
      const list = await this.kv.list({ prefix: this.prefix, cursor });

      for (const key of list.keys) {
        const batch = await this.getBatch(key.name.replace(this.prefix, ''));
        if (batch && this.isReadyToSend(batch)) {
          batches.push(batch);
        }
      }

      cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor);

    return batches;
  }

  /**
   * Mark batch as sent
   */
  async markAsSent(batchId: string, userId: string): Promise<void> {
    const key = `${this.prefix}${userId}`;

    // Delete the batch from KV
    await this.kv.delete(key);

    logger.info('Batch marked as sent', { batchId, userId });
  }

  /**
   * Delete a batch
   */
  async deleteBatch(userId: string): Promise<void> {
    const key = `${this.prefix}${userId}`;
    await this.kv.delete(key);
  }

  /**
   * Create a new batch
   */
  private createBatch(userId: string, prefs: AlertPreferences): AlertBatch {
    const intervalMs = (prefs.batchIntervalMinutes || this.config.defaultIntervalMinutes) * 60 * 1000;

    return {
      id: crypto.randomUUID(),
      userId,
      alerts: [],
      scheduledFor: new Date(Date.now() + intervalMs),
      status: 'pending',
      createdAt: new Date(),
    };
  }

  /**
   * Save batch to KV
   */
  private async saveBatch(batch: AlertBatch): Promise<void> {
    const key = `${this.prefix}${batch.userId}`;
    const ttl = Math.max(
      3600,  // Minimum 1 hour
      Math.ceil(this.config.maxBatchAgeMinutes * 60)
    );

    await this.kv.put(key, JSON.stringify(batch), { expirationTtl: ttl });
  }

  /**
   * Check if batch is ready to send
   */
  private isReadyToSend(batch: AlertBatch): boolean {
    const now = new Date();

    // Check if scheduled time has passed
    if (now >= batch.scheduledFor) {
      return true;
    }

    // Check if batch is at max capacity
    if (batch.alerts.length >= this.config.maxAlertsPerBatch) {
      return true;
    }

    // Check if batch is too old
    const ageMs = now.getTime() - batch.createdAt.getTime();
    if (ageMs > this.config.maxBatchAgeMinutes * 60 * 1000) {
      return true;
    }

    return false;
  }

  /**
   * Check if an alert should skip batching
   */
  private shouldSkipBatching(alert: CourtAlert, prefs: AlertPreferences): boolean {
    // Batching disabled for user
    if (!prefs.batchingEnabled) {
      return true;
    }

    // Critical priority alerts
    if (alert.priority === 'critical') {
      return true;
    }

    // Alert type is in immediate list
    if (prefs.immediateFor?.includes(alert.alertType)) {
      return true;
    }

    return false;
  }
}

/**
 * Group alerts by case for digest
 */
export function groupAlertsByCase(alerts: CourtAlert[]): Map<string, CourtAlert[]> {
  const groups = new Map<string, CourtAlert[]>();

  for (const alert of alerts) {
    const key = alert.caseNumber;
    const existing = groups.get(key) || [];
    existing.push(alert);
    groups.set(key, existing);
  }

  return groups;
}

/**
 * Sort alerts by priority then date
 */
export function sortAlerts(alerts: CourtAlert[]): CourtAlert[] {
  return [...alerts].sort((a, b) => {
    // First by priority
    const priorityDiff = getPriorityLevel(a.priority) - getPriorityLevel(b.priority);
    if (priorityDiff !== 0) return priorityDiff;

    // Then by date (newest first)
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/**
 * Generate digest summary
 */
export function generateDigestSummary(alerts: CourtAlert[]): string {
  const byCase = groupAlertsByCase(alerts);
  const caseCount = byCase.size;
  const alertCount = alerts.length;

  // Count by type
  const typeCounts: Partial<Record<CourtAlertType, number>> = {};
  for (const alert of alerts) {
    typeCounts[alert.alertType] = (typeCounts[alert.alertType] || 0) + 1;
  }

  // Build summary
  const parts: string[] = [];

  if (typeCounts.new_ruling) {
    parts.push(`${typeCounts.new_ruling} new ruling${typeCounts.new_ruling > 1 ? 's' : ''}`);
  }
  if (typeCounts.hearing_scheduled || typeCounts.hearing_rescheduled || typeCounts.hearing_cancelled) {
    const hearingTotal = (typeCounts.hearing_scheduled || 0) +
      (typeCounts.hearing_rescheduled || 0) +
      (typeCounts.hearing_cancelled || 0);
    parts.push(`${hearingTotal} hearing update${hearingTotal > 1 ? 's' : ''}`);
  }
  if (typeCounts.new_filing) {
    parts.push(`${typeCounts.new_filing} new filing${typeCounts.new_filing > 1 ? 's' : ''}`);
  }

  const otherCount = alertCount - parts.reduce((sum, part) => {
    const match = part.match(/^(\d+)/);
    return sum + (match ? parseInt(match[1], 10) : 0);
  }, 0);

  if (otherCount > 0) {
    parts.push(`${otherCount} other update${otherCount > 1 ? 's' : ''}`);
  }

  return `${alertCount} update${alertCount > 1 ? 's' : ''} across ${caseCount} case${caseCount > 1 ? 's' : ''}: ${parts.join(', ')}`;
}

/**
 * Create alert batcher instance
 */
export function createAlertBatcher(
  kv: KVNamespace,
  config?: Partial<BatchingConfig>
): AlertBatcher {
  return new AlertBatcher(kv, config);
}
