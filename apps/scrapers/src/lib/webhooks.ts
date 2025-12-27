/**
 * Webhook Integrations
 * Outgoing webhooks for event notifications
 */

import { logger } from './logger';

/**
 * Webhook event types
 */
export type WebhookEventType =
  | 'article.created'
  | 'article.analyzed'
  | 'article.flagged'
  | 'report.published'
  | 'report.scheduled'
  | 'alert.triggered'
  | 'source.created'
  | 'source.health_changed'
  | 'source.disabled'
  | 'scrape.completed'
  | 'scrape.failed';

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Delivery settings
  retryCount: number;
  retryDelayMs: number;
  timeoutMs: number;

  // Filters
  filters?: {
    sourceIds?: number[];
    topics?: string[];
    minSignificance?: string;
  };

  // Stats
  stats: {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    lastDeliveryAt?: Date;
    lastStatus?: number;
  };
}

/**
 * Webhook payload
 */
export interface WebhookPayload<T = unknown> {
  id: string;
  event: WebhookEventType;
  timestamp: string;
  data: T;
  metadata: {
    webhookId: string;
    attemptNumber: number;
    version: string;
  };
}

/**
 * Webhook delivery result
 */
export interface WebhookDeliveryResult {
  webhookId: string;
  eventId: string;
  success: boolean;
  statusCode?: number;
  duration: number;
  error?: string;
  retryScheduled: boolean;
}

/**
 * Webhook delivery log
 */
export interface WebhookDeliveryLog {
  id: string;
  webhookId: string;
  eventType: WebhookEventType;
  payload: WebhookPayload;
  result: WebhookDeliveryResult;
  timestamp: Date;
}

/**
 * Default webhook configuration
 */
export const DEFAULT_WEBHOOK_CONFIG: Partial<WebhookConfig> = {
  retryCount: 3,
  retryDelayMs: 5000,
  timeoutMs: 30000,
  enabled: true,
  stats: {
    totalDeliveries: 0,
    successfulDeliveries: 0,
    failedDeliveries: 0,
  },
};

/**
 * Webhook manager
 */
export class WebhookManager {
  private kv: KVNamespace | undefined;
  private queue: Queue<{ webhookId: string; payload: WebhookPayload }> | undefined;
  private webhooks: Map<string, WebhookConfig> = new Map();

  constructor(kv?: KVNamespace, queue?: Queue<{ webhookId: string; payload: WebhookPayload }>) {
    this.kv = kv;
    this.queue = queue;
  }

  /**
   * Register a new webhook
   */
  async register(config: Omit<WebhookConfig, 'id' | 'createdAt' | 'updatedAt' | 'stats'>): Promise<WebhookConfig> {
    const now = new Date();
    const webhook: WebhookConfig = {
      ...DEFAULT_WEBHOOK_CONFIG,
      ...config,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      stats: {
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
      },
    } as WebhookConfig;

    this.webhooks.set(webhook.id, webhook);

    if (this.kv) {
      await this.kv.put(`webhook:${webhook.id}`, JSON.stringify(webhook));
    }

    logger.info('Webhook registered', {
      webhookId: webhook.id,
      name: webhook.name,
      events: webhook.events,
    });

    return webhook;
  }

  /**
   * Update webhook configuration
   */
  async update(webhookId: string, updates: Partial<WebhookConfig>): Promise<WebhookConfig | null> {
    const webhook = await this.get(webhookId);
    if (!webhook) return null;

    const updated: WebhookConfig = {
      ...webhook,
      ...updates,
      id: webhook.id,
      createdAt: webhook.createdAt,
      updatedAt: new Date(),
    };

    this.webhooks.set(webhookId, updated);

    if (this.kv) {
      await this.kv.put(`webhook:${webhookId}`, JSON.stringify(updated));
    }

    return updated;
  }

  /**
   * Delete webhook
   */
  async delete(webhookId: string): Promise<boolean> {
    this.webhooks.delete(webhookId);

    if (this.kv) {
      await this.kv.delete(`webhook:${webhookId}`);
    }

    logger.info('Webhook deleted', { webhookId });
    return true;
  }

  /**
   * Get webhook by ID
   */
  async get(webhookId: string): Promise<WebhookConfig | null> {
    const cached = this.webhooks.get(webhookId);
    if (cached) return cached;

    if (this.kv) {
      const stored = await this.kv.get<WebhookConfig>(`webhook:${webhookId}`, 'json');
      if (stored) {
        this.webhooks.set(webhookId, stored);
        return stored;
      }
    }

    return null;
  }

