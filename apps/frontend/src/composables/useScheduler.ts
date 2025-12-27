/**
 * Brief Scheduling Composable
 * Manages scheduled brief generation with cron expressions
 */

import { ref, computed, reactive } from 'vue';

/**
 * Schedule configuration
 */
export interface ScheduleConfig {
  id: string;
  name: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  topics: string[];
  regions: string[];
  modelPreference: 'fast' | 'balanced' | 'quality';
  notifyEmail: boolean;
  notifyPush: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastRun?: Date;
  nextRun?: Date;
}

/**
 * Preset schedules
 */
export const SCHEDULE_PRESETS = {
  daily_morning: {
    name: 'Daily Morning Brief',
    cronExpression: '0 7 * * *',
    description: 'Every day at 7:00 AM',
  },
  daily_evening: {
    name: 'Daily Evening Brief',
    cronExpression: '0 18 * * *',
    description: 'Every day at 6:00 PM',
  },
  twice_daily: {
    name: 'Twice Daily',
    cronExpression: '0 7,18 * * *',
    description: 'At 7:00 AM and 6:00 PM',
  },
  weekday_morning: {
    name: 'Weekday Morning',
    cronExpression: '0 7 * * 1-5',
    description: 'Monday to Friday at 7:00 AM',
  },
  weekly_monday: {
    name: 'Weekly Monday',
    cronExpression: '0 9 * * 1',
    description: 'Every Monday at 9:00 AM',
  },
  custom: {
    name: 'Custom',
    cronExpression: '',
    description: 'Define your own schedule',
  },
} as const;

/**
 * Common timezones
 */
export const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'UTC', label: 'UTC' },
] as const;

/**
 * Parse cron expression to human-readable
 */
export function parseCronToHuman(cron: string): string {
  const parts = cron.split(' ');
  if (parts.length !== 5) return 'Invalid cron expression';

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Simple cases
  if (dayOfMonth === '*' && month === '*') {
    if (dayOfWeek === '*') {
      if (hour.includes(',')) {
        const hours = hour.split(',').map(h => formatHour(parseInt(h)));
        return `Daily at ${hours.join(' and ')}`;
      }
      return `Daily at ${formatHour(parseInt(hour))}`;
    }
    if (dayOfWeek === '1-5') {
      return `Weekdays at ${formatHour(parseInt(hour))}`;
    }
    if (dayOfWeek === '0,6') {
      return `Weekends at ${formatHour(parseInt(hour))}`;
    }
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const day = parseInt(dayOfWeek);
    if (day >= 0 && day <= 6) {
      return `Every ${dayNames[day]} at ${formatHour(parseInt(hour))}`;
    }
  }

  return cron;
}

function formatHour(hour: number): string {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:00 ${suffix}`;
}

/**
 * Calculate next run from cron expression
 */
export function getNextRun(cronExpression: string, timezone: string): Date | null {
  try {
    const [minute, hour, dayOfMonth, month, dayOfWeek] = cronExpression.split(' ').map(p => p.trim());

    const now = new Date();
    const next = new Date(now);

    // Simple implementation for common patterns
    if (dayOfMonth === '*' && month === '*') {
      const targetHour = parseInt(hour.split(',')[0]);
      const targetMinute = parseInt(minute);

      next.setHours(targetHour, targetMinute, 0, 0);

      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }

      // Adjust for day of week if specified
      if (dayOfWeek !== '*') {
        const days = dayOfWeek.includes('-')
          ? expandRange(dayOfWeek)
          : dayOfWeek.split(',').map(d => parseInt(d));

        while (!days.includes(next.getDay())) {
          next.setDate(next.getDate() + 1);
        }
      }

      return next;
    }

    return null;
  } catch {
    return null;
  }
}

function expandRange(range: string): number[] {
  const [start, end] = range.split('-').map(d => parseInt(d));
  const result: number[] = [];
  for (let i = start; i <= end; i++) {
    result.push(i);
  }
  return result;
}

/**
 * Scheduler composable
 */
export function useScheduler() {
  const schedules = ref<ScheduleConfig[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const editingSchedule = ref<Partial<ScheduleConfig> | null>(null);
  const isEditing = computed(() => editingSchedule.value !== null);

  const activeSchedules = computed(() => schedules.value.filter(s => s.enabled));

  /**
   * Fetch all schedules
   */
  async function fetchSchedules() {
    loading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/schedules');
      if (!response.ok) throw new Error('Failed to fetch schedules');

      const data = await response.json();
      schedules.value = data.schedules || [];
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      loading.value = false;
    }
  }

  /**
   * Create new schedule
   */
  async function createSchedule(config: Omit<ScheduleConfig, 'id' | 'createdAt' | 'updatedAt'>) {
    loading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) throw new Error('Failed to create schedule');

      const data = await response.json();
      schedules.value.push(data.schedule);

      return data.schedule;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Update existing schedule
   */
  async function updateSchedule(id: string, updates: Partial<ScheduleConfig>) {
    loading.value = true;
    error.value = null;

    try {
      const response = await fetch(`/api/schedules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update schedule');

      const data = await response.json();
      const index = schedules.value.findIndex(s => s.id === id);
      if (index !== -1) {
        schedules.value[index] = data.schedule;
      }

      return data.schedule;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Delete schedule
   */
  async function deleteSchedule(id: string) {
    loading.value = true;
    error.value = null;

    try {
      const response = await fetch(`/api/schedules/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete schedule');

      schedules.value = schedules.value.filter(s => s.id !== id);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Toggle schedule enabled state
   */
  async function toggleSchedule(id: string) {
    const schedule = schedules.value.find(s => s.id === id);
    if (schedule) {
      await updateSchedule(id, { enabled: !schedule.enabled });
    }
  }

  /**
   * Start editing a schedule
   */
  function startEditing(schedule?: ScheduleConfig) {
    editingSchedule.value = schedule
      ? { ...schedule }
      : {
          name: '',
          cronExpression: SCHEDULE_PRESETS.daily_morning.cronExpression,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          enabled: true,
          topics: [],
          regions: [],
          modelPreference: 'balanced',
          notifyEmail: true,
          notifyPush: false,
        };
  }

  /**
   * Cancel editing
   */
  function cancelEditing() {
    editingSchedule.value = null;
  }

  /**
   * Save current edit
   */
  async function saveEditing() {
    if (!editingSchedule.value) return;

    if (editingSchedule.value.id) {
      await updateSchedule(editingSchedule.value.id, editingSchedule.value);
    } else {
      await createSchedule(editingSchedule.value as Omit<ScheduleConfig, 'id' | 'createdAt' | 'updatedAt'>);
    }

    editingSchedule.value = null;
  }

  /**
   * Trigger immediate run
   */
  async function triggerNow(id: string) {
    try {
      const response = await fetch(`/api/schedules/${id}/trigger`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to trigger schedule');

      return await response.json();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      throw err;
    }
  }

  return {
    // State
    schedules,
    loading,
    error,
    editingSchedule,
    isEditing,
    activeSchedules,

    // Actions
    fetchSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    toggleSchedule,
    startEditing,
    cancelEditing,
    saveEditing,
    triggerNow,

    // Utilities
    parseCronToHuman,
    getNextRun,
  };
}
