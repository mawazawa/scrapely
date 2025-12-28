/**
 * SF Superior Court Case Number Validation
 * Validates and parses SF court case numbers
 */

import { z } from 'zod';
import { InvalidCaseNumberError } from '../errors';
import type { CaseNumber, SFCasePrefix } from '../types';

/**
 * Valid SF case prefixes with descriptions
 */
export const SF_CASE_PREFIXES: Record<SFCasePrefix, string> = {
  CGC: 'Civil General Complex',
  CNC: 'Civil Non-Complex',
  FDI: 'Family Dissolution',
  FDV: 'Family Domestic Violence',
  PRO: 'Probate',
  CRI: 'Criminal',
  JUV: 'Juvenile',
  TRF: 'Traffic',
  SMC: 'Small Claims',
};

/**
 * Case number regex patterns
 * Format: AAA-YY-###### or AAAYY######
 */
const CASE_NUMBER_PATTERNS = {
  // Standard format with dashes: CGC-24-123456
  dashed: /^([A-Z]{2,4})-(\d{2})-(\d{4,8})$/i,

  // Compact format without dashes: CGC24123456
  compact: /^([A-Z]{2,4})(\d{2})(\d{4,8})$/i,

  // Legacy format with spaces: CGC 24 123456
  spaced: /^([A-Z]{2,4})\s+(\d{2})\s+(\d{4,8})$/i,
};

/**
 * Normalize a case number to standard format
 */
export function normalizeCaseNumber(input: string): string {
  // Remove extra whitespace
  const cleaned = input.trim().toUpperCase();

  // Try each pattern
  for (const pattern of Object.values(CASE_NUMBER_PATTERNS)) {
    const match = cleaned.match(pattern);
    if (match) {
      const [, prefix, year, sequence] = match;
      return `${prefix}-${year}-${sequence.padStart(6, '0')}`;
    }
  }

  // Return cleaned input if no pattern matches
  return cleaned;
}

/**
 * Validate a case number format
 */
export function isValidCaseNumber(input: string): boolean {
  const normalized = normalizeCaseNumber(input);
  const match = normalized.match(CASE_NUMBER_PATTERNS.dashed);

  if (!match) return false;

  const [, prefix, year] = match;

  // Check prefix is valid
  if (!Object.keys(SF_CASE_PREFIXES).includes(prefix)) {
    return false;
  }

  // Check year is reasonable (not future, not too old)
  const yearNum = parseInt(year, 10);
  const currentYear = new Date().getFullYear() % 100;
  const minYear = (currentYear - 30 + 100) % 100; // 30 years back

  // Handle century wrap-around
  if (yearNum > currentYear && yearNum < minYear) {
    return false;
  }

  return true;
}

/**
 * Parse a case number into components
 */
export function parseCaseNumber(input: string): CaseNumber {
  const normalized = normalizeCaseNumber(input);
  const match = normalized.match(CASE_NUMBER_PATTERNS.dashed);

  if (!match) {
    throw new InvalidCaseNumberError(
      input,
      'AAA-YY-######',
      { normalized }
    );
  }

  const [, prefix, year, sequence] = match;

  if (!Object.keys(SF_CASE_PREFIXES).includes(prefix)) {
    throw new InvalidCaseNumberError(
      input,
      `Valid prefixes: ${Object.keys(SF_CASE_PREFIXES).join(', ')}`,
      { prefix }
    );
  }

  return {
    prefix,
    year: parseInt(year, 10),
    sequence,
    full: normalized,
  };
}

/**
 * Get the case type from a case number
 */
export function getCaseType(caseNumber: CaseNumber | string): string {
  const parsed = typeof caseNumber === 'string' ? parseCaseNumber(caseNumber) : caseNumber;
  return SF_CASE_PREFIXES[parsed.prefix as SFCasePrefix] || 'Unknown';
}

/**
 * Get the full year from 2-digit year
 */
export function getFullYear(twoDigitYear: number): number {
  const currentYear = new Date().getFullYear();
  const currentCentury = Math.floor(currentYear / 100) * 100;
  const currentTwoDigit = currentYear % 100;

  // If the year is greater than current, it's from the previous century
  if (twoDigitYear > currentTwoDigit + 1) {
    return currentCentury - 100 + twoDigitYear;
  }

  return currentCentury + twoDigitYear;
}

/**
 * Format a case number for display
 */
export function formatCaseNumber(caseNumber: CaseNumber | string): string {
  const parsed = typeof caseNumber === 'string' ? parseCaseNumber(caseNumber) : caseNumber;
  return parsed.full;
}

/**
 * Generate a case URL from case number
 */
export function getCaseUrl(caseNumber: CaseNumber | string, baseUrl: string): string {
  const parsed = typeof caseNumber === 'string' ? parseCaseNumber(caseNumber) : caseNumber;
  return `${baseUrl}/case/${encodeURIComponent(parsed.full)}`;
}

/**
 * Zod schema for case number validation
 */
export const CaseNumberInputSchema = z.string()
  .min(8, 'Case number too short')
  .max(20, 'Case number too long')
  .transform(normalizeCaseNumber)
  .refine(isValidCaseNumber, {
    message: 'Invalid SF Superior Court case number format. Expected: AAA-YY-######',
  });

/**
 * Validate case number with detailed error
 */
export function validateCaseNumber(input: string): {
  valid: boolean;
  caseNumber?: CaseNumber;
  error?: string;
} {
  try {
    const caseNumber = parseCaseNumber(input);
    return { valid: true, caseNumber };
  } catch (error) {
    if (error instanceof InvalidCaseNumberError) {
      return { valid: false, error: error.message };
    }
    return { valid: false, error: 'Invalid case number format' };
  }
}

/**
 * Extract case numbers from text
 */
export function extractCaseNumbers(text: string): CaseNumber[] {
  const results: CaseNumber[] = [];

  // Combined pattern for all formats
  const pattern = /\b([A-Z]{2,4})[-\s]?(\d{2})[-\s]?(\d{4,8})\b/gi;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    try {
      const caseNumber = parseCaseNumber(match[0]);
      results.push(caseNumber);
    } catch {
      // Skip invalid matches
    }
  }

  // Remove duplicates
  const seen = new Set<string>();
  return results.filter(cn => {
    if (seen.has(cn.full)) return false;
    seen.add(cn.full);
    return true;
  });
}

/**
 * Compare two case numbers
 */
export function compareCaseNumbers(a: CaseNumber | string, b: CaseNumber | string): number {
  const parsedA = typeof a === 'string' ? parseCaseNumber(a) : a;
  const parsedB = typeof b === 'string' ? parseCaseNumber(b) : b;

  // Compare by year first
  const yearA = getFullYear(parsedA.year);
  const yearB = getFullYear(parsedB.year);
  if (yearA !== yearB) return yearA - yearB;

  // Then by prefix
  if (parsedA.prefix !== parsedB.prefix) {
    return parsedA.prefix.localeCompare(parsedB.prefix);
  }

  // Then by sequence
  return parseInt(parsedA.sequence, 10) - parseInt(parsedB.sequence, 10);
}
