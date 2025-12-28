/**
 * Court Scraping Types
 * Type definitions for court data scraping infrastructure
 */

import { z } from 'zod';

/**
 * Supported court types
 */
export type CourtType = 'superior' | 'appellate' | 'supreme' | 'federal';

/**
 * California county codes
 */
export type CaliforniaCounty =
  | 'san-francisco'
  | 'los-angeles'
  | 'san-diego'
  | 'alameda'
  | 'orange'
  | 'santa-clara'
  | 'riverside'
  | 'san-bernardino';

/**
 * Case type prefixes for SF Superior Court
 */
export type SFCasePrefix =
  | 'CGC'   // Civil General Complex
  | 'CNC'   // Civil Non-Complex
  | 'FDI'   // Family Dissolution
  | 'FDV'   // Family Domestic Violence
  | 'PRO'   // Probate
  | 'CRI'   // Criminal
  | 'JUV'   // Juvenile
  | 'TRF'   // Traffic
  | 'SMC';  // Small Claims

/**
 * Scrape status
 */
export type ScrapeStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'rate_limited'
  | 'blocked';

/**
 * Court information
 */
export interface CourtInfo {
  id: string;
  name: string;
  county: CaliforniaCounty;
  state: string;
  type: CourtType;
  baseUrl: string;
  timezone: string;
}

/**
 * Case number schema
 */
export const CaseNumberSchema = z.object({
  prefix: z.string().min(2).max(4),
  year: z.number().min(0).max(99),
  sequence: z.string().min(1).max(10),
  full: z.string(),
});

export type CaseNumber = z.infer<typeof CaseNumberSchema>;

/**
 * Party in a case
 */
export interface CaseParty {
  name: string;
  type: 'plaintiff' | 'defendant' | 'petitioner' | 'respondent' | 'cross-complainant' | 'cross-defendant';
  isLead: boolean;
  attorneys?: AttorneyInfo[];
}

/**
 * Attorney information
 */
export interface AttorneyInfo {
  name: string;
  barNumber?: string;
  firm?: string;
  phone?: string;
  email?: string;
  address?: string;
  isLeadCounsel: boolean;
}

/**
 * Case information
 */
export interface CaseInfo {
  caseNumber: CaseNumber;
  courtId: string;
  title: string;
  caseType: string;
  caseSubType?: string;
  status: 'open' | 'closed' | 'pending' | 'disposed';
  filedDate: Date;
  dispositionDate?: Date;
  department?: string;
  judge?: string;
  parties: CaseParty[];
  lastUpdated: Date;
  nextHearing?: HearingInfo;
}

/**
 * Hearing information
 */
export interface HearingInfo {
  date: Date;
  time: string;
  department: string;
  judge?: string;
  type: string;
  description?: string;
  location?: string;
}

/**
 * Ruling information
 */
export interface RulingInfo {
  id: string;
  caseNumber: CaseNumber;
  rulingDate: Date;
  hearingDate: Date;
  department: string;
  judge: string;
  motionType: string;
  rulingType: 'tentative' | 'final';
  outcome: 'granted' | 'denied' | 'continued' | 'moot' | 'taken_under_submission' | 'other';
  text: string;
  movingParty?: string;
  respondingParty?: string;
  scrapedAt: Date;
  sourceUrl: string;
}

/**
 * Document information
 */
export interface DocumentInfo {
  id: string;
  caseNumber: CaseNumber;
  title: string;
  description?: string;
  filedDate: Date;
  filedBy?: string;
  documentType: string;
  pageCount?: number;
  fileSize?: number;
  url?: string;
  ocrText?: string;
}

/**
 * Case event (calendar entry)
 */
export interface CaseEvent {
  id: string;
  caseNumber: CaseNumber;
  eventType: string;
  eventDate: Date;
  description: string;
  department?: string;
  judge?: string;
  result?: string;
}

/**
 * Scrape result
 */
export interface ScrapeResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  duration: number;
  retries: number;
  timestamp: Date;
  sourceUrl: string;
}

/**
 * Crawler configuration
 */
export interface CrawlerConfig {
  maxConcurrency: number;
  maxRequestsPerMinute: number;
  requestTimeout: number;
  retryCount: number;
  retryDelayMs: number;
  proxyUrl?: string;
  userAgent?: string;
  sessionPersistence: boolean;
  headless: boolean;
}

/**
 * Proxy configuration
 */
export interface ProxyConfig {
  url: string;
  username?: string;
  password?: string;
  type: 'http' | 'https' | 'socks5';
  location?: string;
  isResidential: boolean;
}

/**
 * Session data for persistence
 */
export interface SessionData {
  id: string;
  courtId: string;
  cookies: Record<string, string>[];
  localStorage?: Record<string, string>;
  createdAt: Date;
  expiresAt: Date;
  isValid: boolean;
}

/**
 * Cloudflare challenge result
 */
export interface CloudflareResult {
  success: boolean;
  cookies: Record<string, string>[];
  userAgent: string;
  challengeType?: 'turnstile' | 'managed' | 'js_challenge';
  duration: number;
  error?: string;
}

/**
 * Rate limit info
 */
export interface RateLimitInfo {
  domain: string;
  requestCount: number;
  windowStart: Date;
  isBlocked: boolean;
  nextAllowedRequest: Date;
  maxRequestsPerWindow: number;
  windowSizeMs: number;
}

/**
 * Scrape job
 */
export interface ScrapeJob {
  id: string;
  type: 'case_lookup' | 'tentative_rulings' | 'case_calendar' | 'documents' | 'party_search';
  courtId: string;
  target: string;  // Case number, date, or search term
  priority: number;
  status: ScrapeStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  retryCount: number;
  maxRetries: number;
  result?: unknown;
}

/**
 * Court scraper metrics
 */
export interface ScraperMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  blockedRequests: number;
  averageResponseTime: number;
  cloudflareBypasses: number;
  cloudflareFailures: number;
  lastRequestAt?: Date;
}

/**
 * Default crawler configuration
 */
export const DEFAULT_CRAWLER_CONFIG: CrawlerConfig = {
  maxConcurrency: 1,
  maxRequestsPerMinute: 1,
  requestTimeout: 60000,
  retryCount: 3,
  retryDelayMs: 5000,
  sessionPersistence: true,
  headless: true,
};
