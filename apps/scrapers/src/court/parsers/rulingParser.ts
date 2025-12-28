/**
 * Ruling Parser
 * Parse court rulings from HTML into structured data
 */

import { z } from 'zod';
import { logger } from '../../lib/logger';
import type { RulingInfo, CaseNumber } from '../types';
import { parseCaseNumber, validateCaseNumber } from '../sfCourt/caseNumber';

/**
 * Ruling outcome types
 */
export type RulingOutcome =
  | 'granted'
  | 'denied'
  | 'granted_in_part'
  | 'denied_in_part'
  | 'continued'
  | 'moot'
  | 'taken_under_submission'
  | 'off_calendar'
  | 'vacated'
  | 'other';

/**
 * Parsed ruling data
 */
export interface ParsedRuling {
  caseNumber: CaseNumber;
  caseTitle?: string;
  department: string;
  judge?: string;
  hearingDate: Date;
  motionType: string;
  movingParty?: string;
  respondingParty?: string;
  outcome: RulingOutcome;
  rulingText: string;
  reasoning?: string;
  orders?: string[];
}

/**
 * Ruling schema for validation
 */
export const RulingSchema = z.object({
  caseNumber: z.string().min(1),
  department: z.string().min(1),
  hearingDate: z.string().or(z.date()),
  motionType: z.string().min(1),
  rulingText: z.string().min(1),
});

/**
 * Parse outcome from text
 */
export function parseOutcome(text: string): RulingOutcome {
  const lower = text.toLowerCase();

  // Check compound outcomes first
  if (lower.includes('granted in part') && lower.includes('denied in part')) {
    return 'granted_in_part';
  }
  if (lower.includes('denied in part') && lower.includes('granted in part')) {
    return 'denied_in_part';
  }

  // Simple outcomes
  if (/\b(is\s+)?granted\b/i.test(text) && !/denied/i.test(text)) return 'granted';
  if (/\b(is\s+)?denied\b/i.test(text) && !/granted/i.test(text)) return 'denied';
  if (/\bcontinued?\b/i.test(text)) return 'continued';
  if (/\bmoot\b/i.test(text)) return 'moot';
  if (/\btaken under (submission|advisement)\b/i.test(text)) return 'taken_under_submission';
  if (/\boff[\s-]?calendar\b/i.test(text)) return 'off_calendar';
  if (/\bvacated?\b/i.test(text)) return 'vacated';

  return 'other';
}

/**
 * Normalize motion type
 */
export function normalizeMotionType(text: string): string {
  const mappings: Record<string, string> = {
    'demurrer': 'Demurrer',
    'motion to strike': 'Motion to Strike',
    'motion for summary judgment': 'Motion for Summary Judgment',
    'msj': 'Motion for Summary Judgment',
    'motion for summary adjudication': 'Motion for Summary Adjudication',
    'msa': 'Motion for Summary Adjudication',
    'motion to compel': 'Motion to Compel',
    'motion to quash': 'Motion to Quash',
    'motion for protective order': 'Motion for Protective Order',
    'motion for leave to amend': 'Motion for Leave to Amend',
    'motion to dismiss': 'Motion to Dismiss',
    'motion for default judgment': 'Motion for Default Judgment',
    'motion to set aside': 'Motion to Set Aside',
    'motion for reconsideration': 'Motion for Reconsideration',
    'motion in limine': 'Motion in Limine',
    'mil': 'Motion in Limine',
    'motion to seal': 'Motion to Seal',
    'motion for attorney fees': 'Motion for Attorney Fees',
    "motion for attorney's fees": 'Motion for Attorney Fees',
    'motion for sanctions': 'Motion for Sanctions',
    'ex parte application': 'Ex Parte Application',
    'ex parte': 'Ex Parte Application',
  };

  const lower = text.toLowerCase().trim();

  for (const [pattern, normalized] of Object.entries(mappings)) {
    if (lower.includes(pattern)) {
      return normalized;
    }
  }

  // Capitalize first letter of each word
  return text.replace(/\b\w/g, l => l.toUpperCase()).trim();
}