  /**
   * List all webhooks
   */
  async list(): Promise<WebhookConfig[]> {
    if (!this.kv) return Array.from(this.webhooks.values());

    const webhooks: WebhookConfig[] = [];
    const listed = await this.kv.list({ prefix: 'webhook:' });

    for (const key of listed.keys) {
      const webhook = await this.kv.get<WebhookConfig>(key.name, 'json');
      if (webhook) {
        webhooks.push(webhook);
      }
    }

    return webhooks;
  }

  /**
   * Get webhooks subscribed to an event type
   */
  async getSubscribers(eventType: WebhookEventType): Promise<WebhookConfig[]> {
    const all = await this.list();
    return all.filter(w => w.enabled && w.events.includes(eventType));
  }

  /**
   * Emit event to all subscribed webhooks
   */
  async emit<T>(eventType: WebhookEventType, data: T): Promise<WebhookDeliveryResult[]> {
    const subscribers = await this.getSubscribers(eventType);

    if (subscribers.length === 0) {
      logger.debug('No subscribers for event', { eventType });
      return [];
    }

    const eventId = crypto.randomUUID();
    const results: WebhookDeliveryResult[] = [];

    for (const webhook of subscribers) {
      // Apply filters
      if (!this.passesFilters(webhook, data)) {
        continue;
      }

      const payload: WebhookPayload<T> = {
        id: eventId,
        event: eventType,
        timestamp: new Date().toISOString(),
        data,
        metadata: {
          webhookId: webhook.id,
          attemptNumber: 1,
          version: '1.0',
        },
      };

      // Use queue for async delivery if available
      if (this.queue) {
        await this.queue.send({
          body: { webhookId: webhook.id, payload },
        });
        results.push({
          webhookId: webhook.id,
          eventId,
          success: true,
          duration: 0,
          retryScheduled: false,
        });
      } else {
        // Synchronous delivery
        const result = await this.deliver(webhook, payload);
        results.push(result);
      }
    }

    logger.info('Event emitted', {
      eventType,
      eventId,
      subscribers: subscribers.length,
      delivered: results.filter(r => r.success).length,
    });

    return results;
  }

  /**
   * Deliver webhook payload
   */
  async deliver(
    webhook: WebhookConfig,
    payload: WebhookPayload,
    attemptNumber: number = 1
  ): Promise<WebhookDeliveryResult> {
    const startTime = Date.now();

    try {
      // Generate signature
      const signature = await this.generateSignature(webhook.secret, JSON.stringify(payload));

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': payload.event,
          'X-Webhook-Id': payload.id,
          'X-Webhook-Attempt': String(attemptNumber),
          'User-Agent': 'Meridian-Webhooks/1.0',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(webhook.timeoutMs),
      });

      const duration = Date.now() - startTime;
      const success = response.ok;

      // Update stats
      await this.updateStats(webhook.id, success, response.status);

      // Log delivery
      await this.logDelivery({
        id: crypto.randomUUID(),
        webhookId: webhook.id,
        eventType: payload.event,
        payload,
        result: {
          webhookId: webhook.id,
          eventId: payload.id,
          success,
          statusCode: response.status,
          duration,
          retryScheduled: !success && attemptNumber < webhook.retryCount,
        },
        timestamp: new Date(),
      });

      if (!success && attemptNumber < webhook.retryCount) {
        // Schedule retry
        await this.scheduleRetry(webhook, payload, attemptNumber + 1);
      }

