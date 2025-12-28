/**
 * Court Document Storage
 * Exports for document storage infrastructure
 */

// Main storage service
export {
  DocumentStorage,
  createDocumentStorage,
  type UploadOptions,
  type DownloadOptions,
  type UploadResult,
  type DownloadResult,
  type DocumentListItem,
} from './DocumentStorage';

// Key management
export {
  generateDocumentKey,
  parseDocumentKey,
  getCaseDocumentsPrefix,
  getCourtDocumentsPrefix,
  generateThumbnailKey,
  generateOcrKey,
  generateMetadataKey,
  generateDocumentId,
  extractVersion,
  getLatestVersionKey,
  type DocumentKeyParts,
} from './keys';

// Metadata
export {
  type DocumentMetadata,
  type R2CustomMetadata,
  toR2Metadata,
  fromR2Metadata,
  createDocumentMetadata,
  validateMetadata,
  getMimeType,
  isSupportedDocumentType,
} from './metadata';

// Versioning
export {
  getNextVersion,
  buildVersionHistory,
  calculateChecksum,
  shouldCreateNewVersion,
  getVersionsToDelete,
  compareVersions,
  DEFAULT_RETENTION_POLICY,
  type DocumentVersion,
  type VersionHistory,
  type RetentionPolicy,
  type VersionDiff,
} from './versioning';

// Compression
export {
  compress,
  decompress,
  isGzipCompressed,
  shouldCompress,
  estimateCompressionRatio,
  type CompressionOptions,
  type CompressionResult,
} from './compression';

// OCR
export {
  supportsOcr,
  extractPdfText,
  extractImageText,
  processDocumentOcr,
  cleanOcrText,
  extractTextSections,
  isOcrQualityAcceptable,
  type OcrResult,
  type OcrOptions,
  type TextSection,
} from './ocr';

// Presigned URLs
export {
  generateDownloadUrl,
  generateUploadUrl,
  verifyToken,
  generateContentDisposition,
  parseContentDisposition,
  type PresignOptions,
  type PresignedUrl,
} from './presign';

// Lifecycle management
export {
  executeLifecycleRules,
  getStorageStats,
  estimateSavings,
  DEFAULT_LIFECYCLE_RULES,
  type LifecycleRule,
  type LifecycleFilter,
  type LifecycleAction,
  type LifecycleResult,
  type StorageStats,
} from './lifecycle';

// Usage tracking
export {
  UsageTracker,
  createUsageTracker,
  formatBytes,
  parseBytes,
  USAGE_TIERS,
  type UsageRecord,
  type UsageTier,
  type UsageCheckResult,
} from './usage';
