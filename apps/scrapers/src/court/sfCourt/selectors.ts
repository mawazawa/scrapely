/**
 * SF Superior Court Page Selectors
 * CSS selectors for extracting data from court pages
 */

/**
 * Common page elements
 */
export const COMMON_SELECTORS = {
  // Page structure
  mainContent: '#main-content, .main-content, main',
  pageTitle: 'h1, .page-title',
  breadcrumb: '.breadcrumb, nav[aria-label="breadcrumb"]',

  // Error messages
  errorMessage: '.error-message, .alert-danger, .error',
  noResults: '.no-results, .empty-state',

  // Loading indicators
  loading: '.loading, .spinner, [aria-busy="true"]',

  // Pagination
  pagination: '.pagination, .pager',
  paginationNext: '.pagination .next, .pagination-next, a[rel="next"]',
  paginationPrev: '.pagination .prev, .pagination-prev, a[rel="prev"]',
  paginationPage: '.pagination .page-link, .pagination a[href*="page="]',

  // Forms
  searchForm: 'form#case-search, form.search-form',
  searchInput: 'input[type="search"], input[name="query"], input[name="caseNumber"]',
  searchButton: 'button[type="submit"], input[type="submit"]',

  // Tables
  dataTable: 'table.data-table, table.results-table, table',
  tableHeader: 'thead th, th',
  tableRow: 'tbody tr, tr:not(:first-child)',
  tableCell: 'td',
} as const;

/**
 * Case search form selectors
 */
export const CASE_SEARCH_SELECTORS = {
  form: 'form#case-search, form[action*="case"]',

  // Input fields
  caseNumberInput: 'input[name="caseNumber"], input#case-number, input[placeholder*="case number"]',
  partyNameInput: 'input[name="partyName"], input#party-name, input[placeholder*="party"]',
  dateFromInput: 'input[name="dateFrom"], input[type="date"][name*="from"]',
  dateToInput: 'input[name="dateTo"], input[type="date"][name*="to"]',

  // Case type filter
  caseTypeSelect: 'select[name="caseType"], select#case-type',
  caseTypeOptions: 'select[name="caseType"] option',

  // Submit button
  submitButton: 'button[type="submit"], input[type="submit"], button.search-button',

  // Results container
  resultsContainer: '.search-results, #results, .case-results',
} as const;

/**
 * Case information page selectors
 */
export const CASE_INFO_SELECTORS = {
  // Case header
  caseHeader: '.case-header, .case-info-header, h2',
  caseNumber: '.case-number, [data-field="caseNumber"], dt:contains("Case Number") + dd',
  caseTitle: '.case-title, [data-field="title"], dt:contains("Case Title") + dd',
  caseStatus: '.case-status, [data-field="status"], dt:contains("Status") + dd',
  caseType: '.case-type, [data-field="type"], dt:contains("Case Type") + dd',

  // Filing information
  filedDate: '.filed-date, [data-field="filedDate"], dt:contains("Filed") + dd',
  dispositionDate: '.disposition-date, [data-field="dispositionDate"]',

  // Court assignment
  department: '.department, [data-field="department"], dt:contains("Department") + dd',
  judge: '.judge, [data-field="judge"], dt:contains("Judge") + dd',
  clerk: '.clerk, [data-field="clerk"]',

  // Parties section
  partiesSection: '.parties-section, #parties, .party-list',
  partyRow: '.party-row, .party, tr[data-party]',
  partyName: '.party-name, [data-field="partyName"]',
  partyType: '.party-type, [data-field="partyType"]',

  // Attorneys section
  attorneysSection: '.attorneys-section, #attorneys, .attorney-list',
  attorneyRow: '.attorney-row, .attorney, tr[data-attorney]',
  attorneyName: '.attorney-name, [data-field="attorneyName"]',
  attorneyBar: '.bar-number, [data-field="barNumber"]',
  attorneyFirm: '.firm-name, [data-field="firm"]',

  // Events/Calendar section
  eventsSection: '.events-section, #events, .case-events',
  eventRow: '.event-row, .event, tr[data-event]',
  eventDate: '.event-date, [data-field="eventDate"]',
  eventType: '.event-type, [data-field="eventType"]',
  eventDescription: '.event-description, [data-field="description"]',

  // Documents section
  documentsSection: '.documents-section, #documents, .case-documents',
  documentRow: '.document-row, .document, tr[data-document]',
  documentTitle: '.document-title, [data-field="documentTitle"]',
  documentDate: '.document-date, [data-field="filedDate"]',
  documentLink: 'a[href*="document"], a.document-link',
} as const;

