/**
 * Push Notification Delivery
 * Send court alerts via web push notifications
 */

import { logger } from '../../lib/logger';
import type { CourtAlert, AlertDeliveryResult } from './types';
import { getAlertTypeDisplayName } from './types';

/**
 * Push subscription
 */
export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Push notification config
 */
export interface PushConfig {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;  // Usually mailto: or https: URL
}

/**
 * Push notification payload
 */
export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
}

/**
 * Send a push notification using Web Push protocol
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushPayload,
  config: PushConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    // In a real implementation, this would use the web-push library
    // or implement the Web Push protocol directly
    // For now, we'll use a simplified approach

    const payloadString = JSON.stringify(payload);

    // This is a simplified version - in production, use proper VAPID signing
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TTL': '86400',  // 24 hours
        'Urgency': payload.requireInteraction ? 'high' : 'normal',
        // In production: Add proper VAPID authorization header
      },
      body: payloadString,
    });

    if (response.ok) {
      return { success: true };
    }

    if (response.status === 410) {
      // Subscription expired or invalid
      return { success: false, error: 'Subscription expired' };
    }

    return { success: false, error: `HTTP ${response.status}` };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Send a court alert as a push notification
 */
export async function sendAlertPush(
  subscription: PushSubscription,
  alert: CourtAlert,
  config: PushConfig,
  options: {
    actionUrl?: string;
    icon?: string;
    badge?: string;
  } = {}
): Promise<AlertDeliveryResult> {
  const payload: PushPayload = {
    title: `${getAlertTypeDisplayName(alert.alertType)}: ${alert.caseNumber}`,
    body: alert.message,
    icon: options.icon || '/icons/court-alert.png',
    badge: options.badge || '/icons/badge.png',
    tag: `court-alert-${alert.id}`,
    data: {
      alertId: alert.id,
      caseNumber: alert.caseNumber,
      alertType: alert.alertType,
      url: options.actionUrl || `/cases/${alert.caseNumber}`,
    },
    actions: [
      { action: 'view', title: 'View Case' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    requireInteraction: alert.priority === 'critical' || alert.priority === 'high',
  };

  const result = await sendPushNotification(subscription, payload, config);

  if (result.success) {
    logger.info('Push notification sent', {
      alertId: alert.id,
      endpoint: subscription.endpoint.substring(0, 50),
    });

    return {
      alertId: alert.id,
      channel: 'push',
      success: true,
      deliveredAt: new Date(),
    };
  }

  logger.error('Push notification failed', {
    alertId: alert.id,
    error: result.error,
  });

  return {
    alertId: alert.id,
    channel: 'push',
    success: false,
    error: result.error,
  };
}

/**
 * Send a batch summary as a push notification
 */
export async function sendBatchPush(
  subscription: PushSubscription,
  alerts: CourtAlert[],
  config: PushConfig,
  options: {
    actionUrl?: string;
    icon?: string;
    badge?: string;
  } = {}
): Promise<AlertDeliveryResult> {
  const caseCount = new Set(alerts.map(a => a.caseNumber)).size;

  const payload: PushPayload = {
    title: `${alerts.length} Court Updates`,
    body: caseCount === 1
      ? `${alerts.length} updates for case ${alerts[0].caseNumber}`
      : `Updates across ${caseCount} cases`,
    icon: options.icon || '/icons/court-alert.png',
    badge: options.badge || '/icons/badge.png',
    tag: 'court-alert-batch',
    data: {
      alertIds: alerts.map(a => a.id),
      caseNumbers: [...new Set(alerts.map(a => a.caseNumber))],
      url: options.actionUrl || '/alerts',
    },
    actions: [
      { action: 'view', title: 'View All' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    requireInteraction: alerts.some(a => a.priority === 'critical'),
  };

  const result = await sendPushNotification(subscription, payload, config);

  // Return a single result for the batch
  const batchId = `batch-${Date.now()}`;

  if (result.success) {
    logger.info('Batch push notification sent', {
      alertCount: alerts.length,
    });

    return {
      alertId: batchId,
      channel: 'push',
      success: true,
      deliveredAt: new Date(),
    };
  }

  logger.error('Batch push notification failed', {
    error: result.error,
  });

  return {
    alertId: batchId,
    channel: 'push',
    success: false,
    error: result.error,
  };
}

/**
 * Store push subscription in KV
 */
export async function storePushSubscription(
  kv: KVNamespace,
  userId: string,
  subscription: PushSubscription
): Promise<void> {
  const key = `push_subscription:${userId}`;
  await kv.put(key, JSON.stringify(subscription));

  logger.debug('Push subscription stored', { userId });
}

/**
 * Get push subscription from KV
 */
export async function getPushSubscription(
  kv: KVNamespace,
  userId: string
): Promise<PushSubscription | null> {
  const key = `push_subscription:${userId}`;
  const data = await kv.get(key, 'json');
  return data as PushSubscription | null;
}

/**
 * Delete push subscription
 */
export async function deletePushSubscription(
  kv: KVNamespace,
  userId: string
): Promise<void> {
  const key = `push_subscription:${userId}`;
  await kv.delete(key);

  logger.debug('Push subscription deleted', { userId });
}

/**
 * Check if push is supported (client-side helper)
 */
export function isPushSupported(): boolean {
  return typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window;
}
