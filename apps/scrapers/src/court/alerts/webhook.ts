/**
 * Webhook Delivery
 * Send court alerts to external webhooks
 */

import { logger } from '../../lib/logger';
import type {
  CourtAlert,
  AlertDeliveryResult,
  WebhookPayload,
  AlertBatch,
} from './types';

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  url: string;
  secret?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

/**
 * Webhook delivery options
 */
export interface WebhookDeliveryOptions {
  includeFullData?: boolean;
  signPayload?: boolean;
}

/**
 * Generate webhook signature
 */
async function generateSignature(
  payload: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );

  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Send a webhook
 */
async function sendWebhook(
  config: WebhookConfig,
  payload: WebhookPayload,
  options: WebhookDeliveryOptions = {}
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const payloadString = JSON.stringify(payload);
  const timeout = config.timeout || 30000;
  const retries = config.retries || 3;

  let lastError: string | undefined;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'CourtAlerts/1.0',
        'X-Webhook-Event': payload.event,
        'X-Alert-Type': payload.alertType,
        'X-Delivery-Attempt': (attempt + 1).toString(),
        ...config.headers,
      };

      // Add signature if secret is configured
      if (config.secret && options.signPayload !== false) {
        const signature = await generateSignature(payloadString, config.secret);
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
        headers['X-Webhook-Timestamp'] = payload.timestamp;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(config.url, {
          method: 'POST',
          headers,
          body: payloadString,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          return { success: true, statusCode: response.status };
        }

        // Don't retry for client errors (4xx) except rate limiting
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return {
            success: false,
            statusCode: response.status,
            error: `HTTP ${response.status}: ${await response.text()}`,
          };
        }

        lastError = `HTTP ${response.status}`;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        lastError = 'Request timed out';
      } else {
        lastError = String(error);
      }
    }

    // Exponential backoff before retry
    if (attempt < retries - 1) {
      await new Promise(resolve =>
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }

  return { success: false, error: lastError };
}

/**
 * Send a court alert via webhook
 */
export async function sendAlertWebhook(
  config: WebhookConfig,
  alert: CourtAlert,
  options: WebhookDeliveryOptions = {}
): Promise<AlertDeliveryResult> {
  const payload: WebhookPayload = {
    event: 'case_update',
    alertId: alert.id,
    alertType: alert.alertType,
    caseNumber: alert.caseNumber,
    courtId: alert.courtId,
    title: alert.title,
    message: alert.message,
    data: options.includeFullData ? (alert.data || {}) : {},
    timestamp: new Date().toISOString(),
  };

  const result = await sendWebhook(config, payload, options);

  if (result.success) {
    logger.info('Webhook delivered', {
      alertId: alert.id,
      url: config.url,
      statusCode: result.statusCode,
    });

    return {
      alertId: alert.id,
      channel: 'webhook',
      success: true,
      deliveredAt: new Date(),
    };
  }

  logger.error('Webhook delivery failed', {
    alertId: alert.id,
    url: config.url,
    error: result.error,
  });

  return {
    alertId: alert.id,
    channel: 'webhook',
    success: false,
    error: result.error,
  };
}

/**
 * Send a batch of alerts via webhook
 */
export async function sendBatchWebhook(
  config: WebhookConfig,
  batch: AlertBatch,
  options: WebhookDeliveryOptions = {}
): Promise<AlertDeliveryResult[]> {
  const results: AlertDeliveryResult[] = [];

  // Send each alert individually
  for (const alert of batch.alerts) {
    const result = await sendAlertWebhook(config, alert, options);
    results.push(result);
  }

  return results;
}

/**
 * Validate webhook URL
 */
export function validateWebhookUrl(url: string): {
  valid: boolean;
  error?: string;
} {
  try {
    const parsed = new URL(url);

    // Must be HTTPS in production
    if (parsed.protocol !== 'https:') {
      return {
        valid: false,
        error: 'Webhook URL must use HTTPS',
      };
    }

    // Block local/private addresses
    const hostname = parsed.hostname.toLowerCase();
    const blockedPatterns = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '10.',
      '192.168.',
      '172.16.',
      '169.254.',
      '.local',
      '.internal',
    ];

    for (const pattern of blockedPatterns) {
      if (hostname.startsWith(pattern) || hostname.endsWith(pattern)) {
        return {
          valid: false,
          error: 'Cannot use local or private network addresses',
        };
      }
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Test webhook connectivity
 */
export async function testWebhook(
  config: WebhookConfig
): Promise<{ success: boolean; latencyMs?: number; error?: string }> {
  const startTime = Date.now();

  const payload: WebhookPayload = {
    event: 'case_update',
    alertId: 'test-' + Date.now(),
    alertType: 'new_filing',
    caseNumber: 'TEST-00-000000',
    courtId: 'test',
    title: 'Test Webhook',
    message: 'This is a test webhook to verify connectivity.',
    data: { test: true },
    timestamp: new Date().toISOString(),
  };

  const result = await sendWebhook(config, payload, { signPayload: true });
  const latencyMs = Date.now() - startTime;

  if (result.success) {
    return { success: true, latencyMs };
  }

  return { success: false, error: result.error };
}

/**
 * Create webhook config from user preferences
 */
export function createWebhookConfig(
  url: string,
  secret?: string
): WebhookConfig {
  return {
    url,
    secret,
    timeout: 30000,
    retries: 3,
  };
}
