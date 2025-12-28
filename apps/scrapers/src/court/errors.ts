/**
 * Court Scraper Errors
 * Custom error classes for court scraping operations
 */

/**
 * Error codes for court scraping
 */
export enum CourtScraperErrorCode {
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',

  // Cloudflare errors
  CLOUDFLARE_CHALLENGE = 'CLOUDFLARE_CHALLENGE',
  CLOUDFLARE_BLOCKED = 'CLOUDFLARE_BLOCKED',
  CLOUDFLARE_TIMEOUT = 'CLOUDFLARE_TIMEOUT',
  TURNSTILE_FAILED = 'TURNSTILE_FAILED',

  // Rate limiting
  RATE_LIMITED = 'RATE_LIMITED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

  // Court-specific
  CASE_NOT_FOUND = 'CASE_NOT_FOUND',
  INVALID_CASE_NUMBER = 'INVALID_CASE_NUMBER',
  COURT_UNAVAILABLE = 'COURT_UNAVAILABLE',
  MAINTENANCE_MODE = 'MAINTENANCE_MODE',

  // Session errors
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_INVALID = 'SESSION_INVALID',

  // Parsing errors
  PARSE_ERROR = 'PARSE_ERROR',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  MISSING_DATA = 'MISSING_DATA',

  // Browser errors
  BROWSER_CRASH = 'BROWSER_CRASH',
  BROWSER_TIMEOUT = 'BROWSER_TIMEOUT',
  PAGE_LOAD_ERROR = 'PAGE_LOAD_ERROR',

  // Proxy errors
  PROXY_ERROR = 'PROXY_ERROR',
  PROXY_AUTH_FAILED = 'PROXY_AUTH_FAILED',

  // General
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Base court scraper error
 */
export class CourtScraperError extends Error {
  readonly code: CourtScraperErrorCode;
  readonly isRetryable: boolean;
  readonly context?: Record<string, unknown>;
  readonly timestamp: Date;

  constructor(
    message: string,
    code: CourtScraperErrorCode,
    options?: {
      isRetryable?: boolean;
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'CourtScraperError';
    this.code = code;
    this.isRetryable = options?.isRetryable ?? this.determineRetryable(code);
    this.context = options?.context;
    this.timestamp = new Date();

    if (options?.cause) {
      this.cause = options.cause;
    }

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CourtScraperError);
    }
  }

  private determineRetryable(code: CourtScraperErrorCode): boolean {
    const retryableCodes: CourtScraperErrorCode[] = [
      CourtScraperErrorCode.NETWORK_ERROR,
      CourtScraperErrorCode.TIMEOUT,
      CourtScraperErrorCode.CLOUDFLARE_CHALLENGE,
      CourtScraperErrorCode.CLOUDFLARE_TIMEOUT,
      CourtScraperErrorCode.RATE_LIMITED,
      CourtScraperErrorCode.SESSION_EXPIRED,
      CourtScraperErrorCode.BROWSER_TIMEOUT,
      CourtScraperErrorCode.PROXY_ERROR,
    ];
    return retryableCodes.includes(code);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      isRetryable: this.isRetryable,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}

/**
 * Cloudflare challenge error
 */
export class CloudflareError extends CourtScraperError {
  readonly challengeType: 'turnstile' | 'managed' | 'js_challenge' | 'unknown';

