/**
 * Court Alerts Module
 * Exports for case update alert system
 */

// Main service
export {
  AlertService,
  createAlertService,
  type AlertServiceConfig,
  type CreateAlertOptions,
} from './AlertService';

// Types
export {
  type CourtAlert,
  type CourtAlertType,
  type AlertChannel,
  type AlertPriority,
  type AlertStatus,
  type AlertPreferences,
  type AlertTemplateVars,
  type AlertBatch,
  type AlertDeliveryResult,
  type WebhookPayload,
  type AlertStats,
  DEFAULT_ALERT_PREFERENCES,
  getPriorityLevel,
  getAlertTypeDisplayName,
  changeTypeToAlertType,
} from './types';

// Quiet hours
export {
  isInQuietHours,
  getNextDeliveryTime,
  shouldBypassQuietHours,
  getQuietHoursStatus,
  validateQuietHours,
  COURT_TIMEZONES,
  QUIET_HOURS_PRESETS,
} from './quietHours';

// Batching
export {
  AlertBatcher,
  createAlertBatcher,
  groupAlertsByCase,
  sortAlerts,
  generateDigestSummary,
  type BatchingConfig,
} from './batching';

// Email
export {
  createEmailClient,
  sendAlertEmail,
  sendDigestEmail,
  SendGridClient,
  ResendClient,
  type EmailConfig,
  type EmailClient,
} from './email';

// Email templates
export { emailTemplates } from './templates/email';

// Push notifications
export {
  sendPushNotification,
  sendAlertPush,
  sendBatchPush,
  storePushSubscription,
  getPushSubscription,
  deletePushSubscription,
  isPushSupported,
  type PushSubscription,
  type PushConfig,
  type PushPayload,
} from './push';

// Webhooks
export {
  sendAlertWebhook,
  sendBatchWebhook,
  validateWebhookUrl,
  testWebhook,
  createWebhookConfig,
  type WebhookConfig,
  type WebhookDeliveryOptions,
} from './webhook';
