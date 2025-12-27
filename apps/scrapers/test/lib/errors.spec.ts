import { describe, it, expect } from 'vitest';
import {
  createError,
  errors,
  getHttpStatus,
  formatErrorResponse,
  isApplicationError,
  toApplicationError,
} from '../../src/lib/errors';

describe('Error utilities', () => {
  describe('createError', () => {
    it('creates an error with code and message', () => {
      const error = createError('UNAUTHORIZED', 'Access denied');
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toBe('Access denied');
    });

    it('includes details when provided', () => {
      const error = createError('INVALID_INPUT', 'Bad data', { field: 'email' });
      expect(error.details).toEqual({ field: 'email' });
    });

    it('includes cause when provided', () => {
      const cause = new Error('Original error');
      const error = createError('INTERNAL_ERROR', 'Something broke', undefined, cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('error factories', () => {
    it('creates unauthorized error', () => {
      const error = errors.unauthorized();
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('creates rate limited error with retry info', () => {
      const error = errors.rateLimited(60);
      expect(error.code).toBe('RATE_LIMITED');
      expect(error.details?.retryAfter).toBe(60);
    });

    it('creates invalid input error with field info', () => {
      const error = errors.invalidInput('email', 'must be valid');
      expect(error.code).toBe('INVALID_INPUT');
      expect(error.details?.field).toBe('email');
    });

    it('creates scrape failed error', () => {
      const error = errors.scrapeFailed('https://example.com', 'timeout');
      expect(error.code).toBe('SCRAPE_FAILED');
      expect(error.details?.url).toBe('https://example.com');
    });
  });

  describe('getHttpStatus', () => {
    it('returns 401 for UNAUTHORIZED', () => {
      expect(getHttpStatus('UNAUTHORIZED')).toBe(401);
    });

    it('returns 429 for RATE_LIMITED', () => {
      expect(getHttpStatus('RATE_LIMITED')).toBe(429);
    });

    it('returns 400 for INVALID_INPUT', () => {
      expect(getHttpStatus('INVALID_INPUT')).toBe(400);
    });

    it('returns 404 for NOT_FOUND', () => {
      expect(getHttpStatus('NOT_FOUND')).toBe(404);
    });

    it('returns 502 for external failures', () => {
      expect(getHttpStatus('SCRAPE_FAILED')).toBe(502);
      expect(getHttpStatus('LLM_FAILED')).toBe(502);
      expect(getHttpStatus('EXTERNAL_API_ERROR')).toBe(502);
    });

    it('returns 500 for internal errors', () => {
      expect(getHttpStatus('INTERNAL_ERROR')).toBe(500);
      expect(getHttpStatus('DATABASE_ERROR')).toBe(500);
    });
  });

  describe('formatErrorResponse', () => {
    it('formats error for API response', () => {
      const error = errors.invalidInput('date', 'wrong format');
      const response = formatErrorResponse(error);
      expect(response.error.code).toBe('INVALID_INPUT');
      expect(response.error.message).toContain('date');
      expect(response.error.details?.field).toBe('date');
    });

    it('omits details if not present', () => {
      const error = errors.unauthorized();
      const response = formatErrorResponse(error);
      expect(response.error.details).toBeUndefined();
    });
  });

  describe('isApplicationError', () => {
    it('returns true for valid ApplicationError', () => {
      const error = errors.notFound('article');
      expect(isApplicationError(error)).toBe(true);
    });

    it('returns false for regular Error', () => {
      expect(isApplicationError(new Error('test'))).toBe(false);
    });

    it('returns false for non-objects', () => {
      expect(isApplicationError('error')).toBe(false);
      expect(isApplicationError(null)).toBe(false);
    });
  });

  describe('toApplicationError', () => {
    it('returns ApplicationError unchanged', () => {
      const error = errors.notFound('article');
      expect(toApplicationError(error)).toBe(error);
    });

    it('converts Error to ApplicationError', () => {
      const error = new Error('Something broke');
      const appError = toApplicationError(error);
      expect(appError.code).toBe('INTERNAL_ERROR');
      expect(appError.message).toBe('Something broke');
    });

    it('converts string to ApplicationError', () => {
      const appError = toApplicationError('Unknown error');
      expect(appError.code).toBe('INTERNAL_ERROR');
      expect(appError.message).toBe('Unknown error');
    });
  });
});
