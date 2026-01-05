/**
 * Sentry Error Tracking Configuration
 * Cloudflare Workers integration with @sentry/cloudflare
 */

import * as Sentry from '@sentry/cloudflare';
import type { Env } from '../index';

/**
 * Sentry configuration options
 */
export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate: number;
  errorSampleRate: number;
}

/**
 * Get Sentry configuration from environment
 */
export function getSentryConfig(env: Env): SentryConfig {
  return {
    dsn: (env as unknown as { SENTRY_DSN?: string }).SENTRY_DSN || '',
    environment: (env as unknown as { ENVIRONMENT?: string }).ENVIRONMENT || 'development',
    release: (env as unknown as { SENTRY_RELEASE?: string }).SENTRY_RELEASE,
    tracesSampleRate: 0.1, // 10% of transactions
    errorSampleRate: 1.0, // 100% of errors
  };
}

/**
 * Initialize Sentry for Cloudflare Workers
 */
export function initSentry(env: Env, ctx: ExecutionContext): void {
  const config = getSentryConfig(env);

  if (!config.dsn) {
    console.warn('Sentry DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    tracesSampleRate: config.tracesSampleRate,
    // Only track errors from our code, not third-party
    beforeSend(event) {
      // Filter out known non-critical errors
      if (event.exception?.values?.[0]?.type === 'NetworkError') {
        return null;
      }
      return event;
    },
    // Integrations for Cloudflare Workers
    integrations: [
      Sentry.requestDataIntegration(),
    ],
  });
}

/**
 * Capture an exception with additional context
 */
export function captureException(
  error: unknown,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    user?: { id?: string; email?: string };
  }
): string {
  if (context?.tags) {
    Sentry.setTags(context.tags);
  }

  if (context?.extra) {
    Sentry.setExtras(context.extra);
  }

  if (context?.user) {
    Sentry.setUser(context.user);
  }

  return Sentry.captureException(error);
}

/**
 * Capture a message with severity level
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: Record<string, unknown>
): string {
  if (context) {
    Sentry.setExtras(context);
  }

  return Sentry.captureMessage(message, level);
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id?: string; email?: string; username?: string }): void {
  Sentry.setUser(user);
}

/**
 * Clear user context
 */
export function clearUser(): void {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: {
  category?: string;
  message: string;
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  data?: Record<string, unknown>;
}): void {
  Sentry.addBreadcrumb({
    ...breadcrumb,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Start a transaction for performance monitoring
 */
export function startTransaction(name: string, op: string): Sentry.Span | undefined {
  return Sentry.startInactiveSpan({
    name,
    op,
    forceTransaction: true,
  });
}

/**
 * Create a Hono middleware for Sentry error tracking
 */
export function sentryMiddleware() {
  return async (c: { env: Env; executionCtx: ExecutionContext; req: Request }, next: () => Promise<void>) => {
    const config = getSentryConfig(c.env);

    if (!config.dsn) {
      return next();
    }

    // Add request breadcrumb
    addBreadcrumb({
      category: 'http',
      message: `${c.req.method} ${new URL(c.req.url).pathname}`,
      level: 'info',
      data: {
        url: c.req.url,
        method: c.req.method,
      },
    });

    try {
      await next();
    } catch (error) {
      captureException(error, {
        tags: {
          route: new URL(c.req.url).pathname,
          method: c.req.method,
        },
        extra: {
          url: c.req.url,
          headers: Object.fromEntries(c.req.headers.entries()),
        },
      });
      throw error;
    }
  };
}

/**
 * Wrap an async function with Sentry error tracking
 */
export function withSentry<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context?: { name?: string; tags?: Record<string, string> }
): T {
  return (async (...args: Parameters<T>) => {
    const span = context?.name
      ? startTransaction(context.name, 'function')
      : undefined;

    if (context?.tags) {
      Sentry.setTags(context.tags);
    }

    try {
      const result = await fn(...args);
      span?.end();
      return result;
    } catch (error) {
      span?.setStatus({ code: 2, message: String(error) });
      span?.end();
      captureException(error, context);
      throw error;
    }
  }) as T;
}

/**
 * Scraper-specific error context
 */
export interface ScraperErrorContext {
  courtId: string;
  operation: string;
  caseNumber?: string;
  url?: string;
  attempt?: number;
  maxAttempts?: number;
}

/**
 * Capture scraper error with rich context
 */
export function captureScraperError(
  error: unknown,
  context: ScraperErrorContext
): string {
  return captureException(error, {
    tags: {
      'scraper.court_id': context.courtId,
      'scraper.operation': context.operation,
    },
    extra: {
      courtId: context.courtId,
      operation: context.operation,
      caseNumber: context.caseNumber,
      url: context.url,
      attempt: context.attempt,
      maxAttempts: context.maxAttempts,
    },
  });
}

export default Sentry;
