/**
 * SF Superior Court Scraping Module
 * Exports for San Francisco Superior Court scraping
 */

// Main scraper
export { SFCourtScraper, createSFCourtScraper, type SFCourtScraperConfig } from './SFCourtScraper';

// URLs and endpoints
export {
  SF_COURT_BASE_URL,
  SF_COURT_URLS,
  SF_COURT_API_URLS,
  SF_COURT_FORM_ACTIONS,
  SF_COURT_DEPARTMENTS,
  SF_COURT_LOCATIONS,
  buildUrl,
  getCaseLookupUrl,
  getTentativeRulingsUrl,
  getDepartmentCalendarUrl,
} from './urls';

// CSS selectors
export {
  COMMON_SELECTORS,
  CASE_SEARCH_SELECTORS,
  CASE_INFO_SELECTORS,
  TENTATIVE_RULINGS_SELECTORS,
  CALENDAR_SELECTORS,
  DOCUMENT_SELECTORS,
  SECURITY_SELECTORS,
  combineSelectors,
  getSelector,
} from './selectors';

// Case number utilities
export {
  SF_CASE_PREFIXES,
  normalizeCaseNumber,
  isValidCaseNumber,
  parseCaseNumber,
  getCaseType,
  getFullYear,
  formatCaseNumber,
  getCaseUrl,
  CaseNumberInputSchema,
  validateCaseNumber,
  extractCaseNumbers,
  compareCaseNumbers,
} from './caseNumber';

// Tentative rulings
export {
  RULING_OUTCOMES,
  MOTION_TYPES,
  type RulingOutcome,
  type MotionType,
  type RawRulingData,
  RulingSchema,
  parseRulingOutcome,
  normalizeMotionType,
  cleanRulingText,
  extractPartiesFromText,
  parseRulingDate,
  transformRuling,
  groupRulingsByCase,
  groupRulingsByDepartment,
  getRulingsUrl,
  getRulingsDateRange,
  isWithinRulingHours,
  calculateRulingStats,
} from './tentativeRulings';

// Session management
export {
  SF_COURT_COOKIES,
  type SessionValidation,
  validateSession,
  filterCourtCookies,
  mergeSessionCookies,
  createSessionData,
  extendSession,
  invalidateSession,
  type SessionStorage,
  KVSessionStorage,
  MemorySessionStorage,
  createSessionStorage,
} from './session';

// Health checks
export {
  type HealthCheckResult,
  type HealthCheckItem,
  checkWebsiteAccessibility,
  checkCloudflareStatus,
  checkTentativeRulingsAccess,
  checkCaseSearchAccess,
  checkSessionValidity,
  checkRateLimitStatus,
  checkMetricsHealth,
  runHealthCheck,
  formatHealthCheckResult,
} from './health';

// Register SF Court scraper with factory
import { registerCrawler } from '../CrawlerFactory';
import { SFCourtScraper } from './SFCourtScraper';

// Auto-register when module is imported
registerCrawler('sf-superior', SFCourtScraper);