      return {
        webhookId: webhook.id,
        eventId: payload.id,
        success,
        statusCode: response.status,
        duration,
        retryScheduled: !success && attemptNumber < webhook.retryCount,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.updateStats(webhook.id, false);

      if (attemptNumber < webhook.retryCount) {
        await this.scheduleRetry(webhook, payload, attemptNumber + 1);
      }

      logger.error('Webhook delivery failed', {
        webhookId: webhook.id,
        eventId: payload.id,
        attempt: attemptNumber,
        error: errorMessage,
      });

      return {
        webhookId: webhook.id,
        eventId: payload.id,
        success: false,
        duration,
        error: errorMessage,
        retryScheduled: attemptNumber < webhook.retryCount,
      };
    }
  }

  /**
   * Handle queue message for async delivery
   */
  async handleQueueMessage(message: { webhookId: string; payload: WebhookPayload }): Promise<void> {
    const webhook = await this.get(message.webhookId);
    if (!webhook) {
      logger.warn('Webhook not found for queued delivery', { webhookId: message.webhookId });
      return;
    }

    await this.deliver(webhook, message.payload, message.payload.metadata.attemptNumber);
  }

  /**
   * Test webhook delivery
   */
  async test(webhookId: string): Promise<WebhookDeliveryResult> {
    const webhook = await this.get(webhookId);
    if (!webhook) {
      return {
        webhookId,
        eventId: 'test',
        success: false,
        duration: 0,
        error: 'Webhook not found',
        retryScheduled: false,
      };
    }

    const testPayload: WebhookPayload = {
      id: `test-${Date.now()}`,
      event: 'article.created',
      timestamp: new Date().toISOString(),
      data: {
        test: true,
        message: 'This is a test webhook delivery',
      },
      metadata: {
        webhookId,
        attemptNumber: 1,
        version: '1.0',
      },
    };

    return this.deliver(webhook, testPayload);
  }

  /**
   * Get delivery logs for a webhook
   */
  async getDeliveryLogs(webhookId: string, limit: number = 50): Promise<WebhookDeliveryLog[]> {
    if (!this.kv) return [];

    const logs: WebhookDeliveryLog[] = [];
    const listed = await this.kv.list({
      prefix: `webhook_log:${webhookId}:`,
      limit,
    });

    for (const key of listed.keys) {
      const log = await this.kv.get<WebhookDeliveryLog>(key.name, 'json');
      if (log) logs.push(log);
    }

    return logs.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Generate HMAC signature
   */
  private async generateSignature(secret: string, payload: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const hashArray = Array.from(new Uint8Array(signature));
    return 'sha256=' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Check if event data passes webhook filters
   */
  private passesFilters<T>(webhook: WebhookConfig, data: T): boolean {
    if (!webhook.filters) return true;

    const dataObj = data as Record<string, unknown>;

    if (webhook.filters.sourceIds?.length) {
      const sourceId = dataObj.sourceId as number | undefined;
      if (sourceId && !webhook.filters.sourceIds.includes(sourceId)) {
        return false;
      }
    }

    if (webhook.filters.topics?.length) {
      const topics = dataObj.topics as string[] | undefined;
      if (topics && !topics.some(t => webhook.filters!.topics!.includes(t))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Update webhook delivery stats
   */
  private async updateStats(webhookId: string, success: boolean, statusCode?: number): Promise<void> {
    const webhook = await this.get(webhookId);
    if (!webhook) return;

    webhook.stats.totalDeliveries++;
    if (success) {
      webhook.stats.successfulDeliveries++;
    } else {
      webhook.stats.failedDeliveries++;
    }
    webhook.stats.lastDeliveryAt = new Date();
    webhook.stats.lastStatus = statusCode;

    this.webhooks.set(webhookId, webhook);

    if (this.kv) {
      await this.kv.put(`webhook:${webhookId}`, JSON.stringify(webhook));
    }
  }

  /**
   * Schedule retry delivery
   */
  private async scheduleRetry(
    webhook: WebhookConfig,
    payload: WebhookPayload,
    attemptNumber: number
  ): Promise<void> {
    const delay = webhook.retryDelayMs * Math.pow(2, attemptNumber - 1);

    if (this.queue) {
      await this.queue.send({
        body: {
          webhookId: webhook.id,
          payload: {
            ...payload,
            metadata: {
              ...payload.metadata,
              attemptNumber,
            },
          },
        },
        delaySeconds: Math.ceil(delay / 1000),
      });
    } else {
      // Fallback: schedule via timeout
      setTimeout(
        () => this.deliver(webhook, payload, attemptNumber),
        delay
      );
    }
  }

  /**
   * Log delivery for debugging
   */
  private async logDelivery(log: WebhookDeliveryLog): Promise<void> {
    if (!this.kv) return;

    await this.kv.put(
      `webhook_log:${log.webhookId}:${log.id}`,
      JSON.stringify(log),
      { expirationTtl: 60 * 60 * 24 * 7 }  // 7 days
    );
  }
}

/**
 * Create webhook manager instance
 */
export function createWebhookManager(
  kv?: KVNamespace,
  queue?: Queue<{ webhookId: string; payload: WebhookPayload }>
): WebhookManager {
  return new WebhookManager(kv, queue);
}

/**
 * Convenience function to emit common events
 */
export const webhookEvents = {
  articleCreated: (manager: WebhookManager, article: { id: number; title: string; sourceId: number; url: string }) =>
    manager.emit('article.created', article),

  articleAnalyzed: (manager: WebhookManager, article: { id: number; analysis: unknown }) =>
    manager.emit('article.analyzed', article),

  reportPublished: (manager: WebhookManager, report: { id: string; slug: string; title: string }) =>
    manager.emit('report.published', report),

  alertTriggered: (manager: WebhookManager, alert: { id: string; title: string; priority: string }) =>
    manager.emit('alert.triggered', alert),

  scrapeCompleted: (manager: WebhookManager, result: { sourceId: number; articlesFound: number }) =>
    manager.emit('scrape.completed', result),

  scrapeFailed: (manager: WebhookManager, error: { sourceId: number; error: string }) =>
    manager.emit('scrape.failed', error),
};
