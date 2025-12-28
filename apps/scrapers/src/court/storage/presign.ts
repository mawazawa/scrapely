/**
 * Presigned URL Generation
 * Generate secure temporary URLs for document access
 */

import { logger } from '../../lib/logger';

/**
 * Presigned URL options
 */
export interface PresignOptions {
  expiresIn?: number;  // Seconds until expiration
  contentType?: string;
  contentDisposition?: 'inline' | 'attachment';
  fileName?: string;
}

/**
 * Default presign options
 */
const DEFAULT_PRESIGN_OPTIONS: PresignOptions = {
  expiresIn: 3600,  // 1 hour
  contentDisposition: 'inline',
};

/**
 * Presigned URL result
 */
export interface PresignedUrl {
  url: string;
  expiresAt: Date;
  method: 'GET' | 'PUT';
}

/**
 * Generate a presigned URL for downloading a document
 *
 * Note: Cloudflare R2 doesn't have built-in presigning like S3.
 * This implementation uses a signed token approach with Workers.
 */
export async function generateDownloadUrl(
  bucket: R2Bucket,
  key: string,
  secretKey: string,
  options: PresignOptions = {}
): Promise<PresignedUrl> {
  const opts = { ...DEFAULT_PRESIGN_OPTIONS, ...options };
  const expiresAt = new Date(Date.now() + (opts.expiresIn || 3600) * 1000);

  // Create signature payload
  const payload = {
    key,
    exp: Math.floor(expiresAt.getTime() / 1000),
    method: 'GET',
  };

  // Sign the payload
  const signature = await signPayload(payload, secretKey);

  // Encode as URL-safe token
  const token = encodeToken(payload, signature);

  logger.debug('Generated presigned download URL', {
    key,
    expiresAt: expiresAt.toISOString(),
  });

  // The actual URL would be handled by a Worker route
  // e.g., /documents/download?token=xxx
  return {
    url: `/api/court/documents/download?token=${token}`,
    expiresAt,
    method: 'GET',
  };
}

/**
 * Generate a presigned URL for uploading a document
 */
export async function generateUploadUrl(
  bucket: R2Bucket,
  key: string,
  secretKey: string,
  options: PresignOptions = {}
): Promise<PresignedUrl> {
  const opts = { ...DEFAULT_PRESIGN_OPTIONS, ...options };
  const expiresAt = new Date(Date.now() + (opts.expiresIn || 3600) * 1000);

  const payload = {
    key,
    exp: Math.floor(expiresAt.getTime() / 1000),
    method: 'PUT',
    contentType: opts.contentType,
  };

  const signature = await signPayload(payload, secretKey);
  const token = encodeToken(payload, signature);

  logger.debug('Generated presigned upload URL', {
    key,
    expiresAt: expiresAt.toISOString(),
  });

  return {
    url: `/api/court/documents/upload?token=${token}`,
    expiresAt,
    method: 'PUT',
  };
}

/**
 * Verify a presigned URL token
 */
export async function verifyToken(
  token: string,
  secretKey: string
): Promise<{ valid: boolean; payload?: Record<string, unknown>; error?: string }> {
  try {
    const { payload, signature } = decodeToken(token);

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'Token expired' };
    }

    // Verify signature
    const expectedSignature = await signPayload(payload, secretKey);
    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid signature' };
    }

    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: String(error) };
  }
}

/**
 * Sign a payload using HMAC-SHA256
 */
async function signPayload(
  payload: Record<string, unknown>,
  secretKey: string
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, data);
  return bufferToHex(signature);
}

/**
 * Encode payload and signature as URL-safe token
 */
function encodeToken(
  payload: Record<string, unknown>,
  signature: string
): string {
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = btoa(payloadStr)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${payloadB64}.${signature}`;
}

/**
 * Decode a token back to payload and signature
 */
function decodeToken(token: string): {
  payload: Record<string, unknown>;
  signature: string;
} {
  const [payloadB64, signature] = token.split('.');

  if (!payloadB64 || !signature) {
    throw new Error('Invalid token format');
  }

  // Restore base64 padding
  const padded = payloadB64
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(payloadB64.length + (4 - payloadB64.length % 4) % 4, '=');

  const payloadStr = atob(padded);
  const payload = JSON.parse(payloadStr);

  return { payload, signature };
}

/**
 * Convert ArrayBuffer to hex string
 */
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate content disposition header value
 */
export function generateContentDisposition(
  disposition: 'inline' | 'attachment',
  fileName?: string
): string {
  if (!fileName) {
    return disposition;
  }

  // Sanitize filename for header
  const safeFileName = fileName.replace(/[^\w\s.-]/g, '_');

  // RFC 5987 encoding for non-ASCII characters
  const encodedFileName = encodeURIComponent(fileName);

  return `${disposition}; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`;
}

/**
 * Parse content disposition header
 */
export function parseContentDisposition(
  header: string
): { disposition: 'inline' | 'attachment'; fileName?: string } {
  const parts = header.split(';').map(p => p.trim());
  const disposition = parts[0] === 'attachment' ? 'attachment' : 'inline';

  let fileName: string | undefined;

  for (const part of parts.slice(1)) {
    if (part.startsWith('filename*=')) {
      // RFC 5987 encoded filename
      const match = part.match(/filename\*=(?:UTF-8'')?(.+)/i);
      if (match) {
        fileName = decodeURIComponent(match[1]);
      }
    } else if (part.startsWith('filename=')) {
      // Basic filename
      const match = part.match(/filename="?([^"]+)"?/);
      if (match) {
        fileName = match[1];
      }
    }
  }

  return { disposition, fileName };
}
