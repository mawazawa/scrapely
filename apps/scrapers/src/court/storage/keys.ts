/**
 * Storage Key Generation
 * Consistent key format for court documents in R2
 */

/**
 * Document key components
 */
export interface DocumentKeyParts {
  courtId: string;
  caseNumber: string;
  documentId: string;
  version?: number;
}

/**
 * Generate a storage key for a court document
 * Format: courts/{courtId}/cases/{caseNumber}/docs/{documentId}/{version}
 */
export function generateDocumentKey(parts: DocumentKeyParts): string {
  const { courtId, caseNumber, documentId, version = 1 } = parts;

  // Sanitize components
  const safeCourt = sanitizeKeyPart(courtId);
  const safeCase = sanitizeKeyPart(caseNumber);
  const safeDoc = sanitizeKeyPart(documentId);

  return `courts/${safeCourt}/cases/${safeCase}/docs/${safeDoc}/v${version}`;
}

/**
 * Parse a storage key back to its components
 */
export function parseDocumentKey(key: string): DocumentKeyParts | null {
  const regex = /^courts\/([^/]+)\/cases\/([^/]+)\/docs\/([^/]+)\/v(\d+)$/;
  const match = key.match(regex);

  if (!match) return null;

  return {
    courtId: match[1],
    caseNumber: match[2],
    documentId: match[3],
    version: parseInt(match[4], 10),
  };
}

/**
 * Generate prefix for listing documents by case
 */
export function getCaseDocumentsPrefix(courtId: string, caseNumber: string): string {
  return `courts/${sanitizeKeyPart(courtId)}/cases/${sanitizeKeyPart(caseNumber)}/docs/`;
}

/**
 * Generate prefix for listing all documents in a court
 */
export function getCourtDocumentsPrefix(courtId: string): string {
  return `courts/${sanitizeKeyPart(courtId)}/`;
}

/**
 * Generate a thumbnail key for a document
 */
export function generateThumbnailKey(parts: DocumentKeyParts): string {
  const baseKey = generateDocumentKey(parts);
  return `${baseKey}-thumb.jpg`;
}

/**
 * Generate an OCR text key for a document
 */
export function generateOcrKey(parts: DocumentKeyParts): string {
  const baseKey = generateDocumentKey(parts);
  return `${baseKey}-ocr.txt`;
}

/**
 * Generate a metadata key for a document
 */
export function generateMetadataKey(parts: DocumentKeyParts): string {
  const baseKey = generateDocumentKey(parts);
  return `${baseKey}-meta.json`;
}

/**
 * Sanitize a key part to ensure it's valid for R2
 */
function sanitizeKeyPart(part: string): string {
  return part
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Extract version number from a key
 */
export function extractVersion(key: string): number {
  const match = key.match(/v(\d+)(?:-|$)/);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * Get the latest version key from a list of keys
 */
export function getLatestVersionKey(keys: string[]): string | null {
  if (keys.length === 0) return null;

  return keys.reduce((latest, current) => {
    const latestVersion = extractVersion(latest);
    const currentVersion = extractVersion(current);
    return currentVersion > latestVersion ? current : latest;
  });
}

/**
 * Generate a unique document ID
 */
export function generateDocumentId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `doc-${timestamp}-${random}`;
}
