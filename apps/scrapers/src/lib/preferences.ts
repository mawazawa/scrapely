/**
 * User preferences management
 * Stores and retrieves user preferences for personalized content
 */

import { z } from 'zod';
import { logger } from './logger';

/**
 * User preferences schema
 */
export const UserPreferencesSchema = z.object({
  userId: z.string(),
  topics: z.array(z.string()).default([]),
  regions: z.array(z.string()).default([]),
  sources: z.object({
    included: z.array(z.number()).default([]),
    excluded: z.array(z.number()).default([]),
  }).default({ included: [], excluded: [] }),
  notifications: z.object({
    email: z.boolean().default(true),
    push: z.boolean().default(false),
    frequency: z.enum(['instant', 'daily', 'weekly']).default('daily'),
  }).default({ email: true, push: false, frequency: 'daily' }),
  display: z.object({
    language: z.string().default('en'),
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    summaryLength: z.enum(['short', 'medium', 'long']).default('medium'),
  }).default({ language: 'en', theme: 'system', summaryLength: 'medium' }),
  createdAt: z.number().default(() => Date.now()),
  updatedAt: z.number().default(() => Date.now()),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

/**
 * Available topics for preferences
 */
export const AVAILABLE_TOPICS = [
  'politics',
  'economics',
  'security',
  'technology',
  'environment',
  'social',
  'health',
  'science',
  'business',
  'culture',
];

/**
 * Available regions for preferences
 */
export const AVAILABLE_REGIONS = [
  'north-america',
  'south-america',
  'europe',
  'middle-east',
  'africa',
  'asia-pacific',
  'global',
];

/**
 * Default preferences
 */
export function getDefaultPreferences(userId: string): UserPreferences {
  return UserPreferencesSchema.parse({ userId });
}

/**
 * Validate preferences
 */
export function validatePreferences(prefs: unknown): UserPreferences | null {
  try {
    return UserPreferencesSchema.parse(prefs);
  } catch (error) {
    logger.warn('Invalid preferences', { error: String(error) });
    return null;
  }
}

/**
 * Store preferences in KV
 */
export async function storePreferences(
  kv: KVNamespace | undefined,
  preferences: UserPreferences
): Promise<boolean> {
  if (!kv) {
    logger.warn('No KV namespace for preferences storage');
    return false;
  }

  try {
    const key = `prefs:${preferences.userId}`;
    await kv.put(key, JSON.stringify({
      ...preferences,
      updatedAt: Date.now(),
    }));

    logger.info('Preferences stored', { userId: preferences.userId });
    return true;
  } catch (error) {
    logger.error('Failed to store preferences', { error: String(error) });
    return false;
  }
}

/**
 * Get preferences from KV
 */
export async function getPreferences(
  kv: KVNamespace | undefined,
  userId: string
): Promise<UserPreferences | null> {
  if (!kv) {
    return getDefaultPreferences(userId);
  }

  try {
    const key = `prefs:${userId}`;
    const data = await kv.get(key, 'json');

    if (!data) {
      return getDefaultPreferences(userId);
    }

    return validatePreferences(data);
  } catch {
    return getDefaultPreferences(userId);
  }
}

/**
 * Update specific preference fields
 */
export async function updatePreferences(
  kv: KVNamespace | undefined,
  userId: string,
  updates: Partial<UserPreferences>
): Promise<UserPreferences | null> {
  const current = await getPreferences(kv, userId);
  if (!current) return null;

  const updated: UserPreferences = {
    ...current,
    ...updates,
    userId, // Ensure userId is not overwritten
    updatedAt: Date.now(),
  };

  const valid = validatePreferences(updated);
  if (!valid) return null;

  await storePreferences(kv, valid);
  return valid;
}

/**
 * Delete preferences
 */
export async function deletePreferences(
  kv: KVNamespace | undefined,
  userId: string
): Promise<boolean> {
  if (!kv) return false;

  try {
    await kv.delete(`prefs:${userId}`);
    logger.info('Preferences deleted', { userId });
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate user ID from cookie or create new
 */
export function getUserId(request: Request): string {
  const cookies = request.headers.get('Cookie') || '';
  const match = cookies.match(/meridian_user=([^;]+)/);

  if (match) {
    return match[1];
  }

  // Generate new user ID
  return crypto.randomUUID();
}

/**
 * Create Set-Cookie header for user ID
 */
export function createUserIdCookie(userId: string): string {
  const maxAge = 365 * 24 * 60 * 60; // 1 year
  return `meridian_user=${userId}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure`;
}

/**
 * Filter articles by user preferences
 */
export function filterArticlesByPreferences<T extends {
  sourceId?: number;
  category?: string;
  region?: string;
}>(
  articles: T[],
  preferences: UserPreferences
): T[] {
  return articles.filter(article => {
    // Check excluded sources
    if (article.sourceId && preferences.sources.excluded.includes(article.sourceId)) {
      return false;
    }

    // Check included sources (if specified, only include those)
    if (preferences.sources.included.length > 0 && article.sourceId) {
      if (!preferences.sources.included.includes(article.sourceId)) {
        return false;
      }
    }

    // Check topics (if specified)
    if (preferences.topics.length > 0 && article.category) {
      if (!preferences.topics.includes(article.category)) {
        return false;
      }
    }

    // Check regions (if specified)
    if (preferences.regions.length > 0 && article.region) {
      if (!preferences.regions.includes(article.region)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Get personalized content score
 */
export function getRelevanceScore(
  article: { category?: string; region?: string },
  preferences: UserPreferences
): number {
  let score = 0.5; // Base score

  // Boost for matching topics
  if (article.category && preferences.topics.includes(article.category)) {
    score += 0.3;
  }

  // Boost for matching regions
  if (article.region && preferences.regions.includes(article.region)) {
    score += 0.2;
  }

  return Math.min(score, 1.0);
}
