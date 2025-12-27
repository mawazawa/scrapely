/**
 * Breaking News Alert System
 * Real-time alerts for significant news events
 */

import { z } from 'zod';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { logger } from './logger';

/**
 * Alert priority levels
 */
export type AlertPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Alert categories
 */
export type AlertCategory =
  | 'breaking_news'
  | 'market_moving'
  | 'geopolitical'
  | 'disaster'
  | 'technology'
  | 'policy'
  | 'science'
  | 'security';

/**
 * Alert configuration
 */
export interface AlertConfig {
  enabled: boolean;
  categories: AlertCategory[];
  minPriority: AlertPriority;
  channels: AlertChannel[];
  quietHours?: { start: number; end: number };  // 24h format
  rateLimitPerHour: number;
}

/**
 * Alert channel configuration
 */
export interface AlertChannel {
  type: 'email' | 'push' | 'webhook' | 'sms';
  enabled: boolean;
  config: Record<string, unknown>;
}

/**
 * Alert definition
 */
export interface Alert {
  id: string;
  priority: AlertPriority;
  category: AlertCategory;
  title: string;
  summary: string;
  articleIds: number[];
  sourceCount: number;
  createdAt: Date;
  expiresAt: Date;
  metadata: {
    entities: string[];
    regions: string[];
    confidence: number;
    velocity: number;  // Rate of article publication
  };
}

/**
 * Alert detection result from AI
 */
const AlertDetectionSchema = z.object({
  isBreaking: z.boolean().describe('Is this breaking or significant news?'),
  priority: z.enum(['critical', 'high', 'medium', 'low']).describe('Alert priority level'),
  category: z.enum([
    'breaking_news',
    'market_moving',
    'geopolitical',
    'disaster',
    'technology',
    'policy',
    'science',
    'security',
  ]).describe('Alert category'),
  title: z.string().describe('Alert headline (max 100 chars)'),
  summary: z.string().describe('Brief summary (max 280 chars)'),
  entities: z.array(z.string()).describe('Key entities mentioned'),
  regions: z.array(z.string()).describe('Affected regions'),
  confidence: z.number().min(0).max(1).describe('Confidence in breaking classification'),
  reasoning: z.string().describe('Brief explanation'),
});

type AlertDetection = z.infer<typeof AlertDetectionSchema>;

/**
 * Default alert configuration
 */
export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  enabled: true,
  categories: ['breaking_news', 'market_moving', 'geopolitical', 'disaster'],
  minPriority: 'medium',
  channels: [],
  rateLimitPerHour: 10,
};

/**
 * Priority weights for scoring
 */
const PRIORITY_WEIGHTS: Record<AlertPriority, number> = {
  critical: 1.0,
  high: 0.75,
  medium: 0.5,
  low: 0.25,
};

/**
 * Breaking news detection prompt
 */
const ALERT_DETECTION_PROMPT = `You are a news alert system that identifies breaking and significant news.

Determine if the article represents breaking or significant news that warrants an alert.

Priority Guidelines:
- CRITICAL: Major disasters, wars, deaths of world leaders, market crashes
- HIGH: Significant political events, major policy changes, large-scale incidents
- MEDIUM: Notable developments, significant business news, important announcements
- LOW: Interesting but not urgent news, minor developments

Consider:
1. Recency and novelty
2. Impact scope (global, regional, local)
3. Number of people affected
4. Long-term implications
5. Source reliability

Be conservative - only mark as breaking if truly significant.`;

/**
 * Alert manager class
 */
export class AlertManager {
  private kv: KVNamespace | undefined;
  private config: AlertConfig;
  private recentAlerts: Map<string, number> = new Map();  // Deduplication

  constructor(kv?: KVNamespace, config: Partial<AlertConfig> = {}) {
    this.kv = kv;
    this.config = { ...DEFAULT_ALERT_CONFIG, ...config };
  }

