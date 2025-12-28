/**
 * Case Tracking Module
 * Exports for case tracking and monitoring
 */

export {
  TrackingService,
  createTrackingService,
  type CaseUpdate,
  type TrackingJobResult,
  type TrackingServiceConfig,
} from './TrackingService';

export {
  type ChangeType,
  type DetectedChange,
  type CaseSnapshot,
  generateSnapshotHash,
  createSnapshot,
  detectChanges,
  getSeverityEmoji,
  formatChangeForNotification,
  sortChangesBySeverity,
} from './changeDetector';
