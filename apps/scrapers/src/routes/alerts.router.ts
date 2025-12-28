/**
 * Court Alerts Router
 * REST API for alert preferences and history
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from '../lib/logger';
import {
  createAlertService,
  validateWebhookUrl,
  testWebhook,
  createWebhookConfig,
  validateQuietHours,
  COURT_TIMEZONES,
  QUIET_HOURS_PRESETS,
  type AlertPreferences,
} from '../court/alerts';

/**
 * Environment bindings
 */
interface Env {
  DATABASE_URL: string;
  COURT_SESSIONS: KVNamespace;
  SENDGRID_API_KEY?: string;
  RESEND_API_KEY?: string;
}

/**
 * Create alerts router
 */
export function createAlertsRouter() {
  const router = new Hono<{ Bindings: Env }>();

  /**
   * Get alert preferences
   * GET /alerts/preferences
   */
  router.get('/preferences', async (c) => {
    const userId = c.req.header('X-User-Id');

    if (!userId) {
      throw new HTTPException(401, { message: 'User ID required' });
    }

    try {
      const alertService = createAlertService({
        kv: c.env.COURT_SESSIONS,
        db: null,
        baseUrl: 'https://app.example.com',
      });

      const prefs = await alertService.getAlertPreferences(userId);

      return c.json({
        success: true,
        preferences: prefs,
        timezones: COURT_TIMEZONES,
        quietHoursPresets: QUIET_HOURS_PRESETS,
      });
    } catch (error) {
      logger.error('Failed to get alert preferences', { userId, error: String(error) });
      throw new HTTPException(500, { message: 'Failed to get preferences' });
    }
  });

  /**
   * Update alert preferences
   * PUT /alerts/preferences
   */
  router.put('/preferences', async (c) => {
    const userId = c.req.header('X-User-Id');

    if (!userId) {
      throw new HTTPException(401, { message: 'User ID required' });
    }

    try {
      const body = await c.req.json<Partial<AlertPreferences>>();

      // Validate quiet hours if provided
      if (body.quietHours) {
        const errors = validateQuietHours(body.quietHours);
        if (errors.length > 0) {
          throw new HTTPException(400, { message: errors.join(', ') });
        }
      }

      // Validate webhook URL if provided
      if (body.webhookUrl) {
        const validation = validateWebhookUrl(body.webhookUrl);
        if (!validation.valid) {
          throw new HTTPException(400, { message: validation.error });
        }
      }

      const alertService = createAlertService({
        kv: c.env.COURT_SESSIONS,
        db: null,
        baseUrl: 'https://app.example.com',
      });

      // Get existing preferences and merge
      const existing = await alertService.getAlertPreferences(userId);
      const updated: AlertPreferences = {
        ...existing,
        ...body,
        userId,  // Ensure userId is set
      };

      await alertService.saveAlertPreferences(updated);

      return c.json({
        success: true,
        preferences: updated,
      });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      logger.error('Failed to update preferences', { userId, error: String(error) });
      throw new HTTPException(500, { message: 'Failed to update preferences' });
    }
  });

  /**
   * Test webhook connectivity
   * POST /alerts/test-webhook
   */
  router.post('/test-webhook', async (c) => {
    const userId = c.req.header('X-User-Id');

    if (!userId) {
      throw new HTTPException(401, { message: 'User ID required' });
    }

    try {
      const { url, secret } = await c.req.json<{ url: string; secret?: string }>();

      // Validate URL
      const validation = validateWebhookUrl(url);
      if (!validation.valid) {
        throw new HTTPException(400, { message: validation.error });
      }

      const config = createWebhookConfig(url, secret);
      const result = await testWebhook(config);

      return c.json({
        success: result.success,
        latencyMs: result.latencyMs,
        error: result.error,
      });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      logger.error('Webhook test failed', { userId, error: String(error) });
      throw new HTTPException(500, { message: 'Webhook test failed' });
    }
  });

  /**
   * Get alert history
   * GET /alerts/history
   */
  router.get('/history', async (c) => {
    const userId = c.req.header('X-User-Id');

    if (!userId) {
      throw new HTTPException(401, { message: 'User ID required' });
    }

    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    try {
      // Get alert history from KV
      const alerts: unknown[] = [];
      let cursor: string | undefined;
      const prefix = `alert_history:${userId}:`;

      do {
        const list = await c.env.COURT_SESSIONS.list({ prefix, cursor, limit: 100 });

        for (const key of list.keys) {
          if (alerts.length >= offset + limit) break;

          if (alerts.length >= offset) {
            const data = await c.env.COURT_SESSIONS.get(key.name, 'json');
            if (data) {
              alerts.push(data);
            }
          }
        }

        cursor = list.list_complete ? undefined : list.cursor;
      } while (cursor && alerts.length < offset + limit);

      return c.json({
        success: true,
        alerts: alerts.slice(0, limit),
        hasMore: alerts.length > limit,
      });
    } catch (error) {
      logger.error('Failed to get alert history', { userId, error: String(error) });
      throw new HTTPException(500, { message: 'Failed to get alert history' });
    }
  });

  /**
   * Get in-app notifications
   * GET /alerts/notifications
   */
  router.get('/notifications', async (c) => {
    const userId = c.req.header('X-User-Id');

    if (!userId) {
      throw new HTTPException(401, { message: 'User ID required' });
    }

    const unreadOnly = c.req.query('unreadOnly') === 'true';
    const limit = parseInt(c.req.query('limit') || '20', 10);

    try {
      const notifications: unknown[] = [];
      let cursor: string | undefined;
      const prefix = `in_app_notification:${userId}:`;

      do {
        const list = await c.env.COURT_SESSIONS.list({ prefix, cursor, limit: 50 });

        for (const key of list.keys) {
          if (notifications.length >= limit) break;

          const data = await c.env.COURT_SESSIONS.get(key.name, 'json');
          if (data) {
            const notification = data as { read: boolean };
            if (!unreadOnly || !notification.read) {
              notifications.push(data);
            }
          }
        }

        cursor = list.list_complete ? undefined : list.cursor;
      } while (cursor && notifications.length < limit);

      return c.json({
        success: true,
        notifications,
        unreadCount: notifications.filter((n: { read?: boolean }) => !n.read).length,
      });
    } catch (error) {
      logger.error('Failed to get notifications', { userId, error: String(error) });
      throw new HTTPException(500, { message: 'Failed to get notifications' });
    }
  });

  /**
   * Mark notification as read
   * POST /alerts/notifications/:id/read
   */
  router.post('/notifications/:id/read', async (c) => {
    const userId = c.req.header('X-User-Id');
    const { id } = c.req.param();

    if (!userId) {
      throw new HTTPException(401, { message: 'User ID required' });
    }

    try {
      const key = `in_app_notification:${userId}:${id}`;
      const data = await c.env.COURT_SESSIONS.get(key, 'json');

      if (!data) {
        throw new HTTPException(404, { message: 'Notification not found' });
      }

      const notification = data as Record<string, unknown>;
      notification.read = true;
      notification.readAt = new Date().toISOString();

      await c.env.COURT_SESSIONS.put(key, JSON.stringify(notification));

      return c.json({ success: true });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      logger.error('Failed to mark notification read', { userId, id, error: String(error) });
      throw new HTTPException(500, { message: 'Failed to update notification' });
    }
  });

  /**
   * Mark all notifications as read
   * POST /alerts/notifications/read-all
   */
  router.post('/notifications/read-all', async (c) => {
    const userId = c.req.header('X-User-Id');

    if (!userId) {
      throw new HTTPException(401, { message: 'User ID required' });
    }

    try {
      const prefix = `in_app_notification:${userId}:`;
      let cursor: string | undefined;
      let updated = 0;

      do {
        const list = await c.env.COURT_SESSIONS.list({ prefix, cursor, limit: 100 });

        for (const key of list.keys) {
          const data = await c.env.COURT_SESSIONS.get(key.name, 'json');
          if (data) {
            const notification = data as Record<string, unknown>;
            if (!notification.read) {
              notification.read = true;
              notification.readAt = new Date().toISOString();
              await c.env.COURT_SESSIONS.put(key.name, JSON.stringify(notification));
              updated++;
            }
          }
        }

        cursor = list.list_complete ? undefined : list.cursor;
      } while (cursor);

      return c.json({
        success: true,
        updated,
      });
    } catch (error) {
      logger.error('Failed to mark all read', { userId, error: String(error) });
      throw new HTTPException(500, { message: 'Failed to update notifications' });
    }
  });

  /**
   * Delete notification
   * DELETE /alerts/notifications/:id
   */
  router.delete('/notifications/:id', async (c) => {
    const userId = c.req.header('X-User-Id');
    const { id } = c.req.param();

    if (!userId) {
      throw new HTTPException(401, { message: 'User ID required' });
    }

    try {
      const key = `in_app_notification:${userId}:${id}`;
      await c.env.COURT_SESSIONS.delete(key);

      return c.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete notification', { userId, id, error: String(error) });
      throw new HTTPException(500, { message: 'Failed to delete notification' });
    }
  });

  /**
   * Process pending alert batches (for cron job)
   * POST /alerts/process-batches
   */
  router.post('/process-batches', async (c) => {
    // This should be protected by an internal auth mechanism
    const authHeader = c.req.header('Authorization');
    if (authHeader !== `Bearer ${c.env.MERIDIAN_SECRET_KEY}`) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    try {
      const alertService = createAlertService({
        kv: c.env.COURT_SESSIONS,
        db: null,
        baseUrl: 'https://app.example.com',
        email: c.env.SENDGRID_API_KEY ? {
          apiKey: c.env.SENDGRID_API_KEY,
          fromAddress: 'alerts@example.com',
          fromName: 'Court Alerts',
          provider: 'sendgrid',
        } : undefined,
      });

      const result = await alertService.processPendingBatches();

      return c.json({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error('Failed to process batches', { error: String(error) });
      throw new HTTPException(500, { message: 'Failed to process batches' });
    }
  });

  return router;
}
