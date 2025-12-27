import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  sanitizeUrlForLogging,
  isValidDateFormat,
  isDisposableEmail,
  checkAuthRateLimit,
  recordFailedAuth,
} from '../../src/lib/security';

describe('Security utilities', () => {
  describe('escapeHtml', () => {
    it('escapes HTML entities', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
    });

    it('escapes ampersands', () => {
      expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
    });

    it('escapes quotes', () => {
      expect(escapeHtml("It's a \"test\"")).toBe("It&#039;s a &quot;test&quot;");
    });

    it('returns empty string for empty input', () => {
      expect(escapeHtml('')).toBe('');
    });
  });

  describe('sanitizeUrlForLogging', () => {
    it('removes sensitive query params', () => {
      const url = 'https://example.com/path?token=secret&page=1';
      const sanitized = sanitizeUrlForLogging(url);
      expect(sanitized).toBe('https://example.com/path?page=1');
    });

    it('keeps safe query params', () => {
      const url = 'https://example.com/path?page=1&limit=10&date=2025-01-01';
      const sanitized = sanitizeUrlForLogging(url);
      expect(sanitized).toContain('page=1');
      expect(sanitized).toContain('limit=10');
      expect(sanitized).toContain('date=2025-01-01');
    });

    it('handles URLs without query params', () => {
      const url = 'https://example.com/path';
      expect(sanitizeUrlForLogging(url)).toBe('https://example.com/path');
    });

    it('handles invalid URLs gracefully', () => {
      const url = 'not-a-valid-url';
      expect(sanitizeUrlForLogging(url)).toBe('not-a-valid-url?[REDACTED]');
    });
  });

  describe('isValidDateFormat', () => {
    it('returns true for valid YYYY-MM-DD format', () => {
      expect(isValidDateFormat('2025-01-15')).toBe(true);
      expect(isValidDateFormat('2025-12-31')).toBe(true);
    });

    it('returns false for invalid formats', () => {
      expect(isValidDateFormat('01-15-2025')).toBe(false);
      expect(isValidDateFormat('2025/01/15')).toBe(false);
      expect(isValidDateFormat('2025-1-15')).toBe(false);
      expect(isValidDateFormat('not-a-date')).toBe(false);
    });

    it('returns false for invalid dates', () => {
      expect(isValidDateFormat('2025-13-01')).toBe(false);
      expect(isValidDateFormat('2025-00-01')).toBe(false);
    });
  });

  describe('isDisposableEmail', () => {
    it('returns true for known disposable domains', () => {
      expect(isDisposableEmail('test@tempmail.com')).toBe(true);
      expect(isDisposableEmail('user@mailinator.com')).toBe(true);
      expect(isDisposableEmail('foo@yopmail.com')).toBe(true);
    });

    it('returns false for regular domains', () => {
      expect(isDisposableEmail('user@gmail.com')).toBe(false);
      expect(isDisposableEmail('user@company.com')).toBe(false);
    });

    it('handles case insensitivity', () => {
      expect(isDisposableEmail('test@TEMPMAIL.COM')).toBe(true);
    });

    it('returns false for invalid emails', () => {
      expect(isDisposableEmail('invalid-email')).toBe(false);
    });
  });

  describe('Auth rate limiting', () => {
    it('allows first attempts', () => {
      const result = checkAuthRateLimit('192.168.1.1');
      expect(result.allowed).toBe(true);
    });

    it('blocks after too many failed attempts', () => {
      const ip = '192.168.1.100';
      // Record 5 failed attempts
      for (let i = 0; i < 5; i++) {
        recordFailedAuth(ip);
      }
      const result = checkAuthRateLimit(ip);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });
});
