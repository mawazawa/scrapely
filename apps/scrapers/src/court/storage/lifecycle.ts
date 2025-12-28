/**
 * Document Lifecycle Management
 * Manage document retention, archival, and cleanup
 */

import { logger } from '../../lib/logger';
import type { DocumentMetadata } from './metadata';
import { getVersionsToDelete, type RetentionPolicy, DEFAULT_RETENTION_POLICY } from './versioning';

/**
 * Lifecycle rule
 */
export interface LifecycleRule {
  id: string;
  name: string;
  enabled: boolean;
  filter: LifecycleFilter;
  actions: LifecycleAction[];
}

/**
 * Filter for which documents a rule applies to
 */
export interface LifecycleFilter {
  prefix?: string;
  courtId?: string;
  documentType?: string;
  olderThanDays?: number;
  sizeGreaterThan?: number;
  sizeMultiplier?: number;  // For version cleanup: delete if size > original * multiplier
}

/**
 * Action to take on matching documents
 */
export interface LifecycleAction {
  type: 'delete' | 'archive' | 'compress' | 'notify';
  afterDays?: number;
  targetTier?: 'standard' | 'infrequent' | 'archive';
}

/**
 * Default lifecycle rules
 */
export const DEFAULT_LIFECYCLE_RULES: LifecycleRule[] = [
  {
    id: 'version-cleanup',
    name: 'Clean up old versions',
    enabled: true,
    filter: {
      olderThanDays: 180,  // 6 months
    },
    actions: [
      { type: 'delete', afterDays: 180 },
    ],
  },
  {
    id: 'ocr-text-cleanup',
    name: 'Clean up old OCR text files',
    enabled: true,
    filter: {
      prefix: 'courts/',  // OCR files end with -ocr.txt
      olderThanDays: 365,
    },
    actions: [
      { type: 'delete', afterDays: 365 },
    ],
  },
  {
    id: 'thumbnail-cleanup',
    name: 'Clean up orphaned thumbnails',
    enabled: true,
    filter: {
      prefix: 'courts/',
      olderThanDays: 90,
    },
    actions: [
      { type: 'delete', afterDays: 90 },
    ],
  },
];

/**
 * Lifecycle execution result
 */
export interface LifecycleResult {
  ruleId: string;
  objectsProcessed: number;
  objectsDeleted: number;
  bytesFreed: number;
  errors: string[];
  duration: number;
}

/**
 * Execute lifecycle rules on a bucket
 */
export async function executeLifecycleRules(
  bucket: R2Bucket,
  rules: LifecycleRule[] = DEFAULT_LIFECYCLE_RULES
): Promise<LifecycleResult[]> {
  const results: LifecycleResult[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const startTime = Date.now();
    const result: LifecycleResult = {
      ruleId: rule.id,
      objectsProcessed: 0,
      objectsDeleted: 0,
      bytesFreed: 0,
      errors: [],
      duration: 0,
    };

    try {
      // List objects matching the filter
      const objects = await listMatchingObjects(bucket, rule.filter);
      result.objectsProcessed = objects.length;

      for (const obj of objects) {
        for (const action of rule.actions) {
          try {
            await executeAction(bucket, obj, action, rule.filter);
            if (action.type === 'delete') {
              result.objectsDeleted++;
              result.bytesFreed += obj.size;
            }
          } catch (error) {
            result.errors.push(`Failed to ${action.type} ${obj.key}: ${error}`);
          }
        }
      }
    } catch (error) {
      result.errors.push(`Rule execution failed: ${error}`);
    }

    result.duration = Date.now() - startTime;
    results.push(result);

    logger.info('Lifecycle rule executed', {
      ruleId: rule.id,
      processed: result.objectsProcessed,
      deleted: result.objectsDeleted,
      bytesFreed: result.bytesFreed,
      errors: result.errors.length,
    });
  }

  return results;
}

/**
 * List objects matching a filter
 */
async function listMatchingObjects(
  bucket: R2Bucket,
  filter: LifecycleFilter
): Promise<R2Object[]> {
  const matchingObjects: R2Object[] = [];
  let cursor: string | undefined;

  const now = Date.now();
  const maxAge = filter.olderThanDays
    ? filter.olderThanDays * 24 * 60 * 60 * 1000
    : undefined;

  do {
    const list = await bucket.list({
      prefix: filter.prefix,
      cursor,
      limit: 1000,
    });

    for (const obj of list.objects) {
      // Check age filter
      if (maxAge && now - obj.uploaded.getTime() < maxAge) {
        continue;
      }

      // Check size filter
      if (filter.sizeGreaterThan && obj.size <= filter.sizeGreaterThan) {
        continue;
      }

      // Check court filter via metadata
      if (filter.courtId) {
        const courtId = obj.customMetadata?.['x-court-id'];
        if (courtId !== filter.courtId) continue;
      }

      // Check document type filter
      if (filter.documentType) {
        const docType = obj.customMetadata?.['x-document-type'];
        if (docType !== filter.documentType) continue;
      }

      matchingObjects.push(obj);
    }

    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);

  return matchingObjects;
}

