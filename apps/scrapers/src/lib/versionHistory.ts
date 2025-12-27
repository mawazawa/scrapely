/**
 * Brief Version History
 * Tracks changes to reports over time
 */

import { z } from 'zod';
import { logger } from './logger';

/**
 * Version schema
 */
export const VersionSchema = z.object({
  id: z.string(),
  reportId: z.number(),
  version: z.number(),
  title: z.string(),
  content: z.string(),
  author: z.string().optional(),
  reason: z.string().optional(),
  diff: z.object({
    additions: z.number(),
    deletions: z.number(),
    changes: z.array(z.object({
      type: z.enum(['add', 'delete', 'modify']),
      line: z.number(),
      content: z.string(),
    })),
  }).optional(),
  createdAt: z.number(),
});

export type Version = z.infer<typeof VersionSchema>;

/**
 * Calculate diff between two texts
 */
export function calculateDiff(
  oldText: string,
  newText: string
): Version['diff'] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const changes: Version['diff']['changes'] = [];
  let additions = 0;
  let deletions = 0;

  // Simple line-by-line diff (for production, use a proper diff algorithm)
  const maxLength = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLength; i++) {
    const oldLine = oldLines[i] || '';
    const newLine = newLines[i] || '';

    if (oldLine !== newLine) {
      if (!oldLine) {
        changes.push({ type: 'add', line: i + 1, content: newLine });
        additions++;
      } else if (!newLine) {
        changes.push({ type: 'delete', line: i + 1, content: oldLine });
        deletions++;
      } else {
        changes.push({ type: 'modify', line: i + 1, content: newLine });
        additions++;
        deletions++;
      }
    }
  }

  return { additions, deletions, changes: changes.slice(0, 100) }; // Limit changes
}

/**
 * Create a new version
 */
export function createVersion(
  reportId: number,
  versionNumber: number,
  title: string,
  content: string,
  previousContent?: string,
  author?: string,
  reason?: string
): Version {
  return {
    id: crypto.randomUUID(),
    reportId,
    version: versionNumber,
    title,
    content,
    author,
    reason,
    diff: previousContent ? calculateDiff(previousContent, content) : undefined,
    createdAt: Date.now(),
  };
}

/**
 * Store version in KV
 */
export async function storeVersion(
  kv: KVNamespace | undefined,
  version: Version
): Promise<boolean> {
  if (!kv) {
    logger.warn('No KV namespace for version storage');
    return false;
  }

  try {
    // Store version
    const versionKey = `version:${version.reportId}:${version.version}`;
    await kv.put(versionKey, JSON.stringify(version), {
      expirationTtl: 365 * 24 * 60 * 60, // 1 year
    });

    // Update version list
    const listKey = `versions:${version.reportId}`;
    const list = await kv.get<number[]>(listKey, 'json') || [];
    list.push(version.version);
    await kv.put(listKey, JSON.stringify(list));

    // Update latest version pointer
    await kv.put(`version:${version.reportId}:latest`, String(version.version));

    logger.info('Version stored', {
      reportId: version.reportId,
      version: version.version,
    });

    return true;
  } catch (error) {
    logger.error('Failed to store version', { error: String(error) });
    return false;
  }
}

/**
 * Get version from KV
 */
export async function getVersion(
  kv: KVNamespace | undefined,
  reportId: number,
  versionNumber: number
): Promise<Version | null> {
  if (!kv) return null;

  try {
    const key = `version:${reportId}:${versionNumber}`;
    return await kv.get<Version>(key, 'json');
  } catch {
    return null;
  }
}

/**
 * Get latest version number
 */
export async function getLatestVersionNumber(
  kv: KVNamespace | undefined,
  reportId: number
): Promise<number> {
  if (!kv) return 0;

  try {
    const latest = await kv.get(`version:${reportId}:latest`);
    return latest ? parseInt(latest, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Get all versions for a report
 */
export async function getVersionHistory(
  kv: KVNamespace | undefined,
  reportId: number
): Promise<Version[]> {
  if (!kv) return [];

  try {
    const listKey = `versions:${reportId}`;
    const versionNumbers = await kv.get<number[]>(listKey, 'json') || [];

    const versions: Version[] = [];
    for (const num of versionNumbers.sort((a, b) => b - a)) {
      const version = await getVersion(kv, reportId, num);
      if (version) versions.push(version);
    }

    return versions;
  } catch {
    return [];
  }
}

/**
 * Compare two versions
 */
export async function compareVersions(
  kv: KVNamespace | undefined,
  reportId: number,
  version1: number,
  version2: number
): Promise<Version['diff'] | null> {
  const v1 = await getVersion(kv, reportId, version1);
  const v2 = await getVersion(kv, reportId, version2);

  if (!v1 || !v2) return null;

  return calculateDiff(v1.content, v2.content);
}

/**
 * Restore a previous version
 */
export async function restoreVersion(
  kv: KVNamespace | undefined,
  reportId: number,
  versionNumber: number,
  restoredBy: string
): Promise<Version | null> {
  const oldVersion = await getVersion(kv, reportId, versionNumber);
  if (!oldVersion) return null;

  const latestNumber = await getLatestVersionNumber(kv, reportId);
  const latestVersion = await getVersion(kv, reportId, latestNumber);

  const newVersion = createVersion(
    reportId,
    latestNumber + 1,
    oldVersion.title,
    oldVersion.content,
    latestVersion?.content,
    restoredBy,
    `Restored from version ${versionNumber}`
  );

  await storeVersion(kv, newVersion);
  return newVersion;
}

/**
 * Get version summary (without full content)
 */
export interface VersionSummary {
  version: number;
  author?: string;
  reason?: string;
  additions?: number;
  deletions?: number;
  createdAt: number;
}

export async function getVersionSummaries(
  kv: KVNamespace | undefined,
  reportId: number
): Promise<VersionSummary[]> {
  const versions = await getVersionHistory(kv, reportId);

  return versions.map(v => ({
    version: v.version,
    author: v.author,
    reason: v.reason,
    additions: v.diff?.additions,
    deletions: v.diff?.deletions,
    createdAt: v.createdAt,
  }));
}
