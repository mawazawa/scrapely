/**
 * Court Alert Service
 * Main service for managing and delivering court case alerts
 */

import { logger } from '../../lib/logger';
import type {
  CourtAlert,
  CourtAlertType,
  AlertChannel,
  AlertPriority,
  AlertPreferences,
  AlertDeliveryResult,
  AlertBatch,
  DEFAULT_ALERT_PREFERENCES,
} from './types';
import { changeTypeToAlertType, getAlertTypeDisplayName } from './types';
import { isInQuietHours, getNextDeliveryTime, shouldBypassQuietHours } from './quietHours';
import { AlertBatcher, createAlertBatcher } from './batching';
import { createEmailClient, sendAlertEmail, sendDigestEmail, type EmailConfig } from './email';
import { sendAlertPush, sendBatchPush, getPushSubscription, type PushConfig } from './push';
import { sendAlertWebhook, createWebhookConfig, type WebhookConfig } from './webhook';
import type { DetectedChange } from '../tracking/changeDetector';

/**
 * Alert service configuration
 */
export interface AlertServiceConfig {
  email?: EmailConfig;
  push?: PushConfig;
  kv: KVNamespace;
  db: unknown;  // Database connection
  baseUrl: string;
}

/**
 * Alert creation options
 */
export interface CreateAlertOptions {
  userId: string;
  caseId: number;
  caseNumber: string;
  courtId: string;
  alertType: CourtAlertType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  priority?: AlertPriority;
}

/**
 * Court Alert Service
 */
export class AlertService {
  private config: AlertServiceConfig;
  private batcher: AlertBatcher;

  constructor(config: AlertServiceConfig) {
    this.config = config;
    this.batcher = createAlertBatcher(config.kv);
  }

  /**
   * Create and send an alert
   */
  async sendAlert(options: CreateAlertOptions): Promise<{
    alert: CourtAlert;
    results: AlertDeliveryResult[];
    batched: boolean;
  }> {
    // Create the alert
    const alert: CourtAlert = {
      id: crypto.randomUUID(),
      userId: options.userId,
      caseId: options.caseId,
      caseNumber: options.caseNumber,
      courtId: options.courtId,
      alertType: options.alertType,
      priority: options.priority || this.getPriorityForType(options.alertType),
      title: options.title,
      message: options.message,
      data: options.data,
      channels: [],
      status: 'pending',
      createdAt: new Date(),
    };

    // Get user preferences
    const prefs = await this.getAlertPreferences(options.userId);

    // Check if alerts are enabled
    if (!prefs.enabled) {
      logger.debug('Alerts disabled for user', { userId: options.userId });
      return { alert, results: [], batched: false };
    }

    // Check if this alert type is enabled
    const typeSettings = prefs.alertTypes[options.alertType];
    if (typeSettings && !typeSettings.enabled) {
      logger.debug('Alert type disabled', {
        userId: options.userId,
        alertType: options.alertType,
      });
      return { alert, results: [], batched: false };
    }

    // Determine channels to use
    const channels = this.getChannelsForAlert(alert, prefs);
    alert.channels = channels;

    if (channels.length === 0) {
      logger.debug('No channels configured', { userId: options.userId });
      return { alert, results: [], batched: false };
    }

    // Check quiet hours
    if (isInQuietHours(prefs) && !shouldBypassQuietHours(alert.alertType, prefs)) {
      // Schedule for later
      const deliveryTime = getNextDeliveryTime(prefs);
      logger.info('Alert scheduled for after quiet hours', {
        alertId: alert.id,
        deliveryTime: deliveryTime.toISOString(),
      });

      // Add to batch for later delivery
      const batchResult = await this.batcher.addToBatch(alert, prefs);
      return { alert, results: [], batched: batchResult.batched };
    }

    // Check if should be batched
    const batchResult = await this.batcher.addToBatch(alert, prefs);
    if (batchResult.batched) {
      logger.info('Alert added to batch', {
        alertId: alert.id,
        batchId: batchResult.batchId,
      });
      return { alert, results: [], batched: true };
    }

    // Send immediately
    const results = await this.deliverAlert(alert, prefs);

    // Update alert status
    alert.status = results.every(r => r.success) ? 'sent' : 'failed';
    alert.sentAt = new Date();

    // Store alert history
    await this.storeAlertHistory(alert, results);

    return { alert, results, batched: false };
  }

