/**
 * SF Court Session Management
 * Session persistence and cookie management for SF Court scraping
 */

import { logger } from '../../lib/logger';
import type { SessionData } from '../types';

/**
 * SF Court specific cookies to preserve
 */
export const SF_COURT_COOKIES = [
  // Cloudflare cookies
  'cf_clearance',
  '__cf_bm',
  'cf_chl_2',

  // Session cookies (names may vary)
  'JSESSIONID',
  'PHPSESSID',
  'ASP.NET_SessionId',
  'session_id',
  'sess',

  // Court-specific cookies
  'court_session',
  'user_prefs',
] as const;

/**
 * Session validation result
 */
export interface SessionValidation {
  valid: boolean;
  reason?: string;
  expiresSoon?: boolean;
  expiresAt?: Date;
}

/**
 * Validate session data
 */
export function validateSession(session: SessionData | null): SessionValidation {
  if (!session) {
    return { valid: false, reason: 'No session data' };
  }

  // Check if session has expired
  const now = new Date();
  if (now > session.expiresAt) {
    return { valid: false, reason: 'Session expired' };
  }

  // Check if session will expire soon (within 5 minutes)
  const fiveMinutes = 5 * 60 * 1000;
  const expiresSoon = session.expiresAt.getTime() - now.getTime() < fiveMinutes;

  // Check for required cookies
  const hasCfClearance = session.cookies.some(c =>
    'name' in c && (c as unknown as { name: string }).name === 'cf_clearance'
  );

  if (!hasCfClearance) {
    return { valid: false, reason: 'Missing Cloudflare clearance cookie' };
  }

  // Check cf_clearance expiration
  const cfCookie = session.cookies.find(c =>
    'name' in c && (c as unknown as { name: string }).name === 'cf_clearance'
  );

  if (cfCookie && 'expires' in cfCookie) {
    const cfExpires = (cfCookie as unknown as { expires: number }).expires * 1000;
    if (now.getTime() > cfExpires) {
      return { valid: false, reason: 'Cloudflare cookie expired' };
    }
  }

  return {
    valid: true,
    expiresSoon,
    expiresAt: session.expiresAt,
  };
}

/**
 * Filter cookies to only include relevant ones
 */
export function filterCourtCookies(
  cookies: Record<string, string>[]
): Record<string, string>[] {
  return cookies.filter(cookie => {
    if (!('name' in cookie)) return false;
    const name = (cookie as unknown as { name: string }).name;

    // Include Cloudflare cookies
    if (name.startsWith('cf_') || name.startsWith('__cf')) return true;

    // Include known session cookies
    if (SF_COURT_COOKIES.includes(name as typeof SF_COURT_COOKIES[number])) return true;

    return false;
  });
}

/**
 * Merge session cookies (new cookies override old)
 */
export function mergeSessionCookies(
  existingCookies: Record<string, string>[],
  newCookies: Record<string, string>[]
): Record<string, string>[] {
  const cookieMap = new Map<string, Record<string, string>>();

  // Add existing cookies
  for (const cookie of existingCookies) {
    if ('name' in cookie) {
      const name = (cookie as unknown as { name: string }).name;
      cookieMap.set(name, cookie);
    }
  }

  // Override with new cookies
  for (const cookie of newCookies) {
    if ('name' in cookie) {
      const name = (cookie as unknown as { name: string }).name;
      cookieMap.set(name, cookie);
    }
  }

  return Array.from(cookieMap.values());
}

/**
 * Create session data with default values
 */
export function createSessionData(
  courtId: string,
  cookies: Record<string, string>[],
  options?: {
    ttlHours?: number;
    localStorage?: Record<string, string>;
  }
): SessionData {
  const now = new Date();
  const ttlHours = options?.ttlHours || 24;

  return {
    id: crypto.randomUUID(),
    courtId,
    cookies: filterCourtCookies(cookies),
    localStorage: options?.localStorage,
    createdAt: now,
    expiresAt: new Date(now.getTime() + ttlHours * 60 * 60 * 1000),
    isValid: true,
  };
}

/**
 * Extend session expiration
 */
export function extendSession(session: SessionData, additionalHours: number = 1): SessionData {
  return {
    ...session,
    expiresAt: new Date(session.expiresAt.getTime() + additionalHours * 60 * 60 * 1000),
  };
}

/**
 * Invalidate session
 */
export function invalidateSession(session: SessionData): SessionData {
  return {
    ...session,
    isValid: false,
  };
}

/**
 * Session storage interface for different backends
 */
export interface SessionStorage {
  get(courtId: string): Promise<SessionData | null>;
  set(session: SessionData): Promise<void>;
  delete(courtId: string): Promise<void>;
  listCourts(): Promise<string[]>;
}

/**
 * KV-backed session storage
 */
export class KVSessionStorage implements SessionStorage {
  private kv: KVNamespace;
  private prefix: string;

  constructor(kv: KVNamespace, prefix: string = 'court_session:') {
    this.kv = kv;
    this.prefix = prefix;
  }

  async get(courtId: string): Promise<SessionData | null> {
    try {
      const data = await this.kv.get(`${this.prefix}${courtId}`, 'json');
      if (!data) return null;

      // Deserialize dates
      const session = data as SessionData;
      return {
        ...session,
        createdAt: new Date(session.createdAt),
        expiresAt: new Date(session.expiresAt),
      };
    } catch (error) {
      logger.error('Failed to get session', { courtId, error: String(error) });
      return null;
    }
  }

  async set(session: SessionData): Promise<void> {
    try {
      const ttl = Math.ceil((session.expiresAt.getTime() - Date.now()) / 1000);

      if (ttl <= 0) {
        // Session already expired, don't store
        return;
      }

      await this.kv.put(
        `${this.prefix}${session.courtId}`,
        JSON.stringify(session),
        { expirationTtl: ttl }
      );

      logger.debug('Session stored', {
        courtId: session.courtId,
        sessionId: session.id,
        ttlSeconds: ttl,
      });
    } catch (error) {
      logger.error('Failed to store session', { courtId: session.courtId, error: String(error) });
    }
  }

  async delete(courtId: string): Promise<void> {
    try {
      await this.kv.delete(`${this.prefix}${courtId}`);
      logger.debug('Session deleted', { courtId });
    } catch (error) {
      logger.error('Failed to delete session', { courtId, error: String(error) });
    }
  }

  async listCourts(): Promise<string[]> {
    try {
      const list = await this.kv.list({ prefix: this.prefix });
      return list.keys.map(key => key.name.replace(this.prefix, ''));
    } catch (error) {
      logger.error('Failed to list sessions', { error: String(error) });
      return [];
    }
  }
}

/**
 * In-memory session storage (for testing)
 */
export class MemorySessionStorage implements SessionStorage {
  private sessions: Map<string, SessionData> = new Map();

  async get(courtId: string): Promise<SessionData | null> {
    const session = this.sessions.get(courtId);
    if (!session) return null;

    // Check expiration
    if (new Date() > session.expiresAt) {
      this.sessions.delete(courtId);
      return null;
    }

    return session;
  }

  async set(session: SessionData): Promise<void> {
    this.sessions.set(session.courtId, session);
  }

  async delete(courtId: string): Promise<void> {
    this.sessions.delete(courtId);
  }

  async listCourts(): Promise<string[]> {
    return Array.from(this.sessions.keys());
  }

  clear(): void {
    this.sessions.clear();
  }
}

/**
 * Create session storage instance
 */
export function createSessionStorage(kv?: KVNamespace): SessionStorage {
  if (kv) {
    return new KVSessionStorage(kv);
  }
  return new MemorySessionStorage();
}
