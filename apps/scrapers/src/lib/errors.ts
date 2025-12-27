/**
 * Application error types for Meridian
 * Provides typed error handling with error codes and messages
 */

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'SCRAPE_FAILED'
  | 'OCR_FAILED'
  | 'LLM_FAILED'
  | 'DATABASE_ERROR'
  | 'NETWORK_ERROR'
  | 'EXTERNAL_API_ERROR'
  | 'INTERNAL_ERROR';

export interface ApplicationError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  cause?: Error;
}

export function createError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
  cause?: Error
): ApplicationError {
  return { code, message, details, cause };
}

// Pre-defined error factories
export const errors = {
  unauthorized: (message = 'Unauthorized access') =>
    createError('UNAUTHORIZED', message),

  rateLimited: (retryAfter?: number) =>
    createError('RATE_LIMITED', 'Too many requests', { retryAfter }),

  invalidInput: (field: string, reason: string) =>
    createError('INVALID_INPUT', `Invalid ${field}: ${reason}`, { field, reason }),

  notFound: (resource: string) =>
    createError('NOT_FOUND', `${resource} not found`, { resource }),

  scrapeFailed: (url: string, reason: string) =>
    createError('SCRAPE_FAILED', `Failed to scrape ${url}`, { url, reason }),

  ocrFailed: (provider: string, reason: string) =>
    createError('OCR_FAILED', `OCR failed with ${provider}`, { provider, reason }),

  llmFailed: (model: string, reason: string) =>
    createError('LLM_FAILED', `LLM call failed for ${model}`, { model, reason }),

  databaseError: (operation: string, cause?: Error) =>
    createError('DATABASE_ERROR', `Database ${operation} failed`, { operation }, cause),

  networkError: (url: string, cause?: Error) =>
    createError('NETWORK_ERROR', `Network request to ${url} failed`, { url }, cause),

  externalApiError: (service: string, status: number, message: string) =>
    createError('EXTERNAL_API_ERROR', `${service} API error: ${message}`, { service, status }),

  internal: (message: string, cause?: Error) =>
    createError('INTERNAL_ERROR', message, undefined, cause),
};

// HTTP status code mapping
export function getHttpStatus(code: ErrorCode): number {
  switch (code) {
    case 'UNAUTHORIZED':
      return 401;
    case 'RATE_LIMITED':
      return 429;
    case 'INVALID_INPUT':
      return 400;
    case 'NOT_FOUND':
      return 404;
    case 'SCRAPE_FAILED':
    case 'OCR_FAILED':
    case 'LLM_FAILED':
    case 'EXTERNAL_API_ERROR':
      return 502;
    case 'DATABASE_ERROR':
    case 'NETWORK_ERROR':
    case 'INTERNAL_ERROR':
    default:
      return 500;
  }
}

// Format error for API response
export function formatErrorResponse(error: ApplicationError): {
  error: { code: string; message: string; details?: Record<string, unknown> };
} {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details && { details: error.details }),
    },
  };
}

// Type guard for ApplicationError
export function isApplicationError(error: unknown): error is ApplicationError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as ApplicationError).code === 'string' &&
    typeof (error as ApplicationError).message === 'string'
  );
}

// Convert unknown error to ApplicationError
export function toApplicationError(error: unknown): ApplicationError {
  if (isApplicationError(error)) {
    return error;
  }
  if (error instanceof Error) {
    return errors.internal(error.message, error);
  }
  return errors.internal(String(error));
}