  /**
   * Send alerts from detected changes
   */
  async sendChangesAlerts(
    userId: string,
    caseId: number,
    caseNumber: string,
    courtId: string,
    changes: DetectedChange[]
  ): Promise<void> {
    for (const change of changes) {
      const alertType = changeTypeToAlertType(change.type);
      if (!alertType) continue;

      await this.sendAlert({
        userId,
        caseId,
        caseNumber,
        courtId,
        alertType,
        title: change.title,
        message: change.description,
        data: {
          before: change.before,
          after: change.after,
          severity: change.severity,
        },
        priority: this.severityToPriority(change.severity),
      });
    }
  }

  /**
   * Process pending batches
   */
  async processPendingBatches(): Promise<{
    batchesProcessed: number;
    alertsSent: number;
    errors: number;
  }> {
    const batches = await this.batcher.getPendingBatches();
    let alertsSent = 0;
    let errors = 0;

    for (const batch of batches) {
      try {
        const prefs = await this.getAlertPreferences(batch.userId);
        const results = await this.deliverBatch(batch, prefs);

        alertsSent += results.filter(r => r.success).length;
        errors += results.filter(r => !r.success).length;

        await this.batcher.markAsSent(batch.id, batch.userId);
      } catch (error) {
        logger.error('Failed to process batch', {
          batchId: batch.id,
          error: String(error),
        });
        errors++;
      }
    }

    logger.info('Batch processing complete', {
      batchesProcessed: batches.length,
      alertsSent,
      errors,
    });

    return {
      batchesProcessed: batches.length,
      alertsSent,
      errors,
    };
  }

  /**
   * Deliver an alert to all configured channels
   */
  private async deliverAlert(
    alert: CourtAlert,
    prefs: AlertPreferences
  ): Promise<AlertDeliveryResult[]> {
    const results: AlertDeliveryResult[] = [];

    for (const channel of alert.channels) {
      const result = await this.deliverToChannel(alert, channel, prefs);
      results.push(result);
    }

    return results;
  }

