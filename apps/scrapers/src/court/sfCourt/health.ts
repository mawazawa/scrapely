/**
 * SF Court Scraper Health Check
 * Health monitoring and diagnostics for SF Court scraping
 */

import { logger } from '../../lib/logger';
import { SF_COURT_BASE_URL, SF_COURT_URLS } from './urls';
import type { ScraperMetrics } from '../types';
import { detectCloudflareChallenge } from '../cloudflare';
import type { Page } from 'playwright';

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  timestamp: Date;
  checks: HealthCheckItem[];
  metrics?: ScraperMetrics;
  duration: number;
}

/**
 * Individual health check item
 */
export interface HealthCheckItem {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  duration: number;
  metadata?: Record<string, unknown>;
}

/**
 * Check if SF Court website is accessible
 */
export async function checkWebsiteAccessibility(): Promise<HealthCheckItem> {
  const startTime = Date.now();

  try {
    const response = await fetch(SF_COURT_BASE_URL, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000),
    });

    const duration = Date.now() - startTime;

    if (response.ok) {
      return {
        name: 'website_accessibility',
        status: 'pass',
        message: `SF Court website is accessible (${response.status})`,
        duration,
        metadata: {
          statusCode: response.status,
          contentType: response.headers.get('content-type'),
        },
      };
    }

    return {
      name: 'website_accessibility',
      status: 'fail',
      message: `SF Court website returned ${response.status}`,
      duration,
      metadata: { statusCode: response.status },
    };
  } catch (error) {
    return {
      name: 'website_accessibility',
      status: 'fail',
      message: `Failed to reach SF Court website: ${error}`,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Check if Cloudflare is protecting the site
 */
export async function checkCloudflareStatus(page: Page): Promise<HealthCheckItem> {
  const startTime = Date.now();

  try {
    const detection = await detectCloudflareChallenge(page);
    const duration = Date.now() - startTime;

    if (detection.isBlocked) {
      return {
        name: 'cloudflare_status',
        status: 'fail',
        message: 'Blocked by Cloudflare',
        duration,
        metadata: detection,
      };
    }

    if (detection.hasChallenge) {
      return {
        name: 'cloudflare_status',
        status: 'warn',
        message: `Cloudflare challenge detected: ${detection.challengeType}`,
        duration,
        metadata: detection,
      };
    }

    return {
      name: 'cloudflare_status',
      status: 'pass',
      message: 'No Cloudflare challenge present',
      duration,
      metadata: detection,
    };
  } catch (error) {
    return {
      name: 'cloudflare_status',
      status: 'fail',
      message: `Failed to check Cloudflare status: ${error}`,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Check if tentative rulings page is accessible
 */
export async function checkTentativeRulingsAccess(): Promise<HealthCheckItem> {
  const startTime = Date.now();

  try {
    const response = await fetch(SF_COURT_URLS.tentativeRulings, {
      signal: AbortSignal.timeout(10000),
    });

    const duration = Date.now() - startTime;

    if (response.ok) {
      const text = await response.text();

      // Check for expected content
      const hasRulings = text.toLowerCase().includes('tentative') ||
                         text.toLowerCase().includes('ruling');

      if (hasRulings) {
        return {
          name: 'tentative_rulings_access',
          status: 'pass',
          message: 'Tentative rulings page is accessible',
          duration,
        };
      }

      return {
        name: 'tentative_rulings_access',
        status: 'warn',
        message: 'Page loaded but expected content not found',
        duration,
      };
    }

    return {
      name: 'tentative_rulings_access',
      status: 'fail',
      message: `Tentative rulings page returned ${response.status}`,
      duration,
      metadata: { statusCode: response.status },
    };
  } catch (error) {
    return {
      name: 'tentative_rulings_access',
      status: 'fail',
      message: `Failed to access tentative rulings: ${error}`,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Check if case search is available
 */
export async function checkCaseSearchAccess(): Promise<HealthCheckItem> {
  const startTime = Date.now();

  try {
    const response = await fetch(SF_COURT_URLS.caseSearch, {
      signal: AbortSignal.timeout(10000),
    });

    const duration = Date.now() - startTime;

    if (response.ok) {
      const text = await response.text();

      // Check for search form elements
      const hasForm = text.includes('form') &&
                      (text.includes('case') || text.includes('search'));

      if (hasForm) {
        return {
          name: 'case_search_access',
          status: 'pass',
          message: 'Case search page is accessible',
          duration,
        };
      }

      return {
        name: 'case_search_access',
        status: 'warn',
        message: 'Page loaded but search form not found',
        duration,
      };
    }

    return {
      name: 'case_search_access',
      status: 'fail',
      message: `Case search page returned ${response.status}`,
      duration,
      metadata: { statusCode: response.status },
    };
  } catch (error) {
    return {
      name: 'case_search_access',
      status: 'fail',
      message: `Failed to access case search: ${error}`,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Check session validity
 */
export function checkSessionValidity(
  session: { isValid: boolean; expiresAt: Date } | null
): HealthCheckItem {
  const startTime = Date.now();

  if (!session) {
    return {
      name: 'session_validity',
      status: 'warn',
      message: 'No active session',
      duration: 0,
    };
  }

  const now = new Date();
  const expiresIn = session.expiresAt.getTime() - now.getTime();

  if (!session.isValid) {
    return {
      name: 'session_validity',
      status: 'fail',
      message: 'Session marked as invalid',
      duration: Date.now() - startTime,
    };
  }

  if (expiresIn < 0) {
    return {
      name: 'session_validity',
      status: 'fail',
      message: 'Session has expired',
      duration: Date.now() - startTime,
    };
  }

  if (expiresIn < 5 * 60 * 1000) { // Less than 5 minutes
    return {
      name: 'session_validity',
      status: 'warn',
      message: `Session expires in ${Math.round(expiresIn / 1000)} seconds`,
      duration: Date.now() - startTime,
      metadata: { expiresIn },
    };
  }

  return {
    name: 'session_validity',
    status: 'pass',
    message: `Session valid for ${Math.round(expiresIn / 60000)} minutes`,
    duration: Date.now() - startTime,
    metadata: { expiresIn },
  };
}

/**
 * Check rate limit status
 */
export function checkRateLimitStatus(
  rateLimiter: { getRemainingRequests: (domain: string) => number; getTimeUntilReset: (domain: string) => number }
): HealthCheckItem {
  const domain = 'sf.courts.ca.gov';
  const remaining = rateLimiter.getRemainingRequests(domain);
  const resetIn = rateLimiter.getTimeUntilReset(domain);

  if (remaining === 0) {
    return {
      name: 'rate_limit_status',
      status: 'warn',
      message: `Rate limited, resets in ${Math.round(resetIn / 1000)}s`,
      duration: 0,
      metadata: { remaining, resetInMs: resetIn },
    };
  }

  return {
    name: 'rate_limit_status',
    status: 'pass',
    message: `${remaining} requests remaining`,
    duration: 0,
    metadata: { remaining, resetInMs: resetIn },
  };
}

/**
 * Check scraper metrics health
 */
export function checkMetricsHealth(metrics: ScraperMetrics): HealthCheckItem {
  // Calculate success rate
  const total = metrics.successfulRequests + metrics.failedRequests;
  const successRate = total > 0 ? metrics.successfulRequests / total : 1;

  // Check for concerning patterns
  if (metrics.blockedRequests > 0) {
    return {
      name: 'metrics_health',
      status: 'fail',
      message: `${metrics.blockedRequests} requests blocked`,
      duration: 0,
      metadata: metrics,
    };
  }

  if (successRate < 0.5) {
    return {
      name: 'metrics_health',
      status: 'fail',
      message: `Low success rate: ${(successRate * 100).toFixed(1)}%`,
      duration: 0,
      metadata: { ...metrics, successRate },
    };
  }

  if (successRate < 0.9) {
    return {
      name: 'metrics_health',
      status: 'warn',
      message: `Success rate: ${(successRate * 100).toFixed(1)}%`,
      duration: 0,
      metadata: { ...metrics, successRate },
    };
  }

  return {
    name: 'metrics_health',
    status: 'pass',
    message: `${metrics.successfulRequests} successful requests`,
    duration: 0,
    metadata: { ...metrics, successRate },
  };
}

/**
 * Run all health checks
 */
export async function runHealthCheck(options?: {
  page?: Page;
  session?: { isValid: boolean; expiresAt: Date };
  rateLimiter?: { getRemainingRequests: (domain: string) => number; getTimeUntilReset: (domain: string) => number };
  metrics?: ScraperMetrics;
}): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const checks: HealthCheckItem[] = [];

  // Run checks in parallel where possible
  const [websiteCheck, rulingsCheck, caseSearchCheck] = await Promise.all([
    checkWebsiteAccessibility(),
    checkTentativeRulingsAccess(),
    checkCaseSearchAccess(),
  ]);

  checks.push(websiteCheck, rulingsCheck, caseSearchCheck);

  // Add page-dependent checks
  if (options?.page) {
    const cloudflareCheck = await checkCloudflareStatus(options.page);
    checks.push(cloudflareCheck);
  }

  // Add session check
  if (options?.session) {
    checks.push(checkSessionValidity(options.session));
  }

  // Add rate limit check
  if (options?.rateLimiter) {
    checks.push(checkRateLimitStatus(options.rateLimiter));
  }

  // Add metrics check
  if (options?.metrics) {
    checks.push(checkMetricsHealth(options.metrics));
  }

  // Determine overall health
  const hasFailure = checks.some(c => c.status === 'fail');
  const hasWarning = checks.some(c => c.status === 'warn');
  const healthy = !hasFailure;

  const result: HealthCheckResult = {
    healthy,
    timestamp: new Date(),
    checks,
    metrics: options?.metrics,
    duration: Date.now() - startTime,
  };

  logger.info('Health check completed', {
    healthy,
    checks: checks.length,
    failures: checks.filter(c => c.status === 'fail').length,
    warnings: checks.filter(c => c.status === 'warn').length,
    duration: result.duration,
  });

  return result;
}

/**
 * Format health check result for logging
 */
export function formatHealthCheckResult(result: HealthCheckResult): string {
  const lines: string[] = [];

  lines.push(`Health Check: ${result.healthy ? 'HEALTHY' : 'UNHEALTHY'}`);
  lines.push(`Timestamp: ${result.timestamp.toISOString()}`);
  lines.push(`Duration: ${result.duration}ms`);
  lines.push('');
  lines.push('Checks:');

  for (const check of result.checks) {
    const icon = check.status === 'pass' ? '✓' : check.status === 'warn' ? '⚠' : '✗';
    lines.push(`  ${icon} ${check.name}: ${check.message} (${check.duration}ms)`);
  }

  return lines.join('\n');
}
