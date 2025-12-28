/**
 * Document Versioning
 * Version management for court documents
 */

import { logger } from '../../lib/logger';
import type { DocumentMetadata } from './metadata';
import { extractVersion, getLatestVersionKey } from './keys';

/**
 * Version info for a document
 */
export interface DocumentVersion {
  version: number;
  key: string;
  uploadedAt: Date;
  sizeBytes: number;
  checksum: string;
  uploadedBy?: string;
  changeNote?: string;
}

/**
 * Version history for a document
 */
export interface VersionHistory {
  documentId: string;
  currentVersion: number;
  versions: DocumentVersion[];
  createdAt: Date;
  lastModifiedAt: Date;
}

/**
 * Get next version number for a document
 */
export function getNextVersion(existingKeys: string[]): number {
  if (existingKeys.length === 0) return 1;

  const latestKey = getLatestVersionKey(existingKeys);
  if (!latestKey) return 1;

  return extractVersion(latestKey) + 1;
}

/**
 * Build version history from R2 objects
 */
export function buildVersionHistory(
  documentId: string,
  objects: Array<{
    key: string;
    uploaded: Date;
    size: number;
    customMetadata?: Record<string, string>;
  }>
): VersionHistory {
  const versions: DocumentVersion[] = objects
    .map(obj => ({
      version: extractVersion(obj.key),
      key: obj.key,
      uploadedAt: obj.uploaded,
      sizeBytes: obj.size,
      checksum: obj.customMetadata?.['x-checksum'] || '',
      uploadedBy: obj.customMetadata?.['x-uploaded-by'],
      changeNote: obj.customMetadata?.['x-change-note'],
    }))
    .sort((a, b) => b.version - a.version);

  const currentVersion = versions.length > 0 ? versions[0].version : 0;
  const createdAt = versions.length > 0
    ? versions[versions.length - 1].uploadedAt
    : new Date();
  const lastModifiedAt = versions.length > 0
    ? versions[0].uploadedAt
    : new Date();

  return {
    documentId,
    currentVersion,
    versions,
    createdAt,
    lastModifiedAt,
  };
}

/**
 * Determine if a new version should be created
 */
export function shouldCreateNewVersion(
  existingChecksum: string | null,
  newChecksum: string
): boolean {
  // If no existing version, create first version
  if (!existingChecksum) return true;

  // If checksums differ, content changed
  return existingChecksum !== newChecksum;
}

/**
 * Calculate document checksum
 */
export async function calculateChecksum(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Version retention policy
 */
export interface RetentionPolicy {
  maxVersions: number;
  maxAgeMonths: number;
  keepFirst: boolean;  // Always keep the original version
  keepLast: boolean;   // Always keep the current version
}

/**
 * Default retention policy
 */
export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  maxVersions: 10,
  maxAgeMonths: 24,
  keepFirst: true,
  keepLast: true,
};

/**
 * Get versions to delete based on retention policy
 */
export function getVersionsToDelete(
  history: VersionHistory,
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICY
): DocumentVersion[] {
  const { versions } = history;
  const toDelete: DocumentVersion[] = [];

  if (versions.length <= 2) {
    // Never delete if only 1-2 versions exist
    return [];
  }

  const now = new Date();
  const maxAgeMs = policy.maxAgeMonths * 30 * 24 * 60 * 60 * 1000;

  versions.forEach((version, index) => {
    const isFirst = index === versions.length - 1;
    const isLast = index === 0;

    // Skip if we need to keep first/last
    if (policy.keepFirst && isFirst) return;
    if (policy.keepLast && isLast) return;

    // Check age
    const age = now.getTime() - version.uploadedAt.getTime();
    if (age > maxAgeMs) {
      toDelete.push(version);
      return;
    }

    // Check max versions (exclude first and last from count)
    const protectedCount = (policy.keepFirst ? 1 : 0) + (policy.keepLast ? 1 : 0);
    const maxDeletable = versions.length - policy.maxVersions - protectedCount;

    if (maxDeletable > 0 && !isFirst && !isLast) {
      // Delete oldest versions first (they come last in the sorted array)
      const deletableIndex = versions.length - 1 - (policy.keepFirst ? 1 : 0) - index;
      if (deletableIndex < maxDeletable) {
        toDelete.push(version);
      }
    }
  });

  logger.debug('Version cleanup analysis', {
    documentId: history.documentId,
    totalVersions: versions.length,
    toDeleteCount: toDelete.length,
  });

  return toDelete;
}

/**
 * Compare two versions
 */
export interface VersionDiff {
  sizeChange: number;
  sizeChangePercent: number;
  daysBetween: number;
}

export function compareVersions(
  older: DocumentVersion,
  newer: DocumentVersion
): VersionDiff {
  const sizeChange = newer.sizeBytes - older.sizeBytes;
  const sizeChangePercent = older.sizeBytes > 0
    ? (sizeChange / older.sizeBytes) * 100
    : 100;
  const daysBetween = Math.floor(
    (newer.uploadedAt.getTime() - older.uploadedAt.getTime()) / (24 * 60 * 60 * 1000)
  );

  return {
    sizeChange,
    sizeChangePercent,
    daysBetween,
  };
}
