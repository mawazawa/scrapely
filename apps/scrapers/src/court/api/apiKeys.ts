/**
 * API Key Management
 * Generate, validate, and manage API keys for the public court API
 */

import { logger } from '../../lib/logger';

/**
 * API key record
 */
export interface ApiKey {
  id: string;
  key: string;
  keyHash: string;
  name: string;
  userId: string;
  tier: 'free' | 'pro' | 'enterprise';
  permissions: ApiPermission[];
  rateLimit: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
}

/**
 * API permissions
 */
export type ApiPermission =
  | 'cases:read'
  | 'cases:search'
  | 'rulings:read'
  | 'parties:read'
  | 'documents:read'
  | 'documents:download'
  | 'webhooks:subscribe'
  | 'bulk:export';

/**
 * Rate limits by tier
 */
export const TIER_RATE_LIMITS: Record<ApiKey['tier'], ApiKey['rateLimit']> = {
  free: {
    requestsPerMinute: 10,
    requestsPerDay: 1000,
  },
  pro: {
    requestsPerMinute: 60,
    requestsPerDay: 10000,
  },
  enterprise: {
    requestsPerMinute: 300,
    requestsPerDay: 100000,
  },
};

/**
 * Permissions by tier
 */
export const TIER_PERMISSIONS: Record<ApiKey['tier'], ApiPermission[]> = {
  free: ['cases:read', 'cases:search', 'rulings:read', 'parties:read'],
  pro: [
    'cases:read',
    'cases:search',
    'rulings:read',
    'parties:read',
    'documents:read',
    'documents:download',
    'webhooks:subscribe',
  ],
  enterprise: [
    'cases:read',
    'cases:search',
    'rulings:read',
    'parties:read',
    'documents:read',
    'documents:download',
    'webhooks:subscribe',
    'bulk:export',
  ],
};

/**
 * Generate a new API key
 */
export async function generateApiKey(): Promise<{ key: string; keyHash: string }> {
  // Generate a random key
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const key = 'sk_court_' + Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Hash the key for storage
  const keyHash = await hashApiKey(key);

  return { key, keyHash };
}

/**
 * Hash an API key for secure storage
 */
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate an API key format
 */
export function isValidKeyFormat(key: string): boolean {
  return /^sk_court_[a-f0-9]{64}$/.test(key);
}

/**
 * API key storage using KV
 */
export class ApiKeyStore {
  private kv: KVNamespace;
  private prefix: string;

  constructor(kv: KVNamespace, prefix: string = 'api_key:') {
    this.kv = kv;
    this.prefix = prefix;
  }

  /**
   * Create a new API key
   */
  async createKey(
    userId: string,
    name: string,
    tier: ApiKey['tier'] = 'free'
  ): Promise<{ apiKey: ApiKey; rawKey: string }> {
    const { key, keyHash } = await generateApiKey();
    const id = crypto.randomUUID();

    const apiKey: ApiKey = {
      id,
      key: key.substring(0, 15) + '...',  // Store truncated version
      keyHash,
      name,
      userId,
      tier,
      permissions: TIER_PERMISSIONS[tier],
      rateLimit: TIER_RATE_LIMITS[tier],
      createdAt: new Date(),
      isActive: true,
    };

    // Store by hash for lookup
    await this.kv.put(
      `${this.prefix}hash:${keyHash}`,
      JSON.stringify(apiKey)
    );

    // Store by user for listing
    await this.kv.put(
      `${this.prefix}user:${userId}:${id}`,
      JSON.stringify(apiKey)
    );

    logger.info('API key created', {
      id,
      userId,
      tier,
      name,
    });

    return { apiKey, rawKey: key };
  }

  /**
   * Validate an API key and return the record
   */
  async validateKey(rawKey: string): Promise<ApiKey | null> {
    if (!isValidKeyFormat(rawKey)) {
      return null;
    }

    const keyHash = await hashApiKey(rawKey);
    const data = await this.kv.get(`${this.prefix}hash:${keyHash}`, 'json');

    if (!data) {
      return null;
    }

    const apiKey = data as ApiKey;

    // Check if active
    if (!apiKey.isActive) {
      return null;
    }

    // Check expiration
    if (apiKey.expiresAt && new Date() > new Date(apiKey.expiresAt)) {
      return null;
    }

    // Update last used
    apiKey.lastUsedAt = new Date();
    await this.kv.put(
      `${this.prefix}hash:${keyHash}`,
      JSON.stringify(apiKey)
    );

    return apiKey;
  }

  /**
   * Get API keys for a user
   */
  async getUserKeys(userId: string): Promise<ApiKey[]> {
    const keys: ApiKey[] = [];
    let cursor: string | undefined;
    const prefix = `${this.prefix}user:${userId}:`;

    do {
      const list = await this.kv.list({ prefix, cursor });

      for (const key of list.keys) {
        const data = await this.kv.get(key.name, 'json');
        if (data) {
          keys.push(data as ApiKey);
        }
      }

      cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor);

    return keys.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Revoke an API key
   */
  async revokeKey(userId: string, keyId: string): Promise<boolean> {
    const userKey = `${this.prefix}user:${userId}:${keyId}`;
    const data = await this.kv.get(userKey, 'json');

    if (!data) {
      return false;
    }

    const apiKey = data as ApiKey;
    apiKey.isActive = false;

    // Update both stores
    await this.kv.put(userKey, JSON.stringify(apiKey));
    await this.kv.put(
      `${this.prefix}hash:${apiKey.keyHash}`,
      JSON.stringify(apiKey)
    );

    logger.info('API key revoked', { keyId, userId });

    return true;
  }

  /**
   * Delete an API key
   */
  async deleteKey(userId: string, keyId: string): Promise<boolean> {
    const userKey = `${this.prefix}user:${userId}:${keyId}`;
    const data = await this.kv.get(userKey, 'json');

    if (!data) {
      return false;
    }

    const apiKey = data as ApiKey;

    // Delete from both stores
    await this.kv.delete(userKey);
    await this.kv.delete(`${this.prefix}hash:${apiKey.keyHash}`);

    logger.info('API key deleted', { keyId, userId });

    return true;
  }
}

/**
 * Create API key store
 */
export function createApiKeyStore(kv: KVNamespace): ApiKeyStore {
  return new ApiKeyStore(kv);
}
