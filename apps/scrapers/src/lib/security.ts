/**
 * Security utilities for Meridian
 */

/**
 * Escape HTML entities to prevent XSS attacks
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitize URL for logging - strips query params that might contain secrets
 */
export function sanitizeUrlForLogging(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove all query params except common safe ones
    const safeParams = ['page', 'limit', 'date', 'id'];
    const params = new URLSearchParams();
    for (const [key, value] of parsed.searchParams) {
      if (safeParams.includes(key)) {
        params.set(key, value);
      }
    }
    parsed.search = params.toString();
    return parsed.toString();
  } catch {
    // If URL is invalid, return redacted version
    return url.split('?')[0] + '?[REDACTED]';
  }
}

/**
 * Validate date string format (YYYY-MM-DD)
 */
export function isValidDateFormat(dateStr: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) return false;

  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * List of known disposable email domains
 */
const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com',
  'throwaway.email',
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'temp-mail.org',
  'fakeinbox.com',
  'trashmail.com',
  'tempail.com',
  'getnada.com',
  'maildrop.cc',
  'dispostable.com',
  'yopmail.com',
  'sharklasers.com',
  'mailnesia.com',
]);

/**
 * Check if email is from a disposable email provider
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}

/**
 * Rate limiter for authentication attempts
 */
interface RateLimitEntry {
  count: number;
  firstAttempt: number;
}

const authAttempts = new Map<string, RateLimitEntry>();
const AUTH_RATE_LIMIT = 5; // Max attempts
const AUTH_RATE_WINDOW = 60 * 1000; // 1 minute window

export function checkAuthRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = authAttempts.get(ip);

  if (!entry) {
    authAttempts.set(ip, { count: 1, firstAttempt: now });
    return { allowed: true };
  }

  // Reset if window has passed
  if (now - entry.firstAttempt > AUTH_RATE_WINDOW) {
    authAttempts.set(ip, { count: 1, firstAttempt: now });
    return { allowed: true };
  }

  // Check if over limit
  if (entry.count >= AUTH_RATE_LIMIT) {
    const retryAfter = Math.ceil((AUTH_RATE_WINDOW - (now - entry.firstAttempt)) / 1000);
    return { allowed: false, retryAfter };
  }

  // Increment count
  entry.count++;
  return { allowed: true };
}

/**
 * Record a failed auth attempt
 */
export function recordFailedAuth(ip: string): void {
  const now = Date.now();
  const entry = authAttempts.get(ip);

  if (!entry || now - entry.firstAttempt > AUTH_RATE_WINDOW) {
    authAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    entry.count++;
  }
}

/**
 * Security headers for HTTP responses
 */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
