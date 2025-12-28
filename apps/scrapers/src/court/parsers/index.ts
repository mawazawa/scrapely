/**
 * Court Document Parsers
 * Exports for parsing court documents
 */

// Ruling parser
export {
  type RulingOutcome,
  type ParsedRuling,
  RulingSchema,
  parseOutcome,
  normalizeMotionType,
  cleanText,
  extractCaseNumber,
  extractJudgeName,
  extractParties,
  extractOrders,
  extractReasoning,
  parseDate,
  parseRuling,
  parseRulingsPage,
  diffRulings,
} from './rulingParser';

// Text cleaner
export {
  stripHtml,
  decodeHtmlEntities,
  normalizeWhitespace,
  removeCourtDocumentNoise,
  fixOcrErrors,
  standardizeCitations,
  extractSectionHeaders,
  cleanCourtDocument,
  truncateText,
  splitParagraphs,
  joinBrokenLines,
} from './textCleaner';
