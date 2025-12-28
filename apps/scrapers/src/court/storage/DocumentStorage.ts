/**
 * Court Document Storage
 * Main storage service for court documents using Cloudflare R2
 */

import { logger } from '../../lib/logger';
import type { DocumentInfo } from '../types';
import {
  generateDocumentKey,
  parseDocumentKey,
  getCaseDocumentsPrefix,
  generateThumbnailKey,
  generateOcrKey,
  generateMetadataKey,
  generateDocumentId,
  getLatestVersionKey,
  type DocumentKeyParts,
} from './keys';
import {
  type DocumentMetadata,
  createDocumentMetadata,
  toR2Metadata,
  fromR2Metadata,
  getMimeType,
  isSupportedDocumentType,
} from './metadata';
import {
  getNextVersion,
  buildVersionHistory,
  calculateChecksum,
  shouldCreateNewVersion,
  type VersionHistory,
} from './versioning';
import { compress, decompress, isGzipCompressed, shouldCompress } from './compression';
import { processDocumentOcr, supportsOcr, cleanOcrText } from './ocr';
import {
  generateDownloadUrl,
  generateUploadUrl,
  verifyToken,
  generateContentDisposition,
  type PresignedUrl,
  type PresignOptions,
} from './presign';
import { UsageTracker } from './usage';

/**
 * Document upload options
 */
export interface UploadOptions {
  caseId: number;
  courtId: string;
  uploadedBy?: string;
  sourceUrl?: string;
  compress?: boolean;
  processOcr?: boolean;
  generateThumbnail?: boolean;
}

/**
 * Document download options
 */
export interface DownloadOptions {
  version?: number;
  decompress?: boolean;
}

/**
 * Upload result
 */
export interface UploadResult {
  success: boolean;
  documentId: string;
  key: string;
  version: number;
  sizeBytes: number;
  checksum: string;
  compressed: boolean;
  ocrProcessed: boolean;
  error?: string;
}

/**
 * Download result
 */
export interface DownloadResult {
  success: boolean;
  data?: ArrayBuffer;
  metadata?: Partial<DocumentMetadata>;
  mimeType: string;
  fileName: string;
  error?: string;
}

/**
 * Document listing item
 */
export interface DocumentListItem {
  documentId: string;
  key: string;
  title: string;
  documentType: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  uploadedAt: Date;
  ocrProcessed: boolean;
}

/**
 * Document Storage Service
 */
export class DocumentStorage {
  private bucket: R2Bucket;
  private kv: KVNamespace;
  private secretKey: string;
  private usageTracker: UsageTracker;

  constructor(bucket: R2Bucket, kv: KVNamespace, secretKey: string) {
    this.bucket = bucket;
    this.kv = kv;
    this.secretKey = secretKey;
    this.usageTracker = new UsageTracker(kv);
  }