/**
 * Execute a lifecycle action on an object
 */
async function executeAction(
  bucket: R2Bucket,
  obj: R2Object,
  action: LifecycleAction,
  filter: LifecycleFilter
): Promise<void> {
  const now = Date.now();
  const objectAge = (now - obj.uploaded.getTime()) / (24 * 60 * 60 * 1000);

  // Check if action should be performed based on afterDays
  if (action.afterDays && objectAge < action.afterDays) {
    return;
  }

  switch (action.type) {
    case 'delete':
      await bucket.delete(obj.key);
      logger.debug('Object deleted by lifecycle', { key: obj.key });
      break;

    case 'archive':
      // R2 doesn't have storage classes yet, but prepare for future
      logger.debug('Archive action placeholder', { key: obj.key });
      break;

    case 'compress':
      // Would need to read, compress, and re-upload
      logger.debug('Compress action placeholder', { key: obj.key });
      break;

    case 'notify':
      // Would send notification about pending action
      logger.debug('Notify action placeholder', { key: obj.key });
      break;
  }
}

/**
 * Get storage statistics for lifecycle planning
 */
export interface StorageStats {
  totalObjects: number;
  totalBytes: number;
  byAge: Record<string, { count: number; bytes: number }>;
  byCourt: Record<string, { count: number; bytes: number }>;
  byType: Record<string, { count: number; bytes: number }>;
}

export async function getStorageStats(bucket: R2Bucket): Promise<StorageStats> {
  const stats: StorageStats = {
    totalObjects: 0,
    totalBytes: 0,
    byAge: {
      '0-30': { count: 0, bytes: 0 },
      '31-90': { count: 0, bytes: 0 },
      '91-180': { count: 0, bytes: 0 },
      '181-365': { count: 0, bytes: 0 },
      '365+': { count: 0, bytes: 0 },
    },
    byCourt: {},
    byType: {},
  };

  let cursor: string | undefined;
  const now = Date.now();

  do {
    const list = await bucket.list({ cursor, limit: 1000 });

    for (const obj of list.objects) {
      stats.totalObjects++;
      stats.totalBytes += obj.size;

      // Age bucket
      const ageDays = (now - obj.uploaded.getTime()) / (24 * 60 * 60 * 1000);
      const ageBucket = ageDays <= 30 ? '0-30'
        : ageDays <= 90 ? '31-90'
        : ageDays <= 180 ? '91-180'
        : ageDays <= 365 ? '181-365'
        : '365+';
      stats.byAge[ageBucket].count++;
      stats.byAge[ageBucket].bytes += obj.size;

      // Court bucket
      const courtId = obj.customMetadata?.['x-court-id'] || 'unknown';
      if (!stats.byCourt[courtId]) {
        stats.byCourt[courtId] = { count: 0, bytes: 0 };
      }
      stats.byCourt[courtId].count++;
      stats.byCourt[courtId].bytes += obj.size;

      // Type bucket
      const docType = obj.customMetadata?.['x-document-type'] || 'unknown';
      if (!stats.byType[docType]) {
        stats.byType[docType] = { count: 0, bytes: 0 };
      }
      stats.byType[docType].count++;
      stats.byType[docType].bytes += obj.size;
    }

    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);

  return stats;
}

/**
 * Estimate storage savings from applying rules
 */
export async function estimateSavings(
  bucket: R2Bucket,
  rules: LifecycleRule[] = DEFAULT_LIFECYCLE_RULES
): Promise<{
  totalObjects: number;
  objectsToDelete: number;
  bytesToFree: number;
  byRule: Record<string, { objects: number; bytes: number }>;
}> {
  const estimate = {
    totalObjects: 0,
    objectsToDelete: 0,
    bytesToFree: 0,
    byRule: {} as Record<string, { objects: number; bytes: number }>,
  };

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const objects = await listMatchingObjects(bucket, rule.filter);
    const bytes = objects.reduce((sum, obj) => sum + obj.size, 0);

    estimate.byRule[rule.id] = { objects: objects.length, bytes };
    estimate.objectsToDelete += objects.length;
    estimate.bytesToFree += bytes;
  }

  // Get total for context
  const stats = await getStorageStats(bucket);
  estimate.totalObjects = stats.totalObjects;

  return estimate;
}
