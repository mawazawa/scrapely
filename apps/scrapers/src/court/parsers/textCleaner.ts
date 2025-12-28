/**
 * Text Cleaner
 * Utilities for cleaning and normalizing court document text
 */

/**
 * Common legal abbreviations and their expansions
 */
const LEGAL_ABBREVIATIONS: Record<string, string> = {
  'v.': 'versus',
  'vs.': 'versus',
  'et al.': 'and others',
  'et seq.': 'and the following',
  'i.e.': 'that is',
  'e.g.': 'for example',
  'n/a': 'not applicable',
  'sic': '[sic]',
  're:': 'regarding',
  'atty.': 'attorney',
  'attys.': 'attorneys',
  'def.': 'defendant',
  'defs.': 'defendants',
  'pl.': 'plaintiff',
  'pls.': 'plaintiffs',
  'resp.': 'respondent',
  'resps.': 'respondents',
  'pet.': 'petitioner',
  'pets.': 'petitioners',
};

/**
 * Remove HTML tags from text
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Decode HTML entities
 */
export function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&mdash;': '—',
    '&ndash;': '–',
    '&hellip;': '…',
    '&lsquo;': ''',
    '&rsquo;': ''',
    '&ldquo;': '"',
    '&rdquo;': '"',
    '&bull;': '•',
    '&sect;': '§',
    '&para;': '¶',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
    '&deg;': '°',
    '&plusmn;': '±',
  };

  let result = text;

  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'g'), char);
  }

  // Handle numeric entities
  result = result.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  result = result.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  return result;
}

/**
 * Normalize whitespace
 */
export function normalizeWhitespace(text: string): string {
  return text
    // Convert various whitespace to regular spaces
    .replace(/[\t\r\f\v]/g, ' ')
    // Normalize multiple spaces to single space
    .replace(/ {2,}/g, ' ')
    // Normalize multiple newlines to double newline
    .replace(/\n{3,}/g, '\n\n')
    // Trim lines
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim();
}

/**
 * Remove extra characters that often appear in court documents
 */
export function removeCourtDocumentNoise(text: string): string {
  return text
    // Remove line numbers often found in transcripts
    .replace(/^\s*\d{1,3}\s+/gm, '')
    // Remove page numbers
    .replace(/\n\s*-?\s*\d+\s*-?\s*\n/g, '\n')
    .replace(/Page\s+\d+\s+of\s+\d+/gi, '')
    // Remove header/footer markers
    .replace(/^\s*(?:SUPERIOR COURT|CIVIL|DEPARTMENT)\s*$/gm, '')
    // Remove empty parentheses and brackets
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    // Remove excessive punctuation
    .replace(/\.{4,}/g, '...')
    .replace(/-{3,}/g, '—');
}

/**
 * Fix common OCR errors in legal documents
 */
export function fixOcrErrors(text: string): string {
  const corrections: Record<string, string> = {
    // Common OCR errors
    'l1': 'll',
    '0r': 'or',
    'c0urt': 'court',
    'judqe': 'judge',
    'f1le': 'file',
    'mot1on': 'motion',
    'p1aintiff': 'plaintiff',
    'd3fendant': 'defendant',
    'ord3r': 'order',
    'rullng': 'ruling',
    // Letter/number confusion
    'l': 'I',  // At start of sentences
    'O': '0',  // In case numbers
  };

  let result = text;

  for (const [error, fix] of Object.entries(corrections)) {
    result = result.replace(new RegExp(`\\b${error}\\b`, 'gi'), fix);
  }

  return result;
}

/**
 * Standardize legal citations
 */
export function standardizeCitations(text: string): string {
  return text
    // California Reporter citations
    .replace(/(\d+)\s*Cal\.\s*App\.\s*(\d+)(?:th|rd|nd|st)?\s*(\d+)/gi, '$1 Cal.App.$2d $3')
    .replace(/(\d+)\s*Cal\.\s*(\d+)(?:th|rd|nd|st)?\s*(\d+)/gi, '$1 Cal.$2d $3')
    // Federal citations
    .replace(/(\d+)\s*F\.\s*(\d+)(?:th|rd|nd|st)?\s*(\d+)/gi, '$1 F.$2d $3')
    .replace(/(\d+)\s*U\.?S\.?\s*(\d+)/gi, '$1 U.S. $2')
    // Code sections
    .replace(/C\.?C\.?P\.?\s*§?\s*(\d+)/gi, 'CCP § $1')
    .replace(/C\.?C\.?\s*§?\s*(\d+)/gi, 'Civ.Code § $1')
    .replace(/Pen\.?\s*C\.?\s*§?\s*(\d+)/gi, 'Pen.Code § $1');
}

/**
 * Extract and clean section headers
 */
export function extractSectionHeaders(text: string): string[] {
  const headers: string[] = [];
  const patterns = [
    /^([A-Z][A-Z\s]+)$/gm,  // ALL CAPS lines
    /^(?:I{1,3}|IV|V|VI{0,3}|IX|X)\.\s+(.+)$/gm,  // Roman numeral headers
    /^[A-Z]\.\s+(.+)$/gm,  // Letter headers
    /^\d+\.\s+([A-Z].+)$/gm,  // Numbered headers
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const header = match[1].trim();
      if (header.length > 3 && header.length < 100) {
        headers.push(header);
      }
    }
  }

  return [...new Set(headers)];
}

/**
 * Clean and normalize a full court document
 */
export function cleanCourtDocument(html: string): string {
  let text = html;

  // Step 1: Strip HTML
  text = stripHtml(text);

  // Step 2: Decode entities
  text = decodeHtmlEntities(text);

  // Step 3: Remove document noise
  text = removeCourtDocumentNoise(text);

  // Step 4: Fix OCR errors
  text = fixOcrErrors(text);

  // Step 5: Normalize whitespace
  text = normalizeWhitespace(text);

  return text;
}

/**
 * Truncate text to maximum length while preserving words
 */
export function truncateText(text: string, maxLength: number, suffix: string = '...'): string {
  if (text.length <= maxLength) return text;

  const truncated = text.slice(0, maxLength - suffix.length);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.7) {
    return truncated.slice(0, lastSpace) + suffix;
  }

  return truncated + suffix;
}

/**
 * Split text into paragraphs
 */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

/**
 * Join lines that were incorrectly split
 */
export function joinBrokenLines(text: string): string {
  return text
    // Join lines where a word was split
    .replace(/(\w)-\n(\w)/g, '$1$2')
    // Join lines that don't end with sentence punctuation
    .replace(/([a-z,;:])\n([a-z])/g, '$1 $2');
}