  /**
   * Upload a document
   */
  async uploadDocument(
    doc: DocumentInfo,
    data: ArrayBuffer,
    options: UploadOptions
  ): Promise<UploadResult> {
    const startTime = Date.now();

    try {
      // Validate document type
      const mimeType = getMimeType(doc.title || 'document');
      if (!isSupportedDocumentType(mimeType)) {
        return {
          success: false,
          documentId: doc.id,
          key: '',
          version: 0,
          sizeBytes: 0,
          checksum: '',
          compressed: false,
          ocrProcessed: false,
          error: `Unsupported document type: ${mimeType}`,
        };
      }

      // Calculate checksum
      const checksum = await calculateChecksum(data);

      // Check for existing versions
      const keyParts: DocumentKeyParts = {
        courtId: options.courtId,
        caseNumber: doc.caseNumber || `case-${options.caseId}`,
        documentId: doc.id || generateDocumentId(),
      };

      const existingKeys = await this.listDocumentVersionKeys(keyParts);
      const shouldCreate = existingKeys.length === 0
        || shouldCreateNewVersion(
            await this.getLatestChecksum(existingKeys),
            checksum
          );

      if (!shouldCreate) {
        const latestKey = getLatestVersionKey(existingKeys)!;
        const parsed = parseDocumentKey(latestKey);
        return {
          success: true,
          documentId: keyParts.documentId,
          key: latestKey,
          version: parsed?.version || 1,
          sizeBytes: data.byteLength,
          checksum,
          compressed: false,
          ocrProcessed: false,
        };
      }

      // Get next version
      const version = getNextVersion(existingKeys);
      keyParts.version = version;
      const key = generateDocumentKey(keyParts);

      // Compress if beneficial
      let uploadData: Uint8Array = new Uint8Array(data);
      let compressed = false;

      if (options.compress !== false && shouldCompress(mimeType)) {
        const compressionResult = await compress(data);
        if (compressionResult.compressed) {
          uploadData = compressionResult.data;
          compressed = true;
        }
      }

      // Create metadata
      const metadata = createDocumentMetadata(doc, {
        caseId: options.caseId,
        courtId: options.courtId,
        fileName: doc.title || 'document',
        mimeType,
        sizeBytes: data.byteLength,
        checksum,
        uploadedBy: options.uploadedBy,
        sourceUrl: options.sourceUrl,
      });
      metadata.version = version;

      // Upload to R2
      await this.bucket.put(key, uploadData, {
        httpMetadata: {
          contentType: compressed ? 'application/gzip' : mimeType,
          contentEncoding: compressed ? 'gzip' : undefined,
        },
        customMetadata: {
          ...toR2Metadata(metadata),
          'x-compressed': compressed.toString(),
          'x-original-size': data.byteLength.toString(),
        },
      });

      // Process OCR if requested
      let ocrProcessed = false;
      if (options.processOcr && supportsOcr(mimeType)) {
        try {
          const ocrResult = await processDocumentOcr(data, mimeType);
          if (ocrResult.success && ocrResult.text) {
            const ocrKey = generateOcrKey(keyParts);
            await this.bucket.put(ocrKey, cleanOcrText(ocrResult.text), {
              httpMetadata: { contentType: 'text/plain' },
              customMetadata: {
                'x-document-id': keyParts.documentId,
                'x-processing-time': ocrResult.processingTime.toString(),
              },
            });
            ocrProcessed = true;
          }
        } catch (error) {
          logger.warn('OCR processing failed', { key, error: String(error) });
        }
      }

      // Store full metadata as JSON
      const metaKey = generateMetadataKey(keyParts);
      await this.bucket.put(metaKey, JSON.stringify(metadata), {
        httpMetadata: { contentType: 'application/json' },
      });

      logger.info('Document uploaded', {
        documentId: keyParts.documentId,
        key,
        version,
        size: data.byteLength,
        compressed,
        ocrProcessed,
        duration: Date.now() - startTime,
      });

      return {
        success: true,
        documentId: keyParts.documentId,
        key,
        version,
        sizeBytes: data.byteLength,
        checksum,
        compressed,
        ocrProcessed,
      };
    } catch (error) {
      logger.error('Document upload failed', { error: String(error) });
      return {
        success: false,
        documentId: doc.id,
        key: '',
        version: 0,
        sizeBytes: 0,
        checksum: '',
        compressed: false,
        ocrProcessed: false,
        error: String(error),
      };
    }
  }

  /**
   * Download a document
   */
  async downloadDocument(
    keyParts: DocumentKeyParts,
    options: DownloadOptions = {}
  ): Promise<DownloadResult> {
    try {
      // Get the key (specific version or latest)
      let key: string;

      if (options.version) {
        keyParts.version = options.version;
        key = generateDocumentKey(keyParts);
      } else {
        const keys = await this.listDocumentVersionKeys(keyParts);
        const latestKey = getLatestVersionKey(keys);
        if (!latestKey) {
          return {
            success: false,
            mimeType: '',
            fileName: '',
            error: 'Document not found',
          };
        }
        key = latestKey;
      }

      // Get from R2
      const object = await this.bucket.get(key);
      if (!object) {
        return {
          success: false,
          mimeType: '',
          fileName: '',
          error: 'Document not found',
        };
      }

      // Get metadata
      const metadata = fromR2Metadata(object.customMetadata || {});
      const isCompressed = object.customMetadata?.['x-compressed'] === 'true';

      // Get data
      let data = await object.arrayBuffer();

      // Decompress if needed
      if (isCompressed && options.decompress !== false) {
        const decompressed = await decompress(data);
        data = decompressed.buffer;
      }

      // Determine mime type
      const mimeType = isCompressed && options.decompress !== false
        ? metadata.documentType || 'application/octet-stream'
        : object.httpMetadata?.contentType || 'application/octet-stream';

      // Get filename
      const fileName = metadata.caseNumber
        ? `${metadata.caseNumber}-${keyParts.documentId}`
        : keyParts.documentId;

      return {
        success: true,
        data,
        metadata,
        mimeType,
        fileName,
      };
    } catch (error) {
      logger.error('Document download failed', { error: String(error) });
      return {
        success: false,
        mimeType: '',
        fileName: '',
        error: String(error),
      };
    }
  }

