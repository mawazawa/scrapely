/**
 * OCR Integration
 * Extract text from court document images and PDFs
 */

import { logger } from '../../lib/logger';

/**
 * OCR result
 */
export interface OcrResult {
  success: boolean;
  text: string;
  confidence?: number;
  pages?: number;
  processingTime: number;
  error?: string;
}

/**
 * OCR options
 */
export interface OcrOptions {
  language?: string;
  pageLimit?: number;
  enhanceQuality?: boolean;
}

/**
 * Default OCR options
 */
const DEFAULT_OCR_OPTIONS: OcrOptions = {
  language: 'eng',
  pageLimit: 50,
  enhanceQuality: true,
};

/**
 * Check if a document type supports OCR
 */
export function supportsOcr(mimeType: string): boolean {
  const supportedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/tiff',
    'image/bmp',
    'image/webp',
  ];

  return supportedTypes.includes(mimeType);
}

/**
 * Extract text from a PDF using Mistral OCR 3
 * (Placeholder - integrates with existing documentOcr.ts)
 */
export async function extractPdfText(
  pdfBuffer: ArrayBuffer,
  options: OcrOptions = {}
): Promise<OcrResult> {
  const opts = { ...DEFAULT_OCR_OPTIONS, ...options };
  const startTime = Date.now();

  try {
    // In production, this would call Mistral OCR 3
    // For now, return a placeholder indicating OCR needs to be performed
    logger.info('PDF OCR requested', {
      sizeBytes: pdfBuffer.byteLength,
      pageLimit: opts.pageLimit,
    });

    // This would be replaced with actual Mistral OCR call
    // const result = await documentOcr.extractText(pdfBuffer, opts);

    return {
      success: true,
      text: '',  // Would contain extracted text
      pages: 1,
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    logger.error('PDF OCR failed', { error: String(error) });
    return {
      success: false,
      text: '',
      error: String(error),
      processingTime: Date.now() - startTime,
    };
  }
}

/**
 * Extract text from an image
 */
export async function extractImageText(
  imageBuffer: ArrayBuffer,
  mimeType: string,
  options: OcrOptions = {}
): Promise<OcrResult> {
  const opts = { ...DEFAULT_OCR_OPTIONS, ...options };
  const startTime = Date.now();

  try {
    logger.info('Image OCR requested', {
      mimeType,
      sizeBytes: imageBuffer.byteLength,
    });

    // This would be replaced with actual OCR call
    return {
      success: true,
      text: '',
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    logger.error('Image OCR failed', { error: String(error) });
    return {
      success: false,
      text: '',
      error: String(error),
      processingTime: Date.now() - startTime,
    };
  }
}

/**
 * Process document for OCR based on type
 */
export async function processDocumentOcr(
  data: ArrayBuffer,
  mimeType: string,
  options: OcrOptions = {}
): Promise<OcrResult> {
  if (!supportsOcr(mimeType)) {
    return {
      success: false,
      text: '',
      error: `OCR not supported for ${mimeType}`,
      processingTime: 0,
    };
  }

  if (mimeType === 'application/pdf') {
    return extractPdfText(data, options);
  }

  return extractImageText(data, mimeType, options);
}

/**
 * Clean OCR text output
 */
export function cleanOcrText(text: string): string {
  return text
    // Normalize whitespace
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    // Remove excessive blank lines
    .replace(/\n{3,}/g, '\n\n')
    // Remove leading/trailing whitespace from lines
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Remove leading/trailing whitespace from document
    .trim();
}

/**
 * Extract searchable text sections
 */
export interface TextSection {
  type: 'heading' | 'paragraph' | 'list' | 'table' | 'other';
  text: string;
  page?: number;
}

export function extractTextSections(ocrText: string): TextSection[] {
  const sections: TextSection[] = [];
  const lines = ocrText.split('\n');

  let currentSection: TextSection | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      // Empty line ends current section
      if (currentSection) {
        sections.push(currentSection);
        currentSection = null;
      }
      continue;
    }

    // Detect section type
    let type: TextSection['type'] = 'paragraph';

    // Headings: all caps, short, ends with colon
    if (
      trimmedLine === trimmedLine.toUpperCase() &&
      trimmedLine.length < 60 &&
      /^[A-Z\s\-:]+$/.test(trimmedLine)
    ) {
      type = 'heading';
    }
    // List items
    else if (/^(\d+\.|[-*+]|\([a-z]\))\s/.test(trimmedLine)) {
      type = 'list';
    }
    // Table-like content (multiple spaces or tabs)
    else if (/\s{3,}/.test(line)) {
      type = 'table';
    }

    if (currentSection && currentSection.type === type) {
      currentSection.text += '\n' + trimmedLine;
    } else {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = { type, text: trimmedLine };
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Check if OCR result quality is acceptable
 */
export function isOcrQualityAcceptable(result: OcrResult): boolean {
  if (!result.success) return false;

  // Check confidence if available
  if (result.confidence !== undefined && result.confidence < 0.7) {
    return false;
  }

  // Check if we got meaningful text
  if (result.text.trim().length < 50) {
    return false;
  }

  // Check for common OCR error patterns
  const errorPatterns = [
    /[^a-zA-Z0-9\s]{10,}/,  // Long sequences of special characters
    /(.)\1{5,}/,            // Same character repeated 5+ times
  ];

  for (const pattern of errorPatterns) {
    if (pattern.test(result.text)) {
      return false;
    }
  }

  return true;
}
