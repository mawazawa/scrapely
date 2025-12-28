/**
 * Change Detector
 * Detects and categorizes changes between case snapshots
 */

import { logger } from '../../lib/logger';
import type { CaseInfo, RulingInfo, DocumentInfo, HearingInfo } from '../types';

/**
 * Change types
 */
export type ChangeType =
  | 'new_ruling'
  | 'ruling_modified'
  | 'new_filing'
  | 'new_document'
  | 'status_change'
  | 'hearing_scheduled'
  | 'hearing_rescheduled'
  | 'hearing_cancelled'
  | 'party_added'
  | 'party_removed'
  | 'attorney_changed'
  | 'judge_changed'
  | 'department_changed'
  | 'disposition';

/**
 * Detected change
 */
export interface DetectedChange {
  type: ChangeType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  before?: unknown;
  after?: unknown;
  timestamp: Date;
}

/**
 * Snapshot for comparison
 */
export interface CaseSnapshot {
  caseInfo: CaseInfo;
  rulings: RulingInfo[];
  documents: DocumentInfo[];
  hearings: HearingInfo[];
  hash: string;
  createdAt: Date;
}

/**
 * Generate hash for snapshot
 */
export function generateSnapshotHash(snapshot: Omit<CaseSnapshot, 'hash' | 'createdAt'>): string {
  const data = JSON.stringify({
    status: snapshot.caseInfo.status,
    judge: snapshot.caseInfo.judge,
    department: snapshot.caseInfo.department,
    parties: snapshot.caseInfo.parties.map(p => p.name).sort(),
    rulingCount: snapshot.rulings.length,
    documentCount: snapshot.documents.length,
    hearingCount: snapshot.hearings.length,
    nextHearing: snapshot.caseInfo.nextHearing?.date?.toISOString(),
  });

  // Simple hash function (in production, use crypto)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * Create snapshot from current data
 */
export function createSnapshot(
  caseInfo: CaseInfo,
  rulings: RulingInfo[] = [],
  documents: DocumentInfo[] = [],
  hearings: HearingInfo[] = []
): CaseSnapshot {
  const base = { caseInfo, rulings, documents, hearings };
  return {
    ...base,
    hash: generateSnapshotHash(base),
    createdAt: new Date(),
  };
}

/**
 * Detect changes between two snapshots
 */
export function detectChanges(
  oldSnapshot: CaseSnapshot | null,
  newSnapshot: CaseSnapshot
): DetectedChange[] {
  const changes: DetectedChange[] = [];

  // If no old snapshot, this is the initial scrape
  if (!oldSnapshot) {
    return changes;
  }

  // Quick check: if hashes match, no changes
  if (oldSnapshot.hash === newSnapshot.hash) {
    return changes;
  }

  const oldCase = oldSnapshot.caseInfo;
  const newCase = newSnapshot.caseInfo;

  // Status change
  if (oldCase.status !== newCase.status) {
    changes.push({
      type: 'status_change',
      severity: newCase.status === 'disposed' ? 'critical' : 'high',
      title: 'Case Status Changed',
      description: `Status changed from "${oldCase.status}" to "${newCase.status}"`,
      before: oldCase.status,
      after: newCase.status,
      timestamp: new Date(),
    });
  }

  // Judge change
  if (oldCase.judge !== newCase.judge) {
    changes.push({
      type: 'judge_changed',
      severity: 'medium',
      title: 'Judge Changed',
      description: `Judge changed from ${oldCase.judge || 'Unknown'} to ${newCase.judge || 'Unknown'}`,
      before: oldCase.judge,
      after: newCase.judge,
      timestamp: new Date(),
    });
  }

  // Department change
  if (oldCase.department !== newCase.department) {
    changes.push({
      type: 'department_changed',
      severity: 'medium',
      title: 'Department Changed',
      description: `Department changed from ${oldCase.department || 'Unknown'} to ${newCase.department || 'Unknown'}`,
      before: oldCase.department,
      after: newCase.department,
      timestamp: new Date(),
    });
  }

  // Hearing changes
  const hearingChanges = detectHearingChanges(oldCase.nextHearing, newCase.nextHearing);
  changes.push(...hearingChanges);

  // Party changes
  const partyChanges = detectPartyChanges(oldCase.parties, newCase.parties);
  changes.push(...partyChanges);

  // New rulings
  const newRulings = detectNewRulings(oldSnapshot.rulings, newSnapshot.rulings);
  changes.push(...newRulings);

  // New documents
  const newDocs = detectNewDocuments(oldSnapshot.documents, newSnapshot.documents);
  changes.push(...newDocs);

  logger.debug('Changes detected', {
    caseNumber: newCase.caseNumber.full,
    changeCount: changes.length,
    types: changes.map(c => c.type),
  });

  return changes;
}

/**
 * Detect hearing changes
 */
function detectHearingChanges(
  oldHearing: HearingInfo | undefined,
  newHearing: HearingInfo | undefined
): DetectedChange[] {
  const changes: DetectedChange[] = [];

  if (!oldHearing && newHearing) {
    changes.push({
      type: 'hearing_scheduled',
      severity: 'high',
      title: 'Hearing Scheduled',
      description: `New hearing scheduled for ${newHearing.date.toLocaleDateString()} at ${newHearing.time}`,
      after: newHearing,
      timestamp: new Date(),
    });
  } else if (oldHearing && !newHearing) {
    changes.push({
      type: 'hearing_cancelled',
      severity: 'high',
      title: 'Hearing Cancelled',
      description: `Hearing on ${oldHearing.date.toLocaleDateString()} was cancelled`,
      before: oldHearing,
      timestamp: new Date(),
    });
  } else if (oldHearing && newHearing) {
    const oldDate = oldHearing.date.getTime();
    const newDate = newHearing.date.getTime();

    if (oldDate !== newDate || oldHearing.department !== newHearing.department) {
      changes.push({
        type: 'hearing_rescheduled',
        severity: 'high',
        title: 'Hearing Rescheduled',
        description: `Hearing moved from ${oldHearing.date.toLocaleDateString()} to ${newHearing.date.toLocaleDateString()}`,
        before: oldHearing,
        after: newHearing,
        timestamp: new Date(),
      });
    }
  }

  return changes;
}

/**
 * Detect party changes
 */
function detectPartyChanges(
  oldParties: CaseInfo['parties'],
  newParties: CaseInfo['parties']
): DetectedChange[] {
  const changes: DetectedChange[] = [];

  const oldNames = new Set(oldParties.map(p => p.name.toLowerCase()));
  const newNames = new Set(newParties.map(p => p.name.toLowerCase()));

  // Added parties
  for (const party of newParties) {
    if (!oldNames.has(party.name.toLowerCase())) {
      changes.push({
        type: 'party_added',
        severity: 'medium',
        title: 'Party Added',
        description: `New ${party.type} added: ${party.name}`,
        after: party,
        timestamp: new Date(),
      });
    }
  }

  // Removed parties
  for (const party of oldParties) {
    if (!newNames.has(party.name.toLowerCase())) {
      changes.push({
        type: 'party_removed',
        severity: 'medium',
        title: 'Party Removed',
        description: `${party.type} removed: ${party.name}`,
        before: party,
        timestamp: new Date(),
      });
    }
  }

  return changes;
}

/**
 * Detect new rulings
 */
function detectNewRulings(
  oldRulings: RulingInfo[],
  newRulings: RulingInfo[]
): DetectedChange[] {
  const changes: DetectedChange[] = [];

  const oldIds = new Set(oldRulings.map(r => r.id));

  for (const ruling of newRulings) {
    if (!oldIds.has(ruling.id)) {
      changes.push({
        type: 'new_ruling',
        severity: 'critical',
        title: `New ${ruling.rulingType === 'tentative' ? 'Tentative ' : ''}Ruling`,
        description: `${ruling.motionType}: ${ruling.outcome}`,
        after: ruling,
        timestamp: new Date(),
      });
    }
  }

  return changes;
}

/**
 * Detect new documents
 */
function detectNewDocuments(
  oldDocs: DocumentInfo[],
  newDocs: DocumentInfo[]
): DetectedChange[] {
  const changes: DetectedChange[] = [];

  const oldIds = new Set(oldDocs.map(d => d.id));

  for (const doc of newDocs) {
    if (!oldIds.has(doc.id)) {
      changes.push({
        type: 'new_filing',
        severity: 'medium',
        title: 'New Filing',
        description: `${doc.documentType}: ${doc.title}`,
        after: doc,
        timestamp: new Date(),
      });
    }
  }

  return changes;
}

/**
 * Get severity emoji
 */
export function getSeverityEmoji(severity: DetectedChange['severity']): string {
  switch (severity) {
    case 'critical': return '🚨';
    case 'high': return '⚠️';
    case 'medium': return 'ℹ️';
    case 'low': return '📝';
  }
}

/**
 * Format change for notification
 */
export function formatChangeForNotification(change: DetectedChange): string {
  const emoji = getSeverityEmoji(change.severity);
  return `${emoji} ${change.title}\n${change.description}`;
}

/**
 * Sort changes by severity
 */
export function sortChangesBySeverity(changes: DetectedChange[]): DetectedChange[] {
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...changes].sort((a, b) => order[a.severity] - order[b.severity]);
}
