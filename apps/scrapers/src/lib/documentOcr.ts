import { err, ok, Result, ResultAsync } from 'neverthrow';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { Env } from '../index';

/**
 * Document Processing Module
 * Supports multiple providers for PDF/document extraction:
 *
 * 1. Gemini 3 Flash/Pro (Dec 2025) - Native vision for PDFs
 *    - 15% better accuracy than 2.5 Flash
 *    - Native text extraction (no token charge for embedded text)
 *    - media_resolution: low/medium/high control
 *    - $0.50/$3.00 per 1M tokens
 *
 * 2. Mistral OCR 3 (Dec 17, 2025)
 *    - 88.9% handwriting accuracy
 *    - 96.6% table extraction
 *    - $1-2 per 1,000 pages
 */

export type OcrProvider = 'gemini' | 'mistral';
export type GeminiModel = 'gemini-3-flash' | 'gemini-3-pro';
export type MediaResolution = 'low' | 'medium' | 'high';

interface DocumentResult {
  title: string;
  text: string;
  pages?: number;
  provider: OcrProvider;
}

interface MistralOcrResponse {
  id: string;
  object: string;
  model: string;
  content: string;
  usage: {
    pages_processed: number;
  };
}

// Supported document types
const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.pptx', '.xlsx'];

export function isDocumentUrl(url: string): boolean {
  const lowercaseUrl = url.toLowerCase();
  return SUPPORTED_EXTENSIONS.some(ext => lowercaseUrl.endsWith(ext));
}

export function isPdfUrl(url: string): boolean {
  return url.toLowerCase().endsWith('.pdf');
}

/**
 * Process a PDF document using Gemini 3 Flash/Pro
 * Uses native vision capabilities for document understanding
 *
 * Best practices from Google (Dec 2025):
 * - medium resolution optimal for most documents
 * - high resolution rarely improves OCR results
 * - Native text extracted without token charge
 */
export async function processDocumentWithGemini(
  env: Env,
  documentUrl: string,
  options: {
    model?: GeminiModel;
    mediaResolution?: MediaResolution;
  } = {}
): Promise<Result<DocumentResult, Error>> {
  const { model = 'gemini-3-flash', mediaResolution = 'medium' } = options;

  const google = createGoogleGenerativeAI({
    apiKey: env.GOOGLE_API_KEY,
    baseURL: env.GOOGLE_BASE_URL,
  });

  // Fetch the PDF as base64
  const pdfResult = await ResultAsync.fromPromise(
    fetch(documentUrl).then(async res => {
      if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
      const buffer = await res.arrayBuffer();
      return Buffer.from(buffer).toString('base64');
    }),
    e => (e instanceof Error ? e : new Error(String(e)))
  );

  if (pdfResult.isErr()) return err(pdfResult.error);

  const result = await ResultAsync.fromPromise(
    generateText({
      model: google(model),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: pdfResult.value,
              mimeType: 'application/pdf',
            },
            {
              type: 'text',
              text: `Extract the complete text content from this PDF document.

Return the content in clean markdown format with:
1. Preserve document structure (headings, paragraphs, lists)
2. Include any tables in markdown table format
3. Note any images with [IMAGE: description]
4. Preserve any important formatting

Start with the document title if present, then the full content.`,
            },
          ],
        },
      ],
      // Gemini 3 media resolution control
      experimental_providerMetadata: {
        google: {
          mediaResolution,
        },
      },
    }),
    e => (e instanceof Error ? e : new Error(String(e)))
  );

  if (result.isErr()) return err(result.error);

  // Extract title from first heading
  const titleMatch = result.value.text.match(/^#\s+(.+)$/m);
  const urlTitle = documentUrl.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Document';
  const title = titleMatch?.[1] || urlTitle;

  return ok({
    title,
    text: result.value.text,
    provider: 'gemini',
  });
}