  /**
   * List documents for a case
   */
  async listDocuments(
    courtId: string,
    caseNumber: string
  ): Promise<DocumentListItem[]> {
    const prefix = getCaseDocumentsPrefix(courtId, caseNumber);
    const items: DocumentListItem[] = [];
    let cursor: string | undefined;

    do {
      const list = await this.bucket.list({ prefix, cursor, limit: 100 });

      for (const obj of list.objects) {
        // Skip OCR, thumbnail, and metadata files
        if (obj.key.endsWith('-ocr.txt') ||
            obj.key.endsWith('-thumb.jpg') ||
            obj.key.endsWith('-meta.json')) {
          continue;
        }

        const parsed = parseDocumentKey(obj.key);
        if (!parsed) continue;

        const metadata = fromR2Metadata(obj.customMetadata || {});

        items.push({
          documentId: parsed.documentId,
          key: obj.key,
          title: metadata.documentType || parsed.documentId,
          documentType: metadata.documentType || 'unknown',
          mimeType: obj.httpMetadata?.contentType || 'application/octet-stream',
          sizeBytes: obj.size,
          version: parsed.version || 1,
          uploadedAt: obj.uploaded,
          ocrProcessed: metadata.ocrProcessed || false,
        });
      }

      cursor = list.truncated ? list.cursor : undefined;
    } while (cursor);

    // Sort by upload date, newest first
    return items.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }

  /**
   * Get version history for a document
   */
  async getVersionHistory(keyParts: DocumentKeyParts): Promise<VersionHistory> {
    const keys = await this.listDocumentVersionKeys(keyParts);
    const objects: Array<{
      key: string;
      uploaded: Date;
      size: number;
      customMetadata?: Record<string, string>;
    }> = [];

    for (const key of keys) {
      const obj = await this.bucket.head(key);
      if (obj) {
        objects.push({
          key,
          uploaded: obj.uploaded,
          size: obj.size,
          customMetadata: obj.customMetadata,
        });
      }
    }

    return buildVersionHistory(keyParts.documentId, objects);
  }

  /**
   * Delete a document (all versions)
   */
  async deleteDocument(keyParts: DocumentKeyParts): Promise<boolean> {
    try {
      const keys = await this.listDocumentVersionKeys(keyParts);

      // Also delete associated files
      const allKeys: string[] = [];
      for (const key of keys) {
        allKeys.push(key);
        // Add OCR and metadata keys
        const parsed = parseDocumentKey(key);
        if (parsed) {
          allKeys.push(generateOcrKey(parsed));
          allKeys.push(generateMetadataKey(parsed));
          allKeys.push(generateThumbnailKey(parsed));
        }
      }

      // Delete all keys
      for (const key of allKeys) {
        try {
          await this.bucket.delete(key);
        } catch {
          // Ignore errors for non-existent files
        }
      }

      logger.info('Document deleted', {
        documentId: keyParts.documentId,
        versionsDeleted: keys.length,
      });

      return true;
    } catch (error) {
      logger.error('Document deletion failed', { error: String(error) });
      return false;
    }
  }

  /**
   * Generate a presigned download URL
   */
  async getDownloadUrl(
    keyParts: DocumentKeyParts,
    options?: PresignOptions
  ): Promise<PresignedUrl | null> {
    const keys = await this.listDocumentVersionKeys(keyParts);
    const latestKey = getLatestVersionKey(keys);

    if (!latestKey) return null;

    return generateDownloadUrl(this.bucket, latestKey, this.secretKey, options);
  }

  /**
   * Get OCR text for a document
   */
  async getOcrText(keyParts: DocumentKeyParts): Promise<string | null> {
    const ocrKey = generateOcrKey(keyParts);
    const object = await this.bucket.get(ocrKey);

    if (!object) return null;

    return object.text();
  }

  /**
   * Private: List all version keys for a document
   */
  private async listDocumentVersionKeys(keyParts: DocumentKeyParts): Promise<string[]> {
    const prefix = `courts/${keyParts.courtId}/cases/${keyParts.caseNumber}/docs/${keyParts.documentId}/`;
    const keys: string[] = [];
    let cursor: string | undefined;

    do {
      const list = await this.bucket.list({ prefix, cursor });

      for (const obj of list.objects) {
        // Only include version files, not OCR/metadata/thumbnails
        if (/\/v\d+$/.test(obj.key)) {
          keys.push(obj.key);
        }
      }

      cursor = list.truncated ? list.cursor : undefined;
    } while (cursor);

    return keys;
  }

  /**
   * Private: Get checksum from latest version
   */
  private async getLatestChecksum(keys: string[]): Promise<string | null> {
    const latestKey = getLatestVersionKey(keys);
    if (!latestKey) return null;

    const obj = await this.bucket.head(latestKey);
    return obj?.customMetadata?.['x-checksum'] || null;
  }
}

/**
 * Create document storage instance
 */
export function createDocumentStorage(
  bucket: R2Bucket,
  kv: KVNamespace,
  secretKey: string
): DocumentStorage {
  return new DocumentStorage(bucket, kv, secretKey);
}
