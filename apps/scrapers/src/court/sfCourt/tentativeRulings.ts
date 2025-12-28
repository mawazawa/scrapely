/**
 * SF Court Tentative Rulings
 * Specialized module for scraping and parsing tentative rulings
 */

import { z } from 'zod';
import type { RulingInfo, CaseNumber } from '../types';
import { parseCaseNumber, validateCaseNumber } from './caseNumber';
import { SF_COURT_URLS } from './urls';

/**
 * Tentative ruling outcome types
 */
export const RULING_OUTCOMES = [
  'granted',
  'denied',
  'granted_in_part',
  'denied_in_part',
  'continued',
  'moot',
  'taken_under_submission',
  'off_calendar',
  'vacated',
  'other',
] as const;

export type RulingOutcome = typeof RULING_OUTCOMES[number];

/**
 * Motion types commonly seen in SF court
 */
export const MOTION_TYPES = [
  'Demurrer',
  'Motion to Strike',
  'Motion for Summary Judgment',
  'Motion for Summary Adjudication',
  'Motion to Compel',
  'Motion to Quash',
  'Motion for Protective Order',
  'Motion for Leave to Amend',
  'Motion to Dismiss',
  'Motion for Default Judgment',
  'Motion to Set Aside',
  'Motion for Reconsideration',
  'Motion in Limine',
  'Motion to Seal',
  'Motion for Attorney Fees',
  'Motion for Sanctions',
  'Ex Parte Application',
  'Petition',
  'Other',
] as const;

export type MotionType = typeof MOTION_TYPES[number];

/**
 * Raw ruling data from scraping
 */
export interface RawRulingData {
  caseNumber: string;
  caseTitle?: string;
  department: string;
  judge?: string;
  hearingDate: string;
  motionType: string;
  movingParty?: string;
  respondingParty?: string;
  rulingText: string;
  sourceUrl: string;
}

/**
 * Ruling validation schema
 */
export const RulingSchema = z.object({
  caseNumber: z.string(),
  department: z.string(),
  judge: z.string().optional(),
  hearingDate: z.string(),
  motionType: z.string(),
  rulingText: z.string(),
});

/**
 * Parse ruling outcome from text
 */
export function parseRulingOutcome(text: string): RulingOutcome {
  const lower = text.toLowerCase();

  // Check for combined outcomes first
  if (lower.includes('granted in part') && lower.includes('denied in part')) {
    return 'granted_in_part';
  }

  // Check for simple outcomes
  if (lower.includes('granted') && !lower.includes('denied')) return 'granted';
  if (lower.includes('denied') && !lower.includes('granted')) return 'denied';
  if (lower.includes('continued') || lower.includes('continuance')) return 'continued';
  if (lower.includes('moot')) return 'moot';
  if (lower.includes('taken under submission') || lower.includes('under advisement')) return 'taken_under_submission';
  if (lower.includes('off calendar')) return 'off_calendar';
  if (lower.includes('vacated')) return 'vacated';

  return 'other';
}

/**
 * Normalize motion type
 */
export function normalizeMotionType(text: string): MotionType {
  const lower = text.toLowerCase();

  if (lower.includes('demurrer')) return 'Demurrer';
  if (lower.includes('strike')) return 'Motion to Strike';
  if (lower.includes('summary judgment')) return 'Motion for Summary Judgment';
  if (lower.includes('summary adjudication')) return 'Motion for Summary Adjudication';
  if (lower.includes('compel')) return 'Motion to Compel';
  if (lower.includes('quash')) return 'Motion to Quash';
  if (lower.includes('protective order')) return 'Motion for Protective Order';
  if (lower.includes('leave to amend') || lower.includes('amend complaint')) return 'Motion for Leave to Amend';
  if (lower.includes('dismiss')) return 'Motion to Dismiss';
  if (lower.includes('default judgment')) return 'Motion for Default Judgment';
  if (lower.includes('set aside')) return 'Motion to Set Aside';
  if (lower.includes('reconsideration')) return 'Motion for Reconsideration';
  if (lower.includes('in limine')) return 'Motion in Limine';
  if (lower.includes('seal')) return 'Motion to Seal';
  if (lower.includes('attorney') && lower.includes('fee')) return 'Motion for Attorney Fees';
  if (lower.includes('sanction')) return 'Motion for Sanctions';
  if (lower.includes('ex parte')) return 'Ex Parte Application';
  if (lower.includes('petition')) return 'Petition';

  return 'Other';
}

/**
 * Clean and normalize ruling text
 */
export function cleanRulingText(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Remove stray HTML tags
    .replace(/<[^>]+>/g, '')
    // Trim
    .trim();
}

/**
 * Extract parties from ruling text
 */
