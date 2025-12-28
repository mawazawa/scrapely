/**
 * Document Compression
 * Compression utilities for large court documents
 */

import { logger } from '../../lib/logger';

/**
 * Compression options
 */
export interface CompressionOptions {
  level?: 'fast' | 'default' | 'best';
  minSize?: number;  // Minimum size to trigger compression (bytes)
}

/**
 * Compression result
 */
export interface CompressionResult {
  data: Uint8Array;
  compressed: boolean;
  originalSize: number;
  compressedSize: number;
  ratio: number;
}

/**
 * Default compression options
 */
const DEFAULT_OPTIONS: CompressionOptions = {
  level: 'default',
  minSize: 1024 * 100,  // 100KB minimum
};

/**
 * Check if a MIME type should be compressed
 * Some formats are already compressed (JPEG, PNG, PDF with compression)
 */
export function shouldCompress(mimeType: string): boolean {
  // Already compressed formats
  const noCompressTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/zip',
    'application/gzip',
    'application/x-bzip2',
    'application/x-7z-compressed',
  ];

  return !noCompressTypes.includes(mimeType);
}

/**
 * Compress data using gzip via Web Streams API
 */
export async function compress(
  data: ArrayBuffer | Uint8Array,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const inputData = data instanceof Uint8Array ? data : new Uint8Array(data);
  const originalSize = inputData.length;

  // Skip if below minimum size
  if (originalSize < (opts.minSize || 0)) {
    return {
      data: inputData,
      compressed: false,
      originalSize,
      compressedSize: originalSize,
      ratio: 1,
    };
  }

  try {
    // Use CompressionStream (available in Workers)
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(inputData);
        controller.close();
      },
    });

    const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
    const reader = compressedStream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    // Combine chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const compressedData = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      compressedData.set(chunk, offset);
      offset += chunk.length;
    }

    const ratio = compressedData.length / originalSize;

    // Only use compressed version if it's actually smaller
    if (ratio >= 0.95) {
      logger.debug('Compression not beneficial', {
        originalSize,
        compressedSize: compressedData.length,
        ratio,
      });
      return {
        data: inputData,
        compressed: false,
        originalSize,
        compressedSize: originalSize,
        ratio: 1,
      };
    }

    logger.debug('Document compressed', {
      originalSize,
      compressedSize: compressedData.length,
      ratio,
    });

    return {
      data: compressedData,
      compressed: true,
      originalSize,
      compressedSize: compressedData.length,
      ratio,
    };
  } catch (error) {
    logger.warn('Compression failed, using original', { error: String(error) });
    return {
      data: inputData,
      compressed: false,
      originalSize,
      compressedSize: originalSize,
      ratio: 1,
    };
  }
}

/**
 * Decompress gzip data
 */
export async function decompress(data: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const inputData = data instanceof Uint8Array ? data : new Uint8Array(data);

  try {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(inputData);
        controller.close();
      },
    });

    const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
    const reader = decompressedStream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    // Combine chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  } catch (error) {
    logger.error('Decompression failed', { error: String(error) });
    throw new Error(`Decompression failed: ${error}`);
  }
}

/**
 * Check if data is gzip compressed
 */
export function isGzipCompressed(data: Uint8Array): boolean {
  // Gzip magic number: 0x1f 0x8b
  return data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b;
}

/**
 * Estimate compression ratio for a given MIME type
 */
export function estimateCompressionRatio(mimeType: string): number {
  const estimates: Record<string, number> = {
    'text/plain': 0.3,
    'text/html': 0.2,
    'application/json': 0.3,
    'application/pdf': 0.9,  // PDFs often have internal compression
    'application/msword': 0.4,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 0.95,  // Already compressed
    'image/tiff': 0.7,
    'application/rtf': 0.3,
  };

  return estimates[mimeType] || 0.6;
}
