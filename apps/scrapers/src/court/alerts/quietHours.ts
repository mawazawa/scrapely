/**
 * Quiet Hours Management
 * Handle alert delivery timing based on user preferences
 */

import { logger } from '../../lib/logger';
import type { AlertPreferences, CourtAlertType } from './types';

/**
 * Check if current time is within quiet hours
 */
export function isInQuietHours(prefs: AlertPreferences): boolean {
  if (!prefs.quietHours.enabled) {
    return false;
  }

  const now = new Date();
  const timezone = prefs.quietHours.timezone || 'America/Los_Angeles';

  try {
    // Get current time in user's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    const currentMinutes = hour * 60 + minute;

    // Parse quiet hours
    const [startHour, startMin] = prefs.quietHours.start.split(':').map(Number);
    const [endHour, endMin] = prefs.quietHours.end.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g., 22:00 - 08:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    // Normal quiet hours (e.g., 12:00 - 14:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } catch (error) {
    logger.warn('Failed to check quiet hours', { error: String(error) });
    return false;
  }
}

/**
 * Get next available delivery time (after quiet hours end)
 */
export function getNextDeliveryTime(prefs: AlertPreferences): Date {
  if (!prefs.quietHours.enabled) {
    return new Date();
  }

  const now = new Date();
  const timezone = prefs.quietHours.timezone || 'America/Los_Angeles';

  try {
    // Parse end time
    const [endHour, endMin] = prefs.quietHours.end.split(':').map(Number);

    // Create date in user's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '2025', 10);
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '1', 10) - 1;
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '1', 10);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);

    // Calculate end time today
    let endTime = new Date(year, month, day, endHour, endMin);

    // If end time is in the past today, schedule for tomorrow
    const currentTime = new Date(year, month, day, hour, minute);
    if (endTime <= currentTime) {
      endTime = new Date(year, month, day + 1, endHour, endMin);
    }

    return endTime;
  } catch (error) {
    logger.warn('Failed to calculate next delivery time', { error: String(error) });
    return new Date();
  }
}

/**
 * Check if an alert type should bypass quiet hours
 */
export function shouldBypassQuietHours(
  alertType: CourtAlertType,
  prefs: AlertPreferences
): boolean {
  // Critical alerts always bypass quiet hours
  const criticalTypes: CourtAlertType[] = [
    'new_ruling',
    'hearing_cancelled',
    'case_disposed',
  ];

  if (criticalTypes.includes(alertType)) {
    return true;
  }

  // Check user's immediate delivery settings
  return prefs.immediateFor?.includes(alertType) || false;
}

/**
 * Get quiet hours status for display
 */
export function getQuietHoursStatus(prefs: AlertPreferences): {
  enabled: boolean;
  active: boolean;
  resumesAt?: string;
  message: string;
} {
  if (!prefs.quietHours.enabled) {
    return {
      enabled: false,
      active: false,
      message: 'Quiet hours are disabled',
    };
  }

  const active = isInQuietHours(prefs);

  if (!active) {
    return {
      enabled: true,
      active: false,
      message: `Quiet hours: ${prefs.quietHours.start} - ${prefs.quietHours.end}`,
    };
  }

  const resumesAt = getNextDeliveryTime(prefs);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: prefs.quietHours.timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return {
    enabled: true,
    active: true,
    resumesAt: formatter.format(resumesAt),
    message: `Quiet hours active. Alerts will resume at ${formatter.format(resumesAt)}`,
  };
}

/**
 * Validate quiet hours configuration
 */
export function validateQuietHours(config: {
  start: string;
  end: string;
  timezone: string;
}): string[] {
  const errors: string[] = [];

  // Validate time format (HH:MM)
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

  if (!timeRegex.test(config.start)) {
    errors.push('Start time must be in HH:MM format (00:00 - 23:59)');
  }

  if (!timeRegex.test(config.end)) {
    errors.push('End time must be in HH:MM format (00:00 - 23:59)');
  }

  // Validate timezone
  try {
    Intl.DateTimeFormat(undefined, { timeZone: config.timezone });
  } catch {
    errors.push(`Invalid timezone: ${config.timezone}`);
  }

  return errors;
}

/**
 * Common timezones for US courts
 */
export const COURT_TIMEZONES = [
  { id: 'America/Los_Angeles', name: 'Pacific Time (PT)' },
  { id: 'America/Denver', name: 'Mountain Time (MT)' },
  { id: 'America/Chicago', name: 'Central Time (CT)' },
  { id: 'America/New_York', name: 'Eastern Time (ET)' },
  { id: 'America/Anchorage', name: 'Alaska Time (AKT)' },
  { id: 'Pacific/Honolulu', name: 'Hawaii Time (HT)' },
];

/**
 * Suggested quiet hours presets
 */
export const QUIET_HOURS_PRESETS = [
  { name: 'Night', start: '22:00', end: '07:00' },
  { name: 'Overnight', start: '23:00', end: '06:00' },
  { name: 'Extended Night', start: '20:00', end: '08:00' },
  { name: 'Weekday Only', start: '18:00', end: '08:00' },
  { name: 'Weekend', start: '00:00', end: '23:59' },
];
