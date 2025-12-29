/**
 * SF Superior Court Scraper
 * Main scraper class for San Francisco Superior Court
 */

import { BaseCrawler, type BaseCrawlerOptions } from '../BaseCrawler';
import type { CaseInfo, CaseNumber, CourtInfo, RulingInfo, HearingInfo, DocumentInfo, ScrapeResult } from '../types';
import { ParseError, CaseNotFoundError } from '../errors';
import { logger } from '../../lib/logger';
import { SF_COURT_URLS, SF_COURT_BASE_URL } from './urls';
import { CASE_INFO_SELECTORS, CASE_SEARCH_SELECTORS, TENTATIVE_RULINGS_SELECTORS, CALENDAR_SELECTORS, COMMON_SELECTORS } from './selectors';
import { parseCaseNumber, validateCaseNumber, formatCaseNumber } from './caseNumber';
import { humanDelay } from '../camoufox';

/**
 * Safely parse a date string, returning null for invalid dates
 */
function parseDate(dateString: string | null | undefined): Date | null {
  if (!dateString || dateString.trim() === '') {
    return null;
  }

  // Clean up the date string
  const cleaned = dateString.trim();

  // Try parsing the date
  const date = new Date(cleaned);

  // Check if the date is valid (NaN check)
  if (isNaN(date.getTime())) {
    // Try common date formats
    const formats = [
      // MM/DD/YYYY
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      // YYYY-MM-DD
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
      // Month DD, YYYY
      /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/,
    ];

    for (const format of formats) {
      const match = cleaned.match(format);
      if (match) {
        let parsed: Date;
        if (format === formats[0]) {
          // MM/DD/YYYY
          parsed = new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
        } else if (format === formats[1]) {
          // YYYY-MM-DD
          parsed = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        } else {
          // Month DD, YYYY - use Date.parse which handles month names
          parsed = new Date(cleaned);
        }
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }

    logger.debug('Failed to parse date', { dateString: cleaned });
    return null;
  }

  return date;
}

/**
 * Safely parse a date, returning a default date if parsing fails
 */
function parseDateWithDefault(dateString: string | null | undefined, defaultDate: Date = new Date()): Date {
  const parsed = parseDate(dateString);
  return parsed ?? defaultDate;
}

/**
 * SF Court scraper configuration
 */
export interface SFCourtScraperConfig {
  maxRulingsPerPage?: number;
  maxDocumentsPerPage?: number;
  maxEventsPerPage?: number;
}

/**
 * SF Superior Court Scraper
 */
export class SFCourtScraper extends BaseCrawler {
  private scraperConfig: SFCourtScraperConfig;

  constructor(options: BaseCrawlerOptions, config: SFCourtScraperConfig = {}) {
    super(options);
    this.scraperConfig = {
      maxRulingsPerPage: config.maxRulingsPerPage || 100,
      maxDocumentsPerPage: config.maxDocumentsPerPage || 50,
      maxEventsPerPage: config.maxEventsPerPage || 50,
    };
  }

  /**
   * Get court information
   */
  getCourtInfo(): CourtInfo {
    return {
      id: 'sf-superior',
      name: 'San Francisco Superior Court',
      county: 'san-francisco',
      state: 'CA',
      type: 'superior',
      baseUrl: SF_COURT_BASE_URL,
      timezone: 'America/Los_Angeles',
    };
  }

  /**
   * Look up a case by case number
   */
  async lookupCase(caseNumber: string): Promise<ScrapeResult<CaseInfo>> {
    const validation = validateCaseNumber(caseNumber);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        errorCode: 'INVALID_CASE_NUMBER',
        duration: 0,
        retries: 0,
        timestamp: new Date(),
        sourceUrl: '',
      };
    }

    return this.withRetry(async () => {
      const formattedNumber = formatCaseNumber(caseNumber);

      // Navigate to case search page
      await this.navigate(SF_COURT_URLS.caseSearch, CASE_SEARCH_SELECTORS.form);

      // Fill in case number
      await this.typeText(CASE_SEARCH_SELECTORS.caseNumberInput, formattedNumber);

      // Submit form
      await this.click(CASE_SEARCH_SELECTORS.submitButton);

      // Wait for results
      await humanDelay(1000, 2000);

      // Check for "no results"
      const noResults = await this.getText(COMMON_SELECTORS.noResults);
      if (noResults) {
        throw new CaseNotFoundError(formattedNumber, 'sf-superior');
      }

      // Parse case information
      const caseInfo = await this.parseCaseInfo(validation.caseNumber!);

      logger.info('Case lookup completed', {
        caseNumber: formattedNumber,
        status: caseInfo.status,
      });

      return caseInfo;
    }, 'lookupCase');
  }

  /**
   * Search for cases by party name
   */
  async searchByPartyName(name: string, options?: {
    caseType?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
  }): Promise<ScrapeResult<CaseInfo[]>> {
    return this.withRetry(async () => {
      // Navigate to case search
      await this.navigate(SF_COURT_URLS.caseSearch, CASE_SEARCH_SELECTORS.form);

      // Fill in party name
      await this.typeText(CASE_SEARCH_SELECTORS.partyNameInput, name);

      // Fill in optional filters
      if (options?.caseType) {
        await this.page!.selectOption(CASE_SEARCH_SELECTORS.caseTypeSelect, options.caseType);
      }

      if (options?.dateFrom) {
        await this.typeText(CASE_SEARCH_SELECTORS.dateFromInput, options.dateFrom.toISOString().split('T')[0]);
      }

      if (options?.dateTo) {
        await this.typeText(CASE_SEARCH_SELECTORS.dateToInput, options.dateTo.toISOString().split('T')[0]);
      }

      // Submit form
      await this.click(CASE_SEARCH_SELECTORS.submitButton);

      // Wait for results
      await humanDelay(1000, 2000);

      // Parse results
      const cases = await this.parseSearchResults(options?.limit || 50);

      logger.info('Party search completed', {
        name,
        resultsCount: cases.length,
      });

      return cases;
    }, 'searchByPartyName');
  }

  /**
   * Get tentative rulings for a date
   */
  async getTentativeRulings(date: Date): Promise<ScrapeResult<RulingInfo[]>> {
    return this.withRetry(async () => {
      const dateStr = date.toISOString().split('T')[0];
      const url = SF_COURT_URLS.tentativeRulingsByDate(dateStr);

      // Navigate to rulings page
      await this.navigate(url, TENTATIVE_RULINGS_SELECTORS.rulingsContainer);

      // Parse all rulings
      const rulings = await this.parseRulings(date);

      logger.info('Tentative rulings retrieved', {
        date: dateStr,
        count: rulings.length,
      });

      return rulings;
    }, 'getTentativeRulings');
  }

  /**
   * Get case calendar/events
   */
  async getCaseCalendar(caseNumber: string): Promise<ScrapeResult<HearingInfo[]>> {
    const validation = validateCaseNumber(caseNumber);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        errorCode: 'INVALID_CASE_NUMBER',
        duration: 0,
        retries: 0,
        timestamp: new Date(),
        sourceUrl: '',
      };
    }

    return this.withRetry(async () => {
      // First look up the case to get to its page
      await this.lookupCase(caseNumber);

      // Navigate to calendar tab/section if separate
      const calendarLink = await this.getAttribute('a[href*="calendar"]', 'href');
      if (calendarLink) {
        await this.navigate(calendarLink);
      }

      // Parse calendar events
      const events = await this.parseCalendarEvents();

      logger.info('Case calendar retrieved', {
        caseNumber,
        eventsCount: events.length,
      });

      return events;
    }, 'getCaseCalendar');
  }

  /**
   * Get documents for a case
   */
  async getDocuments(caseNumber: string): Promise<ScrapeResult<DocumentInfo[]>> {
    const validation = validateCaseNumber(caseNumber);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        errorCode: 'INVALID_CASE_NUMBER',
        duration: 0,
        retries: 0,
        timestamp: new Date(),
        sourceUrl: '',
      };
    }

    return this.withRetry(async () => {
      // First look up the case
      await this.lookupCase(caseNumber);

      // Navigate to documents tab/section
      const docsLink = await this.getAttribute('a[href*="document"]', 'href');
      if (docsLink) {
        await this.navigate(docsLink);
      }

      // Parse document list
      const documents = await this.parseDocumentList(validation.caseNumber!);

      logger.info('Case documents retrieved', {
        caseNumber,
        documentsCount: documents.length,
      });

      return documents;
    }, 'getDocuments');
  }

  /**
   * Parse case information from current page
   */
  private async parseCaseInfo(caseNumber: CaseNumber): Promise<CaseInfo> {
    const caseTitle = await this.getText(CASE_INFO_SELECTORS.caseTitle);
    const caseStatus = await this.getText(CASE_INFO_SELECTORS.caseStatus);
    const caseType = await this.getText(CASE_INFO_SELECTORS.caseType);
    const filedDateStr = await this.getText(CASE_INFO_SELECTORS.filedDate);
    const department = await this.getText(CASE_INFO_SELECTORS.department);
    const judge = await this.getText(CASE_INFO_SELECTORS.judge);

    if (!caseTitle) {
      throw new ParseError('Could not parse case title', this.page?.url() || '', CASE_INFO_SELECTORS.caseTitle);
    }

    // Parse parties
    const parties = await this.parseParties();

    // Parse filed date safely (handles invalid date strings)
    const filedDate = parseDateWithDefault(filedDateStr, new Date());

    // Map status
    let status: CaseInfo['status'] = 'open';
    if (caseStatus?.toLowerCase().includes('closed')) status = 'closed';
    else if (caseStatus?.toLowerCase().includes('disposed')) status = 'disposed';
    else if (caseStatus?.toLowerCase().includes('pending')) status = 'pending';

    return {
      caseNumber,
      courtId: 'sf-superior',
      title: caseTitle.trim(),
      caseType: caseType?.trim() || 'Unknown',
      status,
      filedDate,
      department: department?.trim(),
      judge: judge?.trim(),
      parties,
      lastUpdated: new Date(),
    };
  }

  /**
   * Parse parties from current page
   */
  private async parseParties(): Promise<CaseInfo['parties']> {
    const parties: CaseInfo['parties'] = [];

    if (!this.page) return parties;

    const partyRows = await this.page.$$(CASE_INFO_SELECTORS.partyRow);

    for (const row of partyRows) {
      try {
        const name = await row.$eval(CASE_INFO_SELECTORS.partyName, el => el.textContent?.trim());
        const typeText = await row.$eval(CASE_INFO_SELECTORS.partyType, el => el.textContent?.trim()).catch(() => null);

        if (!name) continue;

        // Determine party type
        let type: CaseInfo['parties'][0]['type'] = 'plaintiff';
        if (typeText) {
          const lower = typeText.toLowerCase();
          if (lower.includes('defendant')) type = 'defendant';
          else if (lower.includes('petitioner')) type = 'petitioner';
          else if (lower.includes('respondent')) type = 'respondent';
          else if (lower.includes('cross-complainant')) type = 'cross-complainant';
          else if (lower.includes('cross-defendant')) type = 'cross-defendant';
        }

        parties.push({
          name,
          type,
          isLead: parties.filter(p => p.type === type).length === 0,
        });
      } catch {
        // Skip unparseable rows
      }
    }

    return parties;
  }

  /**
   * Parse search results
   */
  private async parseSearchResults(limit: number): Promise<CaseInfo[]> {
    const cases: CaseInfo[] = [];

    if (!this.page) return cases;

    const rows = await this.page.$$(COMMON_SELECTORS.tableRow);

    for (const row of rows.slice(0, limit)) {
      try {
        const caseNumberText = await row.$eval('td:first-child', el => el.textContent?.trim());
        if (!caseNumberText) continue;

        const validation = validateCaseNumber(caseNumberText);
        if (!validation.valid) continue;

        const title = await row.$eval('td:nth-child(2)', el => el.textContent?.trim()).catch(() => 'Unknown');
        const type = await row.$eval('td:nth-child(3)', el => el.textContent?.trim()).catch(() => 'Unknown');
        const status = await row.$eval('td:nth-child(4)', el => el.textContent?.trim()).catch(() => 'open');

        cases.push({
          caseNumber: validation.caseNumber!,
          courtId: 'sf-superior',
          title: title || 'Unknown',
          caseType: type || 'Unknown',
          status: status?.toLowerCase().includes('closed') ? 'closed' : 'open',
          filedDate: new Date(),
          parties: [],
          lastUpdated: new Date(),
        });
      } catch {
        // Skip unparseable rows
      }
    }

    return cases;
  }

  /**
   * Parse tentative rulings
   */
  private async parseRulings(date: Date): Promise<RulingInfo[]> {
    const rulings: RulingInfo[] = [];

    if (!this.page) return rulings;

    const rulingCards = await this.page.$$(TENTATIVE_RULINGS_SELECTORS.rulingCard);

    for (const card of rulingCards.slice(0, this.scraperConfig.maxRulingsPerPage)) {
      try {
        const caseNumberText = await card.$eval(TENTATIVE_RULINGS_SELECTORS.rulingCaseNumber, el => el.textContent?.trim());
        if (!caseNumberText) continue;

        const validation = validateCaseNumber(caseNumberText);
        if (!validation.valid) continue;

        const department = await card.$eval(TENTATIVE_RULINGS_SELECTORS.rulingDepartment, el => el.textContent?.trim()).catch(() => 'Unknown');
        const judge = await card.$eval(TENTATIVE_RULINGS_SELECTORS.rulingJudge, el => el.textContent?.trim()).catch(() => 'Unknown');
        const motionType = await card.$eval(TENTATIVE_RULINGS_SELECTORS.rulingMotionType, el => el.textContent?.trim()).catch(() => 'Unknown');
        const outcomeText = await card.$eval(TENTATIVE_RULINGS_SELECTORS.rulingOutcome, el => el.textContent?.trim()).catch(() => null);
        const text = await card.$eval(TENTATIVE_RULINGS_SELECTORS.rulingText, el => el.textContent?.trim()).catch(() => '');

        // Parse outcome
        let outcome: RulingInfo['outcome'] = 'other';
        if (outcomeText) {
          const lower = outcomeText.toLowerCase();
          if (lower.includes('granted')) outcome = 'granted';
          else if (lower.includes('denied')) outcome = 'denied';
          else if (lower.includes('continued')) outcome = 'continued';
          else if (lower.includes('moot')) outcome = 'moot';
          else if (lower.includes('under submission')) outcome = 'taken_under_submission';
        }

        rulings.push({
          id: crypto.randomUUID(),
          caseNumber: validation.caseNumber!,
          rulingDate: date,
          hearingDate: date,
          department: department || 'Unknown',
          judge: judge || 'Unknown',
          motionType: motionType || 'Unknown',
          rulingType: 'tentative',
          outcome,
          text: text || '',
          scrapedAt: new Date(),
          sourceUrl: this.page.url(),
        });
      } catch {
        // Skip unparseable rulings
      }
    }

    return rulings;
  }

  /**
   * Parse calendar events
   */
  private async parseCalendarEvents(): Promise<HearingInfo[]> {
    const events: HearingInfo[] = [];

    if (!this.page) return events;

    const eventRows = await this.page.$$(CALENDAR_SELECTORS.calendarEvent);

    for (const row of eventRows.slice(0, this.scraperConfig.maxEventsPerPage)) {
      try {
        const dateText = await row.$eval(CALENDAR_SELECTORS.eventTime, el => el.textContent?.trim());
        const department = await row.$eval(CALENDAR_SELECTORS.eventDepartment, el => el.textContent?.trim()).catch(() => 'Unknown');
        const type = await row.$eval(CALENDAR_SELECTORS.eventType, el => el.textContent?.trim()).catch(() => 'Hearing');

        if (!dateText) continue;

        // Parse date/time safely
        const dateParts = dateText.split(/\s+/);
        const date = parseDate(dateParts[0]);
        const time = dateParts[1] || '9:00 AM';

        // Skip if date is invalid
        if (!date) continue;

        events.push({
          date,
          time,
          department: department || 'Unknown',
          type: type || 'Hearing',
        });
      } catch {
        // Skip unparseable events
      }
    }

    return events;
  }

  /**
   * Parse document list
   */
  private async parseDocumentList(caseNumber: CaseNumber): Promise<DocumentInfo[]> {
    const documents: DocumentInfo[] = [];

    if (!this.page) return documents;

    const docRows = await this.page.$$(CASE_INFO_SELECTORS.documentRow);

    for (const row of docRows.slice(0, this.scraperConfig.maxDocumentsPerPage)) {
      try {
        const title = await row.$eval(CASE_INFO_SELECTORS.documentTitle, el => el.textContent?.trim());
        const dateText = await row.$eval(CASE_INFO_SELECTORS.documentDate, el => el.textContent?.trim()).catch(() => null);
        const url = await row.$eval(CASE_INFO_SELECTORS.documentLink, el => (el as HTMLAnchorElement).href).catch(() => undefined);

        if (!title) continue;

        documents.push({
          id: crypto.randomUUID(),
          caseNumber,
          title: title.trim(),
          filedDate: parseDateWithDefault(dateText, new Date()),
          documentType: this.inferDocumentType(title),
          url,
        });
      } catch {
        // Skip unparseable documents
      }
    }

    return documents;
  }

  /**
   * Infer document type from title
   */
  private inferDocumentType(title: string): string {
    const lower = title.toLowerCase();

    if (lower.includes('complaint')) return 'Complaint';
    if (lower.includes('answer')) return 'Answer';
    if (lower.includes('motion')) return 'Motion';
    if (lower.includes('order')) return 'Order';
    if (lower.includes('notice')) return 'Notice';
    if (lower.includes('proof of service')) return 'Proof of Service';
    if (lower.includes('declaration')) return 'Declaration';
    if (lower.includes('memorandum')) return 'Memorandum';
    if (lower.includes('exhibit')) return 'Exhibit';
    if (lower.includes('judgment')) return 'Judgment';
    if (lower.includes('stipulation')) return 'Stipulation';

    return 'Document';
  }
}

/**
 * Create SF Court scraper instance
 */
export function createSFCourtScraper(options: BaseCrawlerOptions, config?: SFCourtScraperConfig): SFCourtScraper {
  return new SFCourtScraper(options, config);
}