  /**
   * Detect if article is breaking news
   */
  async detectBreakingNews(article: {
    id: number;
    title: string;
    content: string;
    source: string;
    publishedAt?: Date;
  }): Promise<Alert | null> {
    if (!this.config.enabled) return null;

    try {
      const { object } = await generateObject({
        model: google('gemini-2.0-flash'),
        schema: AlertDetectionSchema,
        system: ALERT_DETECTION_PROMPT,
        prompt: `Analyze this article for breaking news alert:\n\nTitle: ${article.title}\nSource: ${article.source}\n\nContent:\n${article.content.slice(0, 3000)}`,
      });

      if (!object.isBreaking) {
        return null;
      }

      // Check priority threshold
      if (!this.meetsMinPriority(object.priority)) {
        return null;
      }

      // Check category filter
      if (!this.config.categories.includes(object.category)) {
        return null;
      }

      // Check for duplicates
      const dedupKey = this.createDedupKey(object.title, object.entities);
      if (this.isDuplicate(dedupKey)) {
        logger.debug('Duplicate alert detected', { title: object.title });
        return null;
      }

      // Create alert
      const alert = this.createAlert(object, [article.id]);

      // Mark as seen for deduplication
      this.recentAlerts.set(dedupKey, Date.now());

      logger.info('Breaking news alert detected', {
        title: alert.title,
        priority: alert.priority,
        category: alert.category,
      });

      return alert;
    } catch (error) {
      logger.error('Alert detection failed', { error: String(error) });
      return null;
    }
  }

  /**
   * Detect alerts from multiple related articles
   */
  async detectClusterAlert(articles: Array<{
    id: number;
    title: string;
    content: string;
    source: string;
  }>): Promise<Alert | null> {
    if (articles.length < 3) {
      return null;  // Need multiple sources for cluster alert
    }

    // Combine content from multiple articles
    const combinedContent = articles
      .slice(0, 5)
      .map(a => `[${a.source}] ${a.title}\n${a.content.slice(0, 500)}`)
      .join('\n\n---\n\n');

    try {
      const { object } = await generateObject({
        model: google('gemini-2.0-flash'),
        schema: AlertDetectionSchema,
        system: ALERT_DETECTION_PROMPT,
        prompt: `Multiple sources are reporting on this story. Analyze for breaking news:\n\n${combinedContent}`,
      });

      if (!object.isBreaking) {
        return null;
      }

      if (!this.meetsMinPriority(object.priority)) {
        return null;
      }

      const dedupKey = this.createDedupKey(object.title, object.entities);
      if (this.isDuplicate(dedupKey)) {
        return null;
      }

      // Boost priority for multi-source stories
      const boostedPriority = this.boostPriority(object.priority, articles.length);

      const alert = this.createAlert(
        { ...object, priority: boostedPriority },
        articles.map(a => a.id)
      );

      alert.sourceCount = new Set(articles.map(a => a.source)).size;
      alert.metadata.velocity = articles.length;

      this.recentAlerts.set(dedupKey, Date.now());

      return alert;
    } catch (error) {
      logger.error('Cluster alert detection failed', { error: String(error) });
      return null;
    }
  }

  /**
   * Send alert through configured channels
   */
  async sendAlert(alert: Alert): Promise<{
    success: boolean;
    channels: Array<{ type: string; success: boolean; error?: string }>;
  }> {
    // Check quiet hours
    if (this.isQuietHours()) {
      logger.debug('Skipping alert during quiet hours', { alertId: alert.id });
      return { success: false, channels: [] };
    }

    // Check rate limit
    if (await this.isRateLimited()) {
      logger.warn('Alert rate limit reached', { alertId: alert.id });
      return { success: false, channels: [] };
    }

    const results: Array<{ type: string; success: boolean; error?: string }> = [];

    for (const channel of this.config.channels) {
      if (!channel.enabled) continue;

      try {
        await this.sendToChannel(alert, channel);
        results.push({ type: channel.type, success: true });
      } catch (error) {
        results.push({
          type: channel.type,
          success: false,
          error: String(error),
        });
      }
    }

    // Store alert
    await this.storeAlert(alert);

    // Increment rate limit counter
    await this.incrementRateLimit();

    const success = results.some(r => r.success);

    logger.info('Alert sent', {
      alertId: alert.id,
      success,
      channels: results.map(r => r.type),
    });

    return { success, channels: results };
  }

  /**
   * Get recent alerts
   */
  async getRecentAlerts(limit: number = 20): Promise<Alert[]> {
    if (!this.kv) return [];

    const alerts: Alert[] = [];
    let cursor: string | undefined;

    do {
      const listed = await this.kv.list({
        prefix: 'alert:',
        limit: Math.min(limit - alerts.length, 100),
        cursor,
      });

      for (const key of listed.keys) {
        const alert = await this.kv.get<Alert>(key.name, 'json');
        if (alert) {
          alerts.push(alert);
        }
      }

      cursor = listed.list_complete ? undefined : listed.cursor;
    } while (cursor && alerts.length < limit);

    // Sort by creation date
    alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return alerts.slice(0, limit);
  }