export function extractPartiesFromText(text: string): { moving?: string; responding?: string } {
  const result: { moving?: string; responding?: string } = {};

  // Common patterns for moving party
  const movingPatterns = [
    /moving party:\s*([^;.\n]+)/i,
    /plaintiff['']?s?\s+([^']+)['']?s?\s+motion/i,
    /defendant['']?s?\s+([^']+)['']?s?\s+motion/i,
    /motion\s+(?:of|by)\s+([^,;.\n]+)/i,
  ];

  for (const pattern of movingPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.moving = match[1].trim();
      break;
    }
  }

  // Common patterns for responding party
  const respondingPatterns = [
    /responding party:\s*([^;.\n]+)/i,
    /opposition\s+(?:of|by|from)\s+([^,;.\n]+)/i,
  ];

  for (const pattern of respondingPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.responding = match[1].trim();
      break;
    }
  }

  return result;
}

/**
 * Parse date from various formats
 */
export function parseRulingDate(dateStr: string): Date {
  // Try various formats
  const formats = [
    // MM/DD/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // YYYY-MM-DD
    /^(\d{4})-(\d{2})-(\d{2})$/,
    // Month DD, YYYY
    /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/,
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  // Fallback to current date
  return new Date();
}

/**
 * Transform raw ruling data to structured format
 */
export function transformRuling(raw: RawRulingData, rulingDate: Date): RulingInfo | null {
  const validation = validateCaseNumber(raw.caseNumber);
  if (!validation.valid) return null;

  const outcome = parseRulingOutcome(raw.rulingText);
  const motionType = normalizeMotionType(raw.motionType);
  const cleanedText = cleanRulingText(raw.rulingText);
  const parties = extractPartiesFromText(raw.rulingText);

  return {
    id: crypto.randomUUID(),
    caseNumber: validation.caseNumber!,
    rulingDate,
    hearingDate: parseRulingDate(raw.hearingDate),
    department: raw.department,
    judge: raw.judge || 'Unknown',
    motionType,
    rulingType: 'tentative',
    outcome,
    text: cleanedText,
    movingParty: raw.movingParty || parties.moving,
    respondingParty: raw.respondingParty || parties.responding,
    scrapedAt: new Date(),
    sourceUrl: raw.sourceUrl,
  };
}

/**
 * Group rulings by case number
 */
export function groupRulingsByCase(rulings: RulingInfo[]): Map<string, RulingInfo[]> {
  const grouped = new Map<string, RulingInfo[]>();

  for (const ruling of rulings) {
    const key = ruling.caseNumber.full;
    const existing = grouped.get(key) || [];
    existing.push(ruling);
    grouped.set(key, existing);
  }

  return grouped;
}

/**
 * Group rulings by department
 */
export function groupRulingsByDepartment(rulings: RulingInfo[]): Map<string, RulingInfo[]> {
  const grouped = new Map<string, RulingInfo[]>();

  for (const ruling of rulings) {
    const existing = grouped.get(ruling.department) || [];
    existing.push(ruling);
    grouped.set(ruling.department, existing);
  }

  return grouped;
}

/**
 * Get rulings URL for a specific date
 */
export function getRulingsUrl(date: Date): string {
  const dateStr = date.toISOString().split('T')[0];
  return SF_COURT_URLS.tentativeRulingsByDate(dateStr);
}

/**
 * Get date range for rulings (typically published day before hearing)
 */
export function getRulingsDateRange(hearingDate: Date): { publishedDate: Date; hearingDate: Date } {
  const publishedDate = new Date(hearingDate);
  publishedDate.setDate(publishedDate.getDate() - 1);

  return { publishedDate, hearingDate };
}

/**
 * Check if it's within ruling publication hours (typically before 3pm)
 */
export function isWithinRulingHours(): boolean {
  const now = new Date();
  // Convert to Pacific time (approximate)
  const pacificHour = now.getUTCHours() - 8; // PST offset

  // Rulings typically published between 1pm and 3pm
  return pacificHour >= 13 && pacificHour <= 15;
}

/**
 * Calculate ruling statistics
 */
export function calculateRulingStats(rulings: RulingInfo[]): {
  total: number;
  byOutcome: Record<RulingOutcome, number>;
  byMotionType: Record<string, number>;
  byDepartment: Record<string, number>;
} {
  const stats = {
    total: rulings.length,
    byOutcome: {} as Record<RulingOutcome, number>,
    byMotionType: {} as Record<string, number>,
    byDepartment: {} as Record<string, number>,
  };

  for (const ruling of rulings) {
    // Count by outcome
    stats.byOutcome[ruling.outcome as RulingOutcome] = (stats.byOutcome[ruling.outcome as RulingOutcome] || 0) + 1;

    // Count by motion type
    stats.byMotionType[ruling.motionType] = (stats.byMotionType[ruling.motionType] || 0) + 1;

    // Count by department
    stats.byDepartment[ruling.department] = (stats.byDepartment[ruling.department] || 0) + 1;
  }

  return stats;
}