/**
 * Clean HTML and normalize text
 */
export function cleanText(html: string): string {
  return html
    // Remove HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove leading/trailing whitespace
    .trim();
}

/**
 * Extract case number from text
 */
export function extractCaseNumber(text: string): CaseNumber | null {
  // Common patterns for case numbers
  const patterns = [
    /\b([A-Z]{2,4})[-\s]?(\d{2})[-\s]?(\d{4,8})\b/gi,
    /Case\s+(?:No\.?|Number|#)?\s*:?\s*([A-Z]{2,4}[-\s]?\d{2}[-\s]?\d{4,8})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const caseNumberStr = match[1] || match[0];
      const validation = validateCaseNumber(caseNumberStr);
      if (validation.valid && validation.caseNumber) {
        return validation.caseNumber;
      }
    }
  }

  return null;
}

/**
 * Extract judge name from text
 */
export function extractJudgeName(text: string): string | undefined {
  const patterns = [
    /(?:Hon\.?|Honorable|Judge)\s+([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)/i,
    /Department\s+\d+\s*[-–]\s*([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)/i,
    /Before:\s*([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return undefined;
}

/**
 * Extract party names from text
 */
export function extractParties(text: string): { moving?: string; responding?: string } {
  const result: { moving?: string; responding?: string } = {};

  // Moving party patterns
  const movingPatterns = [
    /Moving\s+Party:\s*([^;.\n]+)/i,
    /(?:Plaintiff|Defendant|Petitioner|Respondent)['']?s?\s+([^,]+?)['']?s?\s+(?:Motion|Demurrer)/i,
    /Motion\s+(?:by|of)\s+([^,;.\n]+)/i,
  ];

  for (const pattern of movingPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.moving = cleanText(match[1]);
      break;
    }
  }

  // Responding party patterns
  const respondingPatterns = [
    /Responding\s+Party:\s*([^;.\n]+)/i,
    /Opposition\s+(?:by|from|of)\s+([^,;.\n]+)/i,
    /(?:Opposed|Opposition)\s+by\s+([^,;.\n]+)/i,
  ];

  for (const pattern of respondingPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.responding = cleanText(match[1]);
      break;
    }
  }

  return result;
}

/**
 * Extract orders from ruling text
 */
export function extractOrders(text: string): string[] {
  const orders: string[] = [];

  // Look for numbered orders
  const numberedPattern = /(?:^|\n)\s*(\d+)\.\s+([^\n]+)/g;
  let match;
  while ((match = numberedPattern.exec(text)) !== null) {
    orders.push(match[2].trim());
  }

  // Look for "IT IS SO ORDERED" sections
  const orderedPattern = /IT IS (?:HEREBY|SO) ORDERED[:\s]+([^.]+\.)/gi;
  while ((match = orderedPattern.exec(text)) !== null) {
    orders.push(match[1].trim());
  }

  return orders;
}

/**
 * Extract reasoning from ruling text
 */
export function extractReasoning(text: string): string | undefined {
  const patterns = [
    /(?:BACKGROUND|ANALYSIS|DISCUSSION)[:\s]*\n?([\s\S]+?)(?=\n\n|CONCLUSION|ORDER|IT IS)/i,
    /(?:The Court finds|The motion is|This motion)[:\s]*([\s\S]{50,500})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return cleanText(match[1]).substring(0, 1000);
    }
  }

  return undefined;
}

/**
 * Parse date from various formats
 */
export function parseDate(dateStr: string): Date {
  // Common date formats
  const formats = [
    // MM/DD/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // YYYY-MM-DD
    /^(\d{4})-(\d{2})-(\d{2})$/,
    // Month DD, YYYY
    /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/,
  ];

  for (const format of formats) {
    if (format.test(dateStr.trim())) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  // Default to now if parsing fails
  logger.warn('Failed to parse date', { dateStr });
  return new Date();
}

/**
 * Parse a single ruling from HTML element
 */
export function parseRuling(
  html: string,
  defaults: { department: string; hearingDate: Date }
): ParsedRuling | null {
  const cleaned = cleanText(html);

  // Extract case number
  const caseNumber = extractCaseNumber(cleaned);
  if (!caseNumber) {
    logger.debug('Could not extract case number from ruling');
    return null;
  }

  // Extract outcome
  const outcome = parseOutcome(cleaned);

  // Try to extract motion type
  const motionTypeMatch = cleaned.match(
    /(?:Motion|Demurrer|Application|Petition)\s+(?:to|for)\s+([^:;.]+)/i
  );
  const motionType = motionTypeMatch
    ? normalizeMotionType(motionTypeMatch[0])
    : 'Unknown Motion';

  // Extract other details
  const judge = extractJudgeName(cleaned);
  const parties = extractParties(cleaned);
  const orders = extractOrders(cleaned);
  const reasoning = extractReasoning(cleaned);

  return {
    caseNumber,
    department: defaults.department,
    judge,
    hearingDate: defaults.hearingDate,
    motionType,
    movingParty: parties.moving,
    respondingParty: parties.responding,
    outcome,
    rulingText: cleaned,
    reasoning,
    orders: orders.length > 0 ? orders : undefined,
  };
}

/**
 * Parse multiple rulings from a page
 */
export function parseRulingsPage(
  html: string,
  rulingDate: Date,
  sourceUrl: string
): RulingInfo[] {
  const rulings: RulingInfo[] = [];

  // Common separators between rulings
  const separatorPatterns = [
    /<hr\s*\/?>/gi,
    /<div\s+class="ruling"[^>]*>/gi,
    /(?=Case\s+(?:No\.?|Number|#)?\s*:)/gi,
  ];

  // Find ruling sections
  let sections: string[] = [html];

  for (const pattern of separatorPatterns) {
    const newSections: string[] = [];
    for (const section of sections) {
      const parts = section.split(pattern);
      newSections.push(...parts.filter(p => p.trim().length > 100));
    }
    if (newSections.length > sections.length) {
      sections = newSections;
    }
  }

  // Parse each section
  for (const section of sections) {
    // Try to extract department from section
    const deptMatch = section.match(/Department\s+(\d+)/i);
    const department = deptMatch ? `Dept ${deptMatch[1]}` : 'Unknown';

    const parsed = parseRuling(section, { department, hearingDate: rulingDate });

    if (parsed) {
      rulings.push({
        id: crypto.randomUUID(),
        caseNumber: parsed.caseNumber,
        rulingDate,
        hearingDate: parsed.hearingDate,
        department: parsed.department,
        judge: parsed.judge || 'Unknown',
        motionType: parsed.motionType,
        rulingType: 'tentative',
        outcome: parsed.outcome,
        text: parsed.rulingText,
        movingParty: parsed.movingParty,
        respondingParty: parsed.respondingParty,
        scrapedAt: new Date(),
        sourceUrl,
      });
    }
  }

  logger.info('Parsed rulings page', {
    rulingDate: rulingDate.toISOString(),
    sectionCount: sections.length,
    rulingCount: rulings.length,
  });

  return rulings;
}

/**
 * Diff two rulings to detect changes
 */
export function diffRulings(
  oldRuling: RulingInfo,
  newRuling: RulingInfo
): { changed: boolean; changes: string[] } {
  const changes: string[] = [];

  if (oldRuling.outcome !== newRuling.outcome) {
    changes.push(`Outcome: ${oldRuling.outcome} → ${newRuling.outcome}`);
  }

  if (oldRuling.text !== newRuling.text) {
    changes.push('Ruling text modified');
  }

  if (oldRuling.department !== newRuling.department) {
    changes.push(`Department: ${oldRuling.department} → ${newRuling.department}`);
  }

  if (oldRuling.judge !== newRuling.judge) {
    changes.push(`Judge: ${oldRuling.judge} → ${newRuling.judge}`);
  }

  return {
    changed: changes.length > 0,
    changes,
  };
}