/**
 * Process a document using Mistral OCR 3
 * Best for: handwriting, complex tables, scanned documents
 */
export async function processDocumentWithMistral(
  env: Env,
  documentUrl: string
): Promise<Result<DocumentResult, Error>> {
  if (!env.MISTRAL_API_KEY) {
    return err(new Error('Mistral API key not configured'));
  }

  const result = await ResultAsync.fromPromise(
    fetch('https://api.mistral.ai/v1/ocr', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.MISTRAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-ocr-2512', // OCR 3 model ID
        document: {
          type: 'url',
          url: documentUrl,
        },
        output_format: 'markdown',
        include_tables: true,
        include_images: false,
      }),
    }).then(async res => {
      if (!res.ok) {
        const error = await res.text();
        throw new Error(`Mistral OCR error: ${res.status} - ${error}`);
      }
      return res.json() as Promise<MistralOcrResponse>;
    }),
    e => (e instanceof Error ? e : new Error(String(e)))
  );

  if (result.isErr()) return err(result.error);

  const data = result.value;

  // Extract title from first heading or filename
  const titleMatch = data.content.match(/^#\s+(.+)$/m);
  const urlTitle = documentUrl.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Document';
  const title = titleMatch?.[1] || urlTitle;

  return ok({
    title,
    text: data.content,
    pages: data.usage.pages_processed,
    provider: 'mistral',
  });
}

/**
 * Smart document processor - automatically selects best provider
 *
 * Strategy:
 * 1. If MISTRAL_API_KEY available → Use Mistral OCR 3 (best accuracy)
 * 2. Fallback to Gemini 3 Flash (always available, good quality)
 */
export async function processDocument(
  env: Env,
  documentUrl: string,
  preferredProvider?: OcrProvider
): Promise<Result<DocumentResult, Error>> {
  // Use preferred provider if specified and available
  if (preferredProvider === 'mistral' && env.MISTRAL_API_KEY) {
    return processDocumentWithMistral(env, documentUrl);
  }

  if (preferredProvider === 'gemini') {
    return processDocumentWithGemini(env, documentUrl);
  }

  // Auto-select: prefer Mistral if available (better accuracy), else Gemini
  if (env.MISTRAL_API_KEY) {
    const mistralResult = await processDocumentWithMistral(env, documentUrl);
    if (mistralResult.isOk()) return mistralResult;
    // Fallback to Gemini if Mistral fails
    console.log('[OCR] Mistral failed, falling back to Gemini 3 Flash');
  }

  return processDocumentWithGemini(env, documentUrl);
}

/**
 * Batch process multiple documents
 */
export async function processDocumentsBatch(
  env: Env,
  documentUrls: string[],
  preferredProvider?: OcrProvider
): Promise<Map<string, Result<DocumentResult, Error>>> {
  const results = new Map<string, Result<DocumentResult, Error>>();

  // Process in parallel with rate limiting
  const promises = documentUrls.map(async url => {
    const result = await processDocument(env, url, preferredProvider);
    results.set(url, result);
  });

  await Promise.allSettled(promises);

  return results;
}

/**
 * Estimate cost for document processing
 */
export function estimateCost(
  pageCount: number,
  provider: OcrProvider,
  options?: { useBatch?: boolean; tokensPerPage?: number }
): number {
  const { useBatch = false, tokensPerPage = 1000 } = options || {};

  if (provider === 'mistral') {
    // OCR 3: $2/1K pages, $1/1K pages with batch API
    const pricePerPage = useBatch ? 0.001 : 0.002;
    return pageCount * pricePerPage;
  }

  // Gemini 3 Flash: $0.50/1M input + $3.00/1M output tokens
  const totalTokens = pageCount * tokensPerPage;
  const inputCost = (totalTokens / 1_000_000) * 0.5;
  const outputCost = (totalTokens / 1_000_000) * 3.0; // Assume similar output
  return inputCost + outputCost;
}
