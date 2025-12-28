/**
 * Document Metadata
 * Metadata storage and retrieval for court documents
 */

import type { DocumentInfo } from '../types';

/**
 * Document metadata stored in R2
 */
export interface DocumentMetadata {
  // Core identification
  documentId: string;
  caseId: number;
  caseNumber: string;
  courtId: string;

  // Document details
  title: string;
  documentType: string;
  filedDate: Date;
  filedBy?: string;

  // Storage details
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  version: number;

  // Processing status
  ocrProcessed: boolean;
  ocrText?: string;
  thumbnailGenerated: boolean;

  // Audit trail
  uploadedAt: Date;
  uploadedBy?: string;
  sourceUrl?: string;
  checksum: string;

  // Custom metadata
  tags?: string[];
  notes?: string;
}

/**
 * Metadata for custom headers in R2
 */
export interface R2CustomMetadata {
  'x-document-id': string;
  'x-case-number': string;
  'x-court-id': string;
  'x-document-type': string;
  'x-filed-date': string;
  'x-version': string;
  'x-uploaded-at': string;
  'x-checksum': string;
  'x-ocr-processed': string;
}

/**
 * Convert document metadata to R2 custom metadata
 */
export function toR2Metadata(metadata: DocumentMetadata): R2CustomMetadata {
  return {
    'x-document-id': metadata.documentId,
    'x-case-number': metadata.caseNumber,
    'x-court-id': metadata.courtId,
    'x-document-type': metadata.documentType,
    'x-filed-date': metadata.filedDate.toISOString(),
    'x-version': metadata.version.toString(),
    'x-uploaded-at': metadata.uploadedAt.toISOString(),
    'x-checksum': metadata.checksum,
    'x-ocr-processed': metadata.ocrProcessed.toString(),
  };
}

/**
 * Convert R2 custom metadata back to document metadata (partial)
 */
export function fromR2Metadata(
  customMetadata: Record<string, string>
): Partial<DocumentMetadata> {
  return {
    documentId: customMetadata['x-document-id'],
    caseNumber: customMetadata['x-case-number'],
    courtId: customMetadata['x-court-id'],
    documentType: customMetadata['x-document-type'],
    filedDate: customMetadata['x-filed-date']
      ? new Date(customMetadata['x-filed-date'])
      : undefined,
    version: customMetadata['x-version']
      ? parseInt(customMetadata['x-version'], 10)
      : undefined,
    uploadedAt: customMetadata['x-uploaded-at']
      ? new Date(customMetadata['x-uploaded-at'])
      : undefined,
    checksum: customMetadata['x-checksum'],
    ocrProcessed: customMetadata['x-ocr-processed'] === 'true',
  };
}

/**
 * Create metadata from a DocumentInfo and upload details
 */
export function createDocumentMetadata(
  doc: DocumentInfo,
  uploadDetails: {
    caseId: number;
    courtId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    checksum: string;
    uploadedBy?: string;
    sourceUrl?: string;
  }
): DocumentMetadata {
  return {
    documentId: doc.id,
    caseId: uploadDetails.caseId,
    caseNumber: doc.caseNumber || '',
    courtId: uploadDetails.courtId,
    title: doc.title,
    documentType: doc.documentType,
    filedDate: doc.filedDate,
    filedBy: doc.filedBy,
    fileName: uploadDetails.fileName,
    mimeType: uploadDetails.mimeType,
    sizeBytes: uploadDetails.sizeBytes,
    version: 1,
    ocrProcessed: false,
    thumbnailGenerated: false,
    uploadedAt: new Date(),
    uploadedBy: uploadDetails.uploadedBy,
    sourceUrl: uploadDetails.sourceUrl,
    checksum: uploadDetails.checksum,
  };
}

/**
 * Validate document metadata
 */
export function validateMetadata(metadata: Partial<DocumentMetadata>): string[] {
  const errors: string[] = [];

  if (!metadata.documentId) {
    errors.push('documentId is required');
  }

  if (!metadata.caseNumber) {
    errors.push('caseNumber is required');
  }

  if (!metadata.courtId) {
    errors.push('courtId is required');
  }

  if (!metadata.fileName) {
    errors.push('fileName is required');
  }

  if (!metadata.mimeType) {
    errors.push('mimeType is required');
  }

  if (metadata.sizeBytes !== undefined && metadata.sizeBytes <= 0) {
    errors.push('sizeBytes must be positive');
  }

  return errors;
}

/**
 * Get MIME type from file extension
 */
export function getMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();

  const mimeTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'tif': 'image/tiff',
    'tiff': 'image/tiff',
    'txt': 'text/plain',
    'rtf': 'application/rtf',
    'html': 'text/html',
    'htm': 'text/html',
  };

  return mimeTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Check if document type is supported
 */
export function isSupportedDocumentType(mimeType: string): boolean {
  const supportedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/tiff',
    'text/plain',
    'text/html',
  ];

  return supportedTypes.includes(mimeType);
}