  /**
   * Deliver a batch of alerts
   */
  private async deliverBatch(
    batch: AlertBatch,
    prefs: AlertPreferences
  ): Promise<AlertDeliveryResult[]> {
    const results: AlertDeliveryResult[] = [];

    // Email digest
    if (prefs.channels.email && prefs.email && this.config.email) {
      const emailClient = createEmailClient(this.config.email);
      const emailResults = await sendDigestEmail(
        emailClient,
        batch,
        { email: prefs.email, name: 'User' },
        {
          actionBaseUrl: this.config.baseUrl,
          unsubscribeUrl: `${this.config.baseUrl}/settings/alerts`,
        }
      );
      results.push(...emailResults);
    }

    // Push notification summary
    if (prefs.channels.push && this.config.push) {
      const subscription = await getPushSubscription(this.config.kv, batch.userId);
      if (subscription) {
        const pushResult = await sendBatchPush(
          subscription,
          batch.alerts,
          this.config.push,
          { actionUrl: `${this.config.baseUrl}/alerts` }
        );
        results.push(pushResult);
      }
    }

    // Webhooks (send individually)
    if (prefs.channels.webhook && prefs.webhookUrl) {
      const webhookConfig = createWebhookConfig(prefs.webhookUrl);
      for (const alert of batch.alerts) {
        const result = await sendAlertWebhook(webhookConfig, alert);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Deliver to a specific channel
   */
  private async deliverToChannel(
    alert: CourtAlert,
    channel: AlertChannel,
    prefs: AlertPreferences
  ): Promise<AlertDeliveryResult> {
    switch (channel) {
      case 'email':
        return this.deliverEmail(alert, prefs);

      case 'push':
        return this.deliverPush(alert, prefs);

      case 'webhook':
        return this.deliverWebhook(alert, prefs);

      case 'in_app':
        return this.storeInAppNotification(alert);

      default:
        return {
          alertId: alert.id,
          channel,
          success: false,
          error: `Unsupported channel: ${channel}`,
        };
    }
  }

  /**
   * Deliver via email
   */
  private async deliverEmail(
    alert: CourtAlert,
    prefs: AlertPreferences
  ): Promise<AlertDeliveryResult> {
    if (!this.config.email || !prefs.email) {
      return {
        alertId: alert.id,
        channel: 'email',
        success: false,
        error: 'Email not configured',
      };
    }

    const client = createEmailClient(this.config.email);
    return sendAlertEmail(client, alert, {
      email: prefs.email,
      name: 'User',
    }, {
      actionUrl: `${this.config.baseUrl}/cases/${alert.caseNumber}`,
      unsubscribeUrl: `${this.config.baseUrl}/settings/alerts`,
    });
  }

  /**
   * Deliver via push notification
   */
  private async deliverPush(
    alert: CourtAlert,
    prefs: AlertPreferences
  ): Promise<AlertDeliveryResult> {
    if (!this.config.push) {
      return {
        alertId: alert.id,
        channel: 'push',
        success: false,
        error: 'Push not configured',
      };
    }

    const subscription = await getPushSubscription(this.config.kv, alert.userId);
    if (!subscription) {
      return {
        alertId: alert.id,
        channel: 'push',
        success: false,
        error: 'No push subscription',
      };
    }

    return sendAlertPush(subscription, alert, this.config.push, {
      actionUrl: `${this.config.baseUrl}/cases/${alert.caseNumber}`,
    });
  }

  /**
   * Deliver via webhook
   */
  private async deliverWebhook(
    alert: CourtAlert,
    prefs: AlertPreferences
  ): Promise<AlertDeliveryResult> {
    if (!prefs.webhookUrl) {
      return {
        alertId: alert.id,
        channel: 'webhook',
        success: false,
        error: 'No webhook URL configured',
      };
    }

    const config = createWebhookConfig(prefs.webhookUrl);
    return sendAlertWebhook(config, alert, { includeFullData: true });
  }

  /**
   * Store in-app notification
   */
  private async storeInAppNotification(
    alert: CourtAlert
  ): Promise<AlertDeliveryResult> {
    try {
      // Store in KV for quick retrieval
      const key = `in_app_notification:${alert.userId}:${alert.id}`;
      await this.config.kv.put(key, JSON.stringify({
        ...alert,
        read: false,
        createdAt: alert.createdAt.toISOString(),
      }), {
        expirationTtl: 30 * 24 * 60 * 60,  // 30 days
      });

      return {
        alertId: alert.id,
        channel: 'in_app',
        success: true,
        deliveredAt: new Date(),
      };
    } catch (error) {
      return {
        alertId: alert.id,
        channel: 'in_app',
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Get alert preferences for a user
   */
  async getAlertPreferences(userId: string): Promise<AlertPreferences> {
    const key = `alert_prefs:${userId}`;
    const data = await this.config.kv.get(key, 'json');

    if (!data) {
      return {
        userId,
        ...DEFAULT_ALERT_PREFERENCES,
      };
    }

    return data as AlertPreferences;
  }

  /**
   * Save alert preferences
   */
  async saveAlertPreferences(prefs: AlertPreferences): Promise<void> {
    const key = `alert_prefs:${prefs.userId}`;
    await this.config.kv.put(key, JSON.stringify(prefs));
  }

  /**
   * Store alert in history
   */
  private async storeAlertHistory(
    alert: CourtAlert,
    results: AlertDeliveryResult[]
  ): Promise<void> {
    // In production, store to database
    // For now, store to KV
    const key = `alert_history:${alert.userId}:${alert.id}`;
    await this.config.kv.put(key, JSON.stringify({
      alert,
      results,
    }), {
      expirationTtl: 90 * 24 * 60 * 60,  // 90 days
    });
  }

  /**
   * Get channels for an alert based on preferences
   */
  private getChannelsForAlert(
    alert: CourtAlert,
    prefs: AlertPreferences
  ): AlertChannel[] {
    const typeSettings = prefs.alertTypes[alert.alertType];

    if (typeSettings?.channels) {
      // Use type-specific channel settings
      return typeSettings.channels.filter(ch =>
        prefs.channels[ch as keyof typeof prefs.channels]
      );
    }

    // Use default enabled channels
    const channels: AlertChannel[] = [];
    if (prefs.channels.email) channels.push('email');
    if (prefs.channels.push) channels.push('push');
    if (prefs.channels.webhook) channels.push('webhook');
    if (prefs.channels.in_app) channels.push('in_app');

    return channels;
  }

  /**
   * Get default priority for an alert type
   */
  private getPriorityForType(type: CourtAlertType): AlertPriority {
    const priorities: Partial<Record<CourtAlertType, AlertPriority>> = {
      new_ruling: 'critical',
      case_disposed: 'critical',
      hearing_cancelled: 'high',
      hearing_scheduled: 'high',
      hearing_rescheduled: 'high',
      status_change: 'high',
      new_filing: 'medium',
      judge_changed: 'medium',
      party_added: 'low',
      party_removed: 'low',
    };

    return priorities[type] || 'medium';
  }

  /**
   * Convert severity to priority
   */
  private severityToPriority(severity: string): AlertPriority {
    switch (severity) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      default:
        return 'low';
    }
  }
}

/**
 * Create alert service instance
 */
export function createAlertService(config: AlertServiceConfig): AlertService {
  return new AlertService(config);
}