/**
 * Tentative rulings page selectors
 */
export const TENTATIVE_RULINGS_SELECTORS = {
  // Page structure
  rulingsContainer: '.rulings-container, #tentative-rulings, .rulings-list',
  dateSelector: '.date-selector, input[type="date"], select[name="date"]',
  departmentFilter: '.department-filter, select[name="department"]',

  // Individual ruling
  rulingCard: '.ruling-card, .ruling, .ruling-item, article',
  rulingHeader: '.ruling-header, h3, h4',
  rulingBody: '.ruling-body, .ruling-content, .ruling-text',

  // Ruling fields
  rulingCaseNumber: '.ruling-case-number, [data-field="caseNumber"]',
  rulingCaseTitle: '.ruling-case-title, [data-field="caseTitle"]',
  rulingDepartment: '.ruling-department, [data-field="department"]',
  rulingJudge: '.ruling-judge, [data-field="judge"]',
  rulingHearingDate: '.ruling-hearing-date, [data-field="hearingDate"]',
  rulingMotionType: '.ruling-motion-type, [data-field="motionType"]',
  rulingOutcome: '.ruling-outcome, [data-field="outcome"]',
  rulingText: '.ruling-text, .ruling-content, [data-field="rulingText"]',

  // Date navigation
  prevDate: '.prev-date, a[href*="date="][rel="prev"]',
  nextDate: '.next-date, a[href*="date="][rel="next"]',
  currentDate: '.current-date, .selected-date',
} as const;

/**
 * Calendar page selectors
 */
export const CALENDAR_SELECTORS = {
  // Calendar container
  calendarContainer: '.calendar-container, #calendar, .court-calendar',
  datePicker: '.date-picker, input[type="date"]',
  departmentSelector: 'select[name="department"], .department-selector',

  // Calendar events
  calendarEvent: '.calendar-event, .hearing, tr.hearing',
  eventTime: '.event-time, [data-field="time"]',
  eventDepartment: '.event-department, [data-field="department"]',
  eventCaseNumber: '.event-case-number, [data-field="caseNumber"]',
  eventType: '.event-type, [data-field="hearingType"]',
  eventParties: '.event-parties, [data-field="parties"]',

  // View controls
  dayView: '.day-view, a[href*="view=day"]',
  weekView: '.week-view, a[href*="view=week"]',
  monthView: '.month-view, a[href*="view=month"]',
} as const;

/**
 * Document viewer selectors
 */
export const DOCUMENT_SELECTORS = {
  documentViewer: '.document-viewer, #document-viewer, iframe.document',
  documentTitle: '.document-title, h1',
  documentMeta: '.document-meta, .document-info',
  downloadButton: 'a.download, button.download, a[href*="download"]',
  printButton: 'button.print, a.print',
} as const;

/**
 * Cloudflare/Security selectors
 */
export const SECURITY_SELECTORS = {
  // Cloudflare challenge
  cloudflareChallenge: '#challenge-running, #cf-challenge-running',
  turnstileWidget: 'iframe[src*="challenges.cloudflare.com"], .cf-turnstile',
  captcha: '.g-recaptcha, .h-captcha, [data-sitekey]',

  // Session/CSRF
  csrfToken: 'input[name="_token"], input[name="csrf_token"], meta[name="csrf-token"]',
  sessionExpired: '.session-expired, .login-required',

  // Access denied
  accessDenied: '.access-denied, .unauthorized',
  loginForm: 'form#login, form.login-form',
} as const;

/**
 * Build a selector string from an array
 */
export function combineSelectors(...selectors: string[]): string {
  return selectors.filter(Boolean).join(', ');
}

/**
 * Get selector with fallbacks
 */
export function getSelector(primary: string, ...fallbacks: string[]): string {
  return combineSelectors(primary, ...fallbacks);
}
