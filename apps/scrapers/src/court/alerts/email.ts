/**
 * Email Alert Delivery
 * Send court alerts via email
 */

import { logger } from '../../lib/logger';
import type {
  CourtAlert,
  AlertDeliveryResult,
  AlertTemplateVars,
  AlertBatch,
} from './types';
import {
  generateSubject,
  generateDigestSubject,
  generateAlertEmailHtml,
  generateAlertEmailText,
  generateDigestEmailHtml,
} from './templates/email';

/**
 * Email configuration
 */
export interface EmailConfig {
  fromAddress: string;
  fromName: string;
  replyTo?: string;
  apiKey: string;
  provider: 'sendgrid' | 'resend' | 'mailgun';
}

/**
 * Email client interface
 */
export interface EmailClient {
  send(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
    replyTo?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

/**
 * SendGrid email client
 */
export class SendGridClient implements EmailClient {
  private apiKey: string;
  private from: { email: string; name: string };

  constructor(config: EmailConfig) {
    this.apiKey = config.apiKey;
    this.from = { email: config.fromAddress, name: config.fromName };
  }

  async send(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
    replyTo?: string;
  }) {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: options.to }] }],
          from: this.from,
          reply_to: options.replyTo ? { email: options.replyTo } : undefined,
          subject: options.subject,
          content: [
            { type: 'text/plain', value: options.text },
            { type: 'text/html', value: options.html },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }

      const messageId = response.headers.get('X-Message-Id') || undefined;
      return { success: true, messageId };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}

/**
 * Resend email client
 */
export class ResendClient implements EmailClient {
  private apiKey: string;
  private from: string;

  constructor(config: EmailConfig) {
    this.apiKey = config.apiKey;
    this.from = `${config.fromName} <${config.fromAddress}>`;
  }

  async send(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
    replyTo?: string;
  }) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: options.to,
          reply_to: options.replyTo,
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }

      const data = await response.json() as { id: string };
      return { success: true, messageId: data.id };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}

/**
 * Create email client based on config
 */
export function createEmailClient(config: EmailConfig): EmailClient {
  switch (config.provider) {
    case 'resend':
      return new ResendClient(config);
    case 'sendgrid':
    default:
      return new SendGridClient(config);
  }
}

/**
 * Send a single alert email
 */
export async function sendAlertEmail(
  client: EmailClient,
  alert: CourtAlert,
  recipient: {
    email: string;
    name: string;
  },
  options: {
    actionUrl?: string;
    unsubscribeUrl?: string;
    courtName?: string;
  } = {}
): Promise<AlertDeliveryResult> {
  try {
    const vars: AlertTemplateVars = {
      userName: recipient.name,
      caseNumber: alert.caseNumber,
      courtName: options.courtName || 'Superior Court',
      alertType: alert.alertType,
      title: alert.title,
      message: alert.message,
      actionUrl: options.actionUrl,
      unsubscribeUrl: options.unsubscribeUrl,
    };

    const html = generateAlertEmailHtml(vars);
    const text = generateAlertEmailText(vars);
    const subject = generateSubject(alert);

    const result = await client.send({
      to: recipient.email,
      subject,
      html,
      text,
    });

    if (result.success) {
      logger.info('Alert email sent', {
        alertId: alert.id,
        recipient: recipient.email,
        messageId: result.messageId,
      });

      return {
        alertId: alert.id,
        channel: 'email',
        success: true,
        messageId: result.messageId,
        deliveredAt: new Date(),
      };
    }

    logger.error('Alert email failed', {
      alertId: alert.id,
      error: result.error,
    });

    return {
      alertId: alert.id,
      channel: 'email',
      success: false,
      error: result.error,
    };
  } catch (error) {
    logger.error('Alert email error', {
      alertId: alert.id,
      error: String(error),
    });

    return {
      alertId: alert.id,
      channel: 'email',
      success: false,
      error: String(error),
    };
  }
}

/**
 * Send a batch/digest email
 */
export async function sendDigestEmail(
  client: EmailClient,
  batch: AlertBatch,
  recipient: {
    email: string;
    name: string;
  },
  options: {
    actionBaseUrl: string;
    unsubscribeUrl?: string;
  }
): Promise<AlertDeliveryResult[]> {
  const results: AlertDeliveryResult[] = [];

  try {
    const html = generateDigestEmailHtml(
      batch.alerts,
      recipient.name,
      options.actionBaseUrl,
      options.unsubscribeUrl
    );

    // Generate plain text version
    let text = `Court Updates Digest\n${'='.repeat(40)}\n\n`;
    text += `Hello ${recipient.name},\n\n`;
    text += `You have ${batch.alerts.length} new updates across your tracked cases:\n\n`;

    for (const alert of batch.alerts) {
      text += `[${alert.caseNumber}] ${alert.title}\n`;
      text += `${alert.message}\n\n`;
    }

    text += `---\nManage preferences: ${options.unsubscribeUrl || 'N/A'}\n`;

    const subject = generateDigestSubject(batch.alerts);

    const result = await client.send({
      to: recipient.email,
      subject,
      html,
      text,
    });

    if (result.success) {
      logger.info('Digest email sent', {
        batchId: batch.id,
        alertCount: batch.alerts.length,
        messageId: result.messageId,
      });

      // Mark all alerts as delivered
      for (const alert of batch.alerts) {
        results.push({
          alertId: alert.id,
          channel: 'email',
          success: true,
          messageId: result.messageId,
          deliveredAt: new Date(),
        });
      }
    } else {
      logger.error('Digest email failed', {
        batchId: batch.id,
        error: result.error,
      });

      for (const alert of batch.alerts) {
        results.push({
          alertId: alert.id,
          channel: 'email',
          success: false,
          error: result.error,
        });
      }
    }
  } catch (error) {
    logger.error('Digest email error', {
      batchId: batch.id,
      error: String(error),
    });

    for (const alert of batch.alerts) {
      results.push({
        alertId: alert.id,
        channel: 'email',
        success: false,
        error: String(error),
      });
    }
  }

  return results;
}
