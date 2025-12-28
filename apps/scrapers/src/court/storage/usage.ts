/**
 * Storage Usage Tracking
 * Track storage usage per user and court
 */

import { logger } from '../../lib/logger';

/**
 * Usage record
 */
export interface UsageRecord {
  userId: string;
  courtId: string;
  documentCount: number;
  totalBytes: number;
  lastUpdated: Date;
}

/**
 * Usage limits by tier
 */
export interface UsageTier {
  name: string;
  maxDocuments: number;
  maxBytesPerUser: number;
  maxBytesPerDocument: number;
}

/**
 * Default usage tiers
 */
export const USAGE_TIERS: Record<string, UsageTier> = {
  free: {
    name: 'Free',
    maxDocuments: 50,
    maxBytesPerUser: 100 * 1024 * 1024,  // 100 MB
    maxBytesPerDocument: 10 * 1024 * 1024,  // 10 MB
  },
  pro: {
    name: 'Professional',
    maxDocuments: 500,
    maxBytesPerUser: 1024 * 1024 * 1024,  // 1 GB
    maxBytesPerDocument: 50 * 1024 * 1024,  // 50 MB
  },
  enterprise: {
    name: 'Enterprise',
    maxDocuments: -1,  // Unlimited
    maxBytesPerUser: 10 * 1024 * 1024 * 1024,  // 10 GB
    maxBytesPerDocument: 100 * 1024 * 1024,  // 100 MB
  },
};

/**
 * Usage check result
 */
export interface UsageCheckResult {
  allowed: boolean;
  reason?: string;
  currentUsage: {
    documents: number;
    bytes: number;
  };
  limits: {
    documents: number;
    bytes: number;
  };
  percentUsed: {
    documents: number;
    bytes: number;
  };
}

/**
 * Usage tracker using KV
 */
export class UsageTracker {
  private kv: KVNamespace;
  private prefix: string;

  constructor(kv: KVNamespace, prefix: string = 'storage_usage:') {
    this.kv = kv;
    this.prefix = prefix;
  }

  /**
   * Get usage for a user
   */
  async getUsage(userId: string): Promise<UsageRecord | null> {
    try {
      const key = `${this.prefix}${userId}`;
      const data = await this.kv.get(key, 'json');

      if (!data) return null;

      const record = data as UsageRecord;
      record.lastUpdated = new Date(record.lastUpdated);
      return record;
    } catch (error) {
      logger.error('Failed to get usage', { userId, error: String(error) });
      return null;
    }
  }

  /**
   * Update usage for a user
   */
  async updateUsage(
    userId: string,
    courtId: string,
    delta: { documents?: number; bytes?: number }
  ): Promise<UsageRecord> {
    const key = `${this.prefix}${userId}`;
    let record = await this.getUsage(userId);

    if (!record) {
      record = {
        userId,
        courtId,
        documentCount: 0,
        totalBytes: 0,
        lastUpdated: new Date(),
      };
    }

    record.documentCount += delta.documents || 0;
    record.totalBytes += delta.bytes || 0;
    record.lastUpdated = new Date();

    // Ensure non-negative
    record.documentCount = Math.max(0, record.documentCount);
    record.totalBytes = Math.max(0, record.totalBytes);

    await this.kv.put(key, JSON.stringify(record));

    logger.debug('Usage updated', {
      userId,
      documents: record.documentCount,
      bytes: record.totalBytes,
    });

    return record;
  }

  /**
   * Check if user can upload
   */
  async checkCanUpload(
    userId: string,
    tier: string,
    uploadSizeBytes: number
  ): Promise<UsageCheckResult> {
    const limits = USAGE_TIERS[tier] || USAGE_TIERS.free;
    const usage = await this.getUsage(userId);

    const currentDocs = usage?.documentCount || 0;
    const currentBytes = usage?.totalBytes || 0;

    const result: UsageCheckResult = {
      allowed: true,
      currentUsage: {
        documents: currentDocs,
        bytes: currentBytes,
      },
      limits: {
        documents: limits.maxDocuments,
        bytes: limits.maxBytesPerUser,
      },
      percentUsed: {
        documents: limits.maxDocuments > 0
          ? (currentDocs / limits.maxDocuments) * 100
          : 0,
        bytes: (currentBytes / limits.maxBytesPerUser) * 100,
      },
    };

    // Check document limit
    if (limits.maxDocuments > 0 && currentDocs >= limits.maxDocuments) {
      result.allowed = false;
      result.reason = `Document limit reached (${limits.maxDocuments} documents)`;
      return result;
    }

    // Check per-document size limit
    if (uploadSizeBytes > limits.maxBytesPerDocument) {
      result.allowed = false;
      result.reason = `File too large (max ${formatBytes(limits.maxBytesPerDocument)})`;
      return result;
    }

    // Check total storage limit
    if (currentBytes + uploadSizeBytes > limits.maxBytesPerUser) {
      result.allowed = false;
      result.reason = `Storage limit reached (${formatBytes(limits.maxBytesPerUser)})`;
      return result;
    }

    return result;
  }

  /**
   * Get usage summary for all users
   */
  async getAllUsage(): Promise<UsageRecord[]> {
    const records: UsageRecord[] = [];
    let cursor: string | undefined;

    do {
      const list = await this.kv.list({ prefix: this.prefix, cursor });

      for (const key of list.keys) {
        const data = await this.kv.get(key.name, 'json');
        if (data) {
          const record = data as UsageRecord;
          record.lastUpdated = new Date(record.lastUpdated);
          records.push(record);
        }
      }

      cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor);

    return records;
  }

  /**
   * Reset usage for a user
   */
  async resetUsage(userId: string): Promise<void> {
    const key = `${this.prefix}${userId}`;
    await this.kv.delete(key);
    logger.info('Usage reset', { userId });
  }

  /**
   * Calculate usage from bucket (for reconciliation)
   */
  async reconcileUsage(
    bucket: R2Bucket,
    userId: string,
    courtId: string
  ): Promise<UsageRecord> {
    let documentCount = 0;
    let totalBytes = 0;
    let cursor: string | undefined;

    // This assumes documents are stored with user ID in metadata
    do {
      const list = await bucket.list({ cursor, limit: 1000 });

      for (const obj of list.objects) {
        const objUserId = obj.customMetadata?.['x-user-id'];
        if (objUserId === userId) {
          documentCount++;
          totalBytes += obj.size;
        }
      }

      cursor = list.truncated ? list.cursor : undefined;
    } while (cursor);

    const record: UsageRecord = {
      userId,
      courtId,
      documentCount,
      totalBytes,
      lastUpdated: new Date(),
    };

    // Update stored usage
    await this.kv.put(`${this.prefix}${userId}`, JSON.stringify(record));

    logger.info('Usage reconciled', {
      userId,
      documents: documentCount,
      bytes: totalBytes,
    });

    return record;
  }
}

/**
 * Format bytes for display
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Parse bytes from string (e.g., "100 MB")
 */
export function parseBytes(str: string): number {
  const match = str.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  const multipliers: Record<string, number> = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024,
  };

  return value * (multipliers[unit] || 1);
}

/**
 * Create usage tracker instance
 */
export function createUsageTracker(kv: KVNamespace): UsageTracker {
  return new UsageTracker(kv);
}
