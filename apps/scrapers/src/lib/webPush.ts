/**
 * Web Push Notifications
 * Implements Web Push API for browser notifications
 */

import { z } from 'zod';
import { logger } from './logger';

/**
 * Push subscription schema
 */
export const PushSubscriptionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  userAgent: z.string().optional(),
  createdAt: z.number(),
  lastUsed: z.number().optional(),
});

export type PushSubscription = z.infer<typeof PushSubscriptionSchema>;

/**
 * Push notification payload
 */
export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

/**
 * VAPID keys for Web Push
 * In production, generate and store these securely
 */
export interface VAPIDKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/**
 * Store push subscription
 */
export async function storeSubscription(
  kv: KVNamespace | undefined,
  subscription: PushSubscription
): Promise<boolean> {
  if (!kv) {
    logger.warn('No KV namespace for push subscriptions');
    return false;
  }

  try {
    // Store by subscription ID
    await kv.put(`push:sub:${subscription.id}`, JSON.stringify(subscription), {
      expirationTtl: 365 * 24 * 60 * 60, // 1 year
    });

    // Add to user's subscription list
    const userKey = `push:user:${subscription.userId}`;
    const userSubs = await kv.get<string[]>(userKey, 'json') || [];
    if (!userSubs.includes(subscription.id)) {
      userSubs.push(subscription.id);
      await kv.put(userKey, JSON.stringify(userSubs));
    }

    logger.info('Push subscription stored', {
      id: subscription.id,
      userId: subscription.userId,
    });

    return true;
  } catch (error) {
    logger.error('Failed to store push subscription', { error: String(error) });
    return false;
  }
}

/**
 * Get subscription by ID
 */
export async function getSubscription(
  kv: KVNamespace | undefined,
  subscriptionId: string
): Promise<PushSubscription | null> {
  if (!kv) return null;

  try {
    return await kv.get<PushSubscription>(`push:sub:${subscriptionId}`, 'json');
  } catch {
    return null;
  }
}

/**
 * Get all subscriptions for a user
 */
export async function getUserSubscriptions(
  kv: KVNamespace | undefined,
  userId: string
): Promise<PushSubscription[]> {
  if (!kv) return [];

  try {
    const subIds = await kv.get<string[]>(`push:user:${userId}`, 'json') || [];
    const subscriptions: PushSubscription[] = [];

    for (const id of subIds) {
      const sub = await getSubscription(kv, id);
      if (sub) subscriptions.push(sub);
    }

    return subscriptions;
  } catch {
    return [];
  }
}

/**
 * Delete subscription
 */
export async function deleteSubscription(
  kv: KVNamespace | undefined,
  subscriptionId: string
): Promise<boolean> {
  if (!kv) return false;

  try {
    const sub = await getSubscription(kv, subscriptionId);
    if (!sub) return false;

    // Delete subscription
    await kv.delete(`push:sub:${subscriptionId}`);

    // Remove from user's list
    const userKey = `push:user:${sub.userId}`;
    const userSubs = await kv.get<string[]>(userKey, 'json') || [];
    const filtered = userSubs.filter(id => id !== subscriptionId);
    await kv.put(userKey, JSON.stringify(filtered));

    logger.info('Push subscription deleted', { id: subscriptionId });
    return true;
  } catch {
    return false;
  }
}

/**
 * Send push notification
 * Uses Web Push protocol
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushPayload,
  vapidKeys: VAPIDKeys
): Promise<{ success: boolean; error?: string }> {
  try {
    // Create JWT for VAPID
    const jwt = await createVapidJwt(subscription.endpoint, vapidKeys);

    // Encrypt payload
    const encryptedPayload = await encryptPayload(
      JSON.stringify(payload),
      subscription.keys.p256dh,
      subscription.keys.auth
    );

    // Send to push service
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${jwt}, k=${vapidKeys.publicKey}`,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400', // 24 hours
      },
      body: encryptedPayload,
    });

    if (response.status === 201) {
      return { success: true };
    }

    if (response.status === 410) {
      // Subscription expired
      return { success: false, error: 'Subscription expired' };
    }

    return { success: false, error: `HTTP ${response.status}` };
  } catch (error) {
    logger.error('Push notification failed', { error: String(error) });
    return { success: false, error: String(error) };
  }
}

/**
 * Send push to all user subscriptions
 */
export async function sendPushToUser(
  kv: KVNamespace | undefined,
  userId: string,
  payload: PushPayload,
  vapidKeys: VAPIDKeys
): Promise<{ sent: number; failed: number }> {
  const subscriptions = await getUserSubscriptions(kv, userId);
  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    const result = await sendPushNotification(sub, payload, vapidKeys);

    if (result.success) {
      sent++;
      // Update last used
      sub.lastUsed = Date.now();
      await storeSubscription(kv, sub);
    } else {
      failed++;
      // Delete expired subscriptions
      if (result.error === 'Subscription expired') {
        await deleteSubscription(kv, sub.id);
      }
    }
  }

  return { sent, failed };
}

/**
 * Broadcast push to all subscriptions
 */
export async function broadcastPush(
  kv: KVNamespace | undefined,
  payload: PushPayload,
  vapidKeys: VAPIDKeys
): Promise<{ sent: number; failed: number }> {
  if (!kv) return { sent: 0, failed: 0 };

  // Get all subscriptions from KV list
  const list = await kv.list({ prefix: 'push:sub:' });
  let sent = 0;
  let failed = 0;

  for (const key of list.keys) {
    const sub = await kv.get<PushSubscription>(key.name, 'json');
    if (!sub) continue;

    const result = await sendPushNotification(sub, payload, vapidKeys);
    if (result.success) sent++;
    else failed++;
  }

  logger.info('Push broadcast complete', { sent, failed });
  return { sent, failed };
}

/**
 * Create VAPID JWT
 * Simplified version - in production use proper crypto
 */
async function createVapidJwt(endpoint: string, vapidKeys: VAPIDKeys): Promise<string> {
  const audience = new URL(endpoint).origin;
  const expiry = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12 hours

  const header = { alg: 'ES256', typ: 'JWT' };
  const payload = {
    aud: audience,
    exp: expiry,
    sub: vapidKeys.subject,
  };

  // In production, properly sign with ECDSA
  const headerB64 = btoa(JSON.stringify(header));
  const payloadB64 = btoa(JSON.stringify(payload));

  // Placeholder - needs proper signing in production
  return `${headerB64}.${payloadB64}.signature`;
}

/**
 * Encrypt payload for Web Push
 * Simplified version - in production use proper ECDH + AES-GCM
 */
async function encryptPayload(
  payload: string,
  p256dh: string,
  auth: string
): Promise<ArrayBuffer> {
  // In production, implement proper Web Push encryption:
  // 1. Generate ephemeral ECDH key pair
  // 2. Derive shared secret using subscriber's p256dh
  // 3. Derive content encryption key using HKDF
  // 4. Encrypt with AES-128-GCM

  // For now, return placeholder
  const encoder = new TextEncoder();
  return encoder.encode(payload).buffer;
}

/**
 * Create notification for new brief
 */
export function createBriefNotification(brief: {
  title: string;
  slug: string;
}): PushPayload {
  return {
    title: 'New Intelligence Brief',
    body: brief.title,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    url: `/briefs/${brief.slug}`,
    tag: 'new-brief',
    requireInteraction: false,
    actions: [
      { action: 'read', title: 'Read Now' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };
}