  constructor(
    message: string,
    challengeType: 'turnstile' | 'managed' | 'js_challenge' | 'unknown',
    context?: Record<string, unknown>
  ) {
    super(message, CourtScraperErrorCode.CLOUDFLARE_CHALLENGE, {
      isRetryable: true,
      context: { ...context, challengeType },
    });
    this.name = 'CloudflareError';
    this.challengeType = challengeType;
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends CourtScraperError {
  readonly retryAfterMs: number;
  readonly domain: string;

  constructor(
    message: string,
    domain: string,
    retryAfterMs: number,
    context?: Record<string, unknown>
  ) {
    super(message, CourtScraperErrorCode.RATE_LIMITED, {
      isRetryable: true,
      context: { ...context, domain, retryAfterMs },
    });
    this.name = 'RateLimitError';
    this.domain = domain;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Case not found error
 */
export class CaseNotFoundError extends CourtScraperError {
  readonly caseNumber: string;
  readonly courtId: string;

  constructor(caseNumber: string, courtId: string, context?: Record<string, unknown>) {
    super(
      `Case ${caseNumber} not found in court ${courtId}`,
      CourtScraperErrorCode.CASE_NOT_FOUND,
      { isRetryable: false, context: { ...context, caseNumber, courtId } }
    );
    this.name = 'CaseNotFoundError';
    this.caseNumber = caseNumber;
    this.courtId = courtId;
  }
}

/**
 * Invalid case number error
 */
export class InvalidCaseNumberError extends CourtScraperError {
  readonly caseNumber: string;
  readonly expectedFormat: string;

  constructor(caseNumber: string, expectedFormat: string, context?: Record<string, unknown>) {
    super(
      `Invalid case number format: ${caseNumber}. Expected format: ${expectedFormat}`,
      CourtScraperErrorCode.INVALID_CASE_NUMBER,
      { isRetryable: false, context: { ...context, caseNumber, expectedFormat } }
    );
    this.name = 'InvalidCaseNumberError';
    this.caseNumber = caseNumber;
    this.expectedFormat = expectedFormat;
  }
}

/**
 * Parse error
 */
export class ParseError extends CourtScraperError {
  readonly sourceUrl: string;
  readonly selector?: string;

  constructor(
    message: string,
    sourceUrl: string,
    selector?: string,
    context?: Record<string, unknown>
  ) {
    super(message, CourtScraperErrorCode.PARSE_ERROR, {
      isRetryable: false,
      context: { ...context, sourceUrl, selector },
    });
    this.name = 'ParseError';
    this.sourceUrl = sourceUrl;
    this.selector = selector;
  }
}

/**
 * Session error
 */
export class SessionError extends CourtScraperError {
  readonly sessionId?: string;

  constructor(
    message: string,
    code: CourtScraperErrorCode.SESSION_EXPIRED | CourtScraperErrorCode.SESSION_INVALID,
    sessionId?: string,
    context?: Record<string, unknown>
  ) {
    super(message, code, {
      isRetryable: code === CourtScraperErrorCode.SESSION_EXPIRED,
      context: { ...context, sessionId },
    });
    this.name = 'SessionError';
    this.sessionId = sessionId;
  }
}

/**
 * Browser error
 */
export class BrowserError extends CourtScraperError {
  constructor(
    message: string,
    code: CourtScraperErrorCode.BROWSER_CRASH | CourtScraperErrorCode.BROWSER_TIMEOUT | CourtScraperErrorCode.PAGE_LOAD_ERROR,
    context?: Record<string, unknown>
  ) {
    super(message, code, {
      isRetryable: true,
      context,
    });
    this.name = 'BrowserError';
  }
}

/**
 * Wrap unknown errors
 */
export function wrapError(error: unknown, context?: Record<string, unknown>): CourtScraperError {
  if (error instanceof CourtScraperError) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Detect Cloudflare errors
    if (message.includes('cloudflare') || message.includes('turnstile')) {
      return new CloudflareError(error.message, 'unknown', context);
    }

    // Detect timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
      return new CourtScraperError(error.message, CourtScraperErrorCode.TIMEOUT, {
        isRetryable: true,
        context,
        cause: error,
      });
    }

    // Detect network errors
    if (message.includes('network') || message.includes('econnrefused') || message.includes('fetch')) {
      return new CourtScraperError(error.message, CourtScraperErrorCode.NETWORK_ERROR, {
        isRetryable: true,
        context,
        cause: error,
      });
    }

    return new CourtScraperError(error.message, CourtScraperErrorCode.UNKNOWN_ERROR, {
      context,
      cause: error,
    });
  }

  return new CourtScraperError(
    String(error),
    CourtScraperErrorCode.UNKNOWN_ERROR,
    { context }
  );
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof CourtScraperError) {
    return error.isRetryable;
  }
  return false;
}
