/**
 * Court Alert Types
 * Type definitions for case update alert system
 */

/**
 * Alert types for court cases
 */
export type CourtAlertType =
  | 'new_ruling'
  | 'ruling_modified'
  | 'new_filing'
  | 'status_change'
  | 'hearing_scheduled'
  | 'hearing_rescheduled'
  | 'hearing_cancelled'
  | 'hearing_reminder'
  | 'party_added'
  | 'party_removed'
  | 'attorney_changed'
  | 'judge_changed'
  | 'department_changed'
  | 'case_disposed'
  | 'document_available';

/**
 * Alert delivery channels
 */
export type AlertChannel = 'email' | 'push' | 'webhook' | 'sms' | 'in_app';

/**
 * Alert priority levels
 */
export type AlertPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Alert status
 */
export type AlertStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'cancelled';

/**
 * Court alert definition
 */
export interface CourtAlert {
  id: string;
  userId: string;
  caseId: number;
  caseNumber: string;
  courtId: string;
  alertType: CourtAlertType;
  priority: AlertPriority;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  channels: AlertChannel[];
  status: AlertStatus;
  createdAt: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  error?: string;
}

/**
 * Alert preferences for a user
 */
export interface AlertPreferences {
  userId: string;
  enabled: boolean;
  channels: {
    email: boolean;
    push: boolean;
    webhook: boolean;
    sms: boolean;
    in_app: boolean;
  };
  email?: string;
  webhookUrl?: string;
  phoneNumber?: string;
  quietHours: {
    enabled: boolean;
    start: string;  // HH:MM format
    end: string;    // HH:MM format
    timezone: string;
  };
  alertTypes: {
    [K in CourtAlertType]?: {
      enabled: boolean;
      priority: AlertPriority;
      channels: AlertChannel[];
    };
  };
  batchingEnabled: boolean;
  batchIntervalMinutes: number;
  immediateFor: CourtAlertType[];  // These bypass batching
}

/**
 * Default alert preferences
 */
export const DEFAULT_ALERT_PREFERENCES: Omit<AlertPreferences, 'userId'> = {
  enabled: true,
  channels: {
    email: true,
    push: false,
    webhook: false,
    sms: false,
    in_app: true,
  },
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00',
    timezone: 'America/Los_Angeles',
  },
  alertTypes: {
    new_ruling: { enabled: true, priority: 'critical', channels: ['email', 'in_app'] },
    ruling_modified: { enabled: true, priority: 'high', channels: ['email', 'in_app'] },
    new_filing: { enabled: true, priority: 'medium', channels: ['email', 'in_app'] },
    status_change: { enabled: true, priority: 'high', channels: ['email', 'in_app'] },
    hearing_scheduled: { enabled: true, priority: 'high', channels: ['email', 'in_app'] },
    hearing_rescheduled: { enabled: true, priority: 'high', channels: ['email', 'in_app'] },
    hearing_cancelled: { enabled: true, priority: 'high', channels: ['email', 'in_app'] },
    hearing_reminder: { enabled: true, priority: 'medium', channels: ['email', 'in_app'] },
    case_disposed: { enabled: true, priority: 'critical', channels: ['email', 'in_app'] },
  },
  batchingEnabled: true,
  batchIntervalMinutes: 30,
  immediateFor: ['new_ruling', 'hearing_cancelled', 'case_disposed'],
};

/**
 * Alert template variables
 */
export interface AlertTemplateVars {
  userName: string;
  caseNumber: string;
  caseName?: string;
  courtName: string;
  alertType: CourtAlertType;
  title: string;
  message: string;
  changeDetails?: string;
  actionUrl?: string;
  unsubscribeUrl?: string;
}

/**
 * Alert batch
 */
export interface AlertBatch {
  id: string;
  userId: string;
  alerts: CourtAlert[];
  scheduledFor: Date;
  status: 'pending' | 'sent' | 'failed';
  createdAt: Date;
  sentAt?: Date;
}

/**
 * Alert delivery result
 */
export interface AlertDeliveryResult {
  alertId: string;
  channel: AlertChannel;
  success: boolean;
  messageId?: string;
  error?: string;
  deliveredAt?: Date;
}

/**
 * Webhook payload
 */
export interface WebhookPayload {
  event: 'case_update';
  alertId: string;
  alertType: CourtAlertType;
  caseNumber: string;
  courtId: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Alert statistics
 */
export interface AlertStats {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  byChannel: Record<AlertChannel, number>;
  byType: Record<CourtAlertType, number>;
  avgDeliveryTimeMs: number;
}

/**
 * Get priority level (lower = more urgent)
 */
export function getPriorityLevel(priority: AlertPriority): number {
  const levels: Record<AlertPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return levels[priority];
}

/**
 * Get alert type display name
 */
export function getAlertTypeDisplayName(type: CourtAlertType): string {
  const names: Record<CourtAlertType, string> = {
    new_ruling: 'New Ruling',
    ruling_modified: 'Ruling Modified',
    new_filing: 'New Filing',
    status_change: 'Status Change',
    hearing_scheduled: 'Hearing Scheduled',
    hearing_rescheduled: 'Hearing Rescheduled',
    hearing_cancelled: 'Hearing Cancelled',
    hearing_reminder: 'Hearing Reminder',
    party_added: 'Party Added',
    party_removed: 'Party Removed',
    attorney_changed: 'Attorney Changed',
    judge_changed: 'Judge Changed',
    department_changed: 'Department Changed',
    case_disposed: 'Case Disposed',
    document_available: 'Document Available',
  };
  return names[type];
}

/**
 * Map detected change type to alert type
 */
export function changeTypeToAlertType(
  changeType: string
): CourtAlertType | null {
  const mapping: Record<string, CourtAlertType> = {
    'new_ruling': 'new_ruling',
    'ruling_modified': 'ruling_modified',
    'new_filing': 'new_filing',
    'new_document': 'new_filing',
    'status_change': 'status_change',
    'hearing_scheduled': 'hearing_scheduled',
    'hearing_rescheduled': 'hearing_rescheduled',
    'hearing_cancelled': 'hearing_cancelled',
    'party_added': 'party_added',
    'party_removed': 'party_removed',
    'attorney_changed': 'attorney_changed',
    'judge_changed': 'judge_changed',
    'department_changed': 'department_changed',
    'disposition': 'case_disposed',
  };
  return mapping[changeType] || null;
}