  /**
   * Subscribe user to alerts
   */
  async subscribe(userId: string, config: Partial<AlertConfig>): Promise<void> {
    if (!this.kv) return;

    await this.kv.put(
      `alert_subscription:${userId}`,
      JSON.stringify(config),
      { expirationTtl: 60 * 60 * 24 * 365 }
    );
  }

  /**
   * Unsubscribe user from alerts
   */
  async unsubscribe(userId: string): Promise<void> {
    if (!this.kv) return;
    await this.kv.delete(`alert_subscription:${userId}`);
  }

  /**
   * Create alert object
   */
  private createAlert(detection: AlertDetection, articleIds: number[]): Alert {
    return {
      id: crypto.randomUUID(),
      priority: detection.priority,
      category: detection.category,
      title: detection.title.slice(0, 100),
      summary: detection.summary.slice(0, 280),
      articleIds,
      sourceCount: 1,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),  // 24 hours
      metadata: {
        entities: detection.entities,
        regions: detection.regions,
        confidence: detection.confidence,
        velocity: 1,
      },
    };
  }

  /**
   * Check if priority meets minimum threshold
   */
  private meetsMinPriority(priority: AlertPriority): boolean {
    return PRIORITY_WEIGHTS[priority] >= PRIORITY_WEIGHTS[this.config.minPriority];
  }

  /**
   * Boost priority based on article count
   */
  private boostPriority(priority: AlertPriority, articleCount: number): AlertPriority {
    const priorities: AlertPriority[] = ['low', 'medium', 'high', 'critical'];
    const currentIndex = priorities.indexOf(priority);

    let boost = 0;
    if (articleCount >= 10) boost = 2;
    else if (articleCount >= 5) boost = 1;

    const newIndex = Math.min(currentIndex + boost, priorities.length - 1);
    return priorities[newIndex];
  }

  /**
   * Create deduplication key
   */
  private createDedupKey(title: string, entities: string[]): string {
    const normalized = title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const entityKey = entities.slice(0, 3).sort().join('|');
    return `${normalized.slice(0, 50)}:${entityKey}`;
  }

  /**
   * Check if alert is duplicate
   */
  private isDuplicate(key: string): boolean {
    const lastSeen = this.recentAlerts.get(key);
    if (!lastSeen) return false;

    // Consider duplicate if seen in last 4 hours
    return Date.now() - lastSeen < 4 * 60 * 60 * 1000;
  }

  /**
   * Check if currently in quiet hours
   */
  private isQuietHours(): boolean {
    if (!this.config.quietHours) return false;

    const now = new Date();
    const hour = now.getHours();

    const { start, end } = this.config.quietHours;
    if (start < end) {
      return hour >= start && hour < end;
    } else {
      return hour >= start || hour < end;
    }
  }

  /**
   * Check rate limit
   */
  private async isRateLimited(): Promise<boolean> {
    if (!this.kv) return false;

    const key = `alert_rate:${new Date().toISOString().slice(0, 13)}`;  // Hourly key
    const count = await this.kv.get<number>(key, 'json');

    return (count || 0) >= this.config.rateLimitPerHour;
  }

  /**
   * Increment rate limit counter
   */
  private async incrementRateLimit(): Promise<void> {
    if (!this.kv) return;

    const key = `alert_rate:${new Date().toISOString().slice(0, 13)}`;
    const count = await this.kv.get<number>(key, 'json') || 0;

    await this.kv.put(key, JSON.stringify(count + 1), {
      expirationTtl: 60 * 60,  // 1 hour
    });
  }

  /**
   * Store alert
   */
  private async storeAlert(alert: Alert): Promise<void> {
    if (!this.kv) return;

    await this.kv.put(
      `alert:${alert.id}`,
      JSON.stringify(alert),
      { expirationTtl: 60 * 60 * 24 * 7 }  // 7 days
    );
  }

  /**
   * Send alert to specific channel
   */
  private async sendToChannel(alert: Alert, channel: AlertChannel): Promise<void> {
    switch (channel.type) {
      case 'push':
        // Would integrate with web push
        logger.debug('Sending push notification', { alertId: alert.id });
        break;

      case 'email':
        // Would integrate with email service
        logger.debug('Sending email alert', { alertId: alert.id });
        break;

      case 'webhook':
        const webhookUrl = channel.config.url as string;
        if (webhookUrl) {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(alert),
          });
        }
        break;

      case 'sms':
        // Would integrate with SMS service
        logger.debug('Sending SMS alert', { alertId: alert.id });
        break;
    }
  }
}

/**
 * Create alert manager instance
 */
export function createAlertManager(
  kv?: KVNamespace,
  config?: Partial<AlertConfig>
): AlertManager {
  return new AlertManager(kv, config);
}
