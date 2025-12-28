/**
 * SF Superior Court URLs
 * All endpoint URLs for San Francisco Superior Court
 */

/**
 * Base URLs
 */
export const SF_COURT_BASE_URL = 'https://sf.courts.ca.gov';
export const SF_COURT_ONLINE_SERVICES = `${SF_COURT_BASE_URL}/online-services`;

/**
 * Court service endpoints
 */
export const SF_COURT_URLS = {
  // Base
  home: SF_COURT_BASE_URL,
  onlineServices: SF_COURT_ONLINE_SERVICES,

  // Case Information
  caseInfo: `${SF_COURT_ONLINE_SERVICES}/case-information`,
  caseSearch: `${SF_COURT_ONLINE_SERVICES}/case-information/case-search`,
  caseLookup: `${SF_COURT_ONLINE_SERVICES}/case-information/case-lookup`,

  // Tentative Rulings
  tentativeRulings: `${SF_COURT_ONLINE_SERVICES}/tentative-rulings`,
  tentativeRulingsByDate: (date: string) => `${SF_COURT_ONLINE_SERVICES}/tentative-rulings?date=${date}`,
  tentativeRulingsByDepartment: (dept: string) => `${SF_COURT_ONLINE_SERVICES}/tentative-rulings?dept=${dept}`,

  // Calendars
  courtCalendars: `${SF_COURT_ONLINE_SERVICES}/court-calendars`,
  civilCalendar: `${SF_COURT_ONLINE_SERVICES}/court-calendars/civil`,
  familyCalendar: `${SF_COURT_ONLINE_SERVICES}/court-calendars/family`,
  probateCalendar: `${SF_COURT_ONLINE_SERVICES}/court-calendars/probate`,

  // E-Filing
  eFiling: `${SF_COURT_ONLINE_SERVICES}/e-filing`,

  // Forms
  forms: `${SF_COURT_BASE_URL}/forms`,

  // Contact
  contact: `${SF_COURT_BASE_URL}/contact`,

  // Help
  help: `${SF_COURT_BASE_URL}/help`,
} as const;

/**
 * API endpoints (if available)
 */
export const SF_COURT_API_URLS = {
  // Note: SF Court may not have public APIs
  // These are placeholder endpoints for future discovery
  caseSearch: `${SF_COURT_BASE_URL}/api/cases/search`,
  caseDetails: (caseNumber: string) => `${SF_COURT_BASE_URL}/api/cases/${caseNumber}`,
  rulings: (date: string) => `${SF_COURT_BASE_URL}/api/rulings/${date}`,
} as const;

/**
 * Form action URLs (discovered from page analysis)
 */
export const SF_COURT_FORM_ACTIONS = {
  caseSearch: '/online-services/case-information/results',
  partySearch: '/online-services/case-information/party-search/results',
} as const;

/**
 * Department information
 */
export const SF_COURT_DEPARTMENTS = {
  // Civil departments
  civil: ['301', '302', '303', '304', '305', '306', '307', '308', '309', '310'],

  // Family departments
  family: ['401', '402', '403', '404', '405', '406'],

  // Probate departments
  probate: ['501', '502', '503', '504'],

  // Complex civil (specific judges)
  complexCivil: ['304', '305'],
} as const;

/**
 * Court locations
 */
export const SF_COURT_LOCATIONS = {
  main: {
    name: 'Civic Center Courthouse',
    address: '400 McAllister Street, San Francisco, CA 94102',
    phone: '(415) 551-4000',
  },
  hallOfJustice: {
    name: 'Hall of Justice',
    address: '850 Bryant Street, San Francisco, CA 94103',
    phone: '(415) 551-4000',
  },
} as const;

/**
 * Build URL with query parameters
 */
export function buildUrl(base: string, params: Record<string, string | number | undefined>): string {
  const url = new URL(base);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

/**
 * Get case lookup URL
 */
export function getCaseLookupUrl(caseNumber: string): string {
  return buildUrl(SF_COURT_URLS.caseLookup, { caseNumber });
}

/**
 * Get tentative rulings URL for a specific date
 */
export function getTentativeRulingsUrl(date: Date): string {
  const dateStr = date.toISOString().split('T')[0];
  return SF_COURT_URLS.tentativeRulingsByDate(dateStr);
}

/**
 * Get calendar URL for a department
 */
export function getDepartmentCalendarUrl(department: string, date?: Date): string {
  const params: Record<string, string> = { dept: department };
  if (date) {
    params.date = date.toISOString().split('T')[0];
  }
  return buildUrl(SF_COURT_URLS.courtCalendars, params);
}
