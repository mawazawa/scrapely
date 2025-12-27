/**
 * OpenTelemetry Tracing utilities for Meridian
 * Integrates with Cloudflare Workers automatic tracing
 *
 * @see https://developers.cloudflare.com/workers/observability/traces/
 */

import { logger } from './logger';

/**
 * Span attributes for custom instrumentation
 */
export interface SpanAttributes {
  'meridian.component'?: string;
  'meridian.operation'?: string;
  'meridian.article_id'?: number;
  'meridian.source_id'?: number;
  'meridian.url'?: string;
  'meridian.provider'?: string;
  'meridian.model'?: string;
  'meridian.tokens'?: number;
  'meridian.duration_ms'?: number;
  'meridian.success'?: boolean;
  'meridian.error'?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Create a trace context for manual instrumentation
 * Note: Cloudflare Workers automatically traces I/O operations
 */
export function createTraceContext(name: string, attributes?: SpanAttributes) {
  const traceId = crypto.randomUUID();
  const startTime = performance.now();

  return {
    traceId,
    name,
    startTime,
    attributes: attributes || {},

    /**
     * Add attribute to the span
     */
    setAttribute(key: string, value: string | number | boolean) {
      this.attributes[key] = value;
    },

    /**
     * Record an error on the span
     */
    recordError(error: Error) {
      this.attributes['meridian.error'] = error.message;
      this.attributes['meridian.success'] = false;
      logger.error(`Span ${name} error`, {
        traceId,
        error: error.message,
        ...this.attributes,
      });
    },

    /**
     * End the span and log timing
     */
    end() {
      const duration = performance.now() - startTime;
      this.attributes['meridian.duration_ms'] = Math.round(duration);

      if (this.attributes['meridian.success'] === undefined) {
        this.attributes['meridian.success'] = true;
      }

      logger.info(`Span ${name} completed`, {
        traceId,
        durationMs: Math.round(duration),
        ...this.attributes,
      });

      return duration;
    },
  };
}

/**
 * Trace a function execution
 */
export async function trace<T>(
  name: string,
  fn: () => Promise<T>,
  attributes?: SpanAttributes
): Promise<T> {
  const span = createTraceContext(name, attributes);

  try {
    const result = await fn();
    span.setAttribute('meridian.success', true);
    span.end();
    return result;
  } catch (error) {
    span.recordError(error instanceof Error ? error : new Error(String(error)));
    span.end();
    throw error;
  }
}

/**
 * Trace an article scraping operation
 */
export function traceArticleScrape(articleId: number, url: string) {
  return createTraceContext('article.scrape', {
    'meridian.component': 'scraper',
    'meridian.operation': 'scrape',
    'meridian.article_id': articleId,
    'meridian.url': url,
  });
}

/**
 * Trace an LLM operation
 */
export function traceLlmCall(model: string, operation: string) {
  return createTraceContext('llm.call', {
    'meridian.component': 'llm',
    'meridian.operation': operation,
    'meridian.model': model,
  });
}

/**
 * Trace an OCR operation
 */
export function traceOcr(provider: 'gemini' | 'mistral', url: string) {
  return createTraceContext('ocr.process', {
    'meridian.component': 'ocr',
    'meridian.operation': 'extract',
    'meridian.provider': provider,
    'meridian.url': url,
  });
}

/**
 * Trace a database operation
 */
export function traceDatabase(operation: string, table: string) {
  return createTraceContext('db.query', {
    'meridian.component': 'database',
    'meridian.operation': operation,
    'db.table': table,
  });
}

/**
 * Trace a workflow step
 */
export function traceWorkflowStep(workflow: string, step: string) {
  return createTraceContext(`workflow.${workflow}.${step}`, {
    'meridian.component': 'workflow',
    'meridian.operation': step,
    'workflow.name': workflow,
    'workflow.step': step,
  });
}
