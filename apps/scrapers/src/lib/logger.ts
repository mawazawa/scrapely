/**
 * Structured logging utility for Meridian
 * Outputs JSON-formatted logs for better observability
 */

import { sanitizeUrlForLogging } from './security';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  traceId?: string;
  component?: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
}

// Current trace ID for request correlation
let currentTraceId: string | undefined;

export function setTraceId(traceId: string): void {
  currentTraceId = traceId;
}

export function getTraceId(): string | undefined {
  return currentTraceId;
}

export function clearTraceId(): void {
  currentTraceId = undefined;
}

function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context: {
      ...context,
      ...(currentTraceId && { traceId: currentTraceId }),
    },
  };

  // Sanitize any URLs in context
  if (entry.context) {
    for (const [key, value] of Object.entries(entry.context)) {
      if (typeof value === 'string' && (key.toLowerCase().includes('url') || value.startsWith('http'))) {
        entry.context[key] = sanitizeUrlForLogging(value);
      }
    }
  }

  return JSON.stringify(entry);
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    console.debug(formatLog('debug', message, context));
  },

  info(message: string, context?: LogContext): void {
    console.info(formatLog('info', message, context));
  },

  warn(message: string, context?: LogContext): void {
    console.warn(formatLog('warn', message, context));
  },

  error(message: string, context?: LogContext): void {
    console.error(formatLog('error', message, context));
  },

  // Convenience methods for common logging patterns
  http(method: string, path: string, status: number, durationMs: number): void {
    this.info(`${method} ${path} ${status}`, {
      component: 'http',
      method,
      path,
      status,
      durationMs,
    });
  },

  workflow(name: string, step: string, status: 'started' | 'completed' | 'failed', details?: Record<string, unknown>): void {
    const level = status === 'failed' ? 'error' : 'info';
    this[level](`Workflow ${name} - ${step} ${status}`, {
      component: 'workflow',
      workflow: name,
      step,
      status,
      ...details,
    });
  },

  scrape(url: string, method: 'fetch' | 'browser' | 'firecrawl' | 'ocr', success: boolean, details?: Record<string, unknown>): void {
    const level = success ? 'info' : 'warn';
    this[level](`Scrape ${success ? 'succeeded' : 'failed'}: ${sanitizeUrlForLogging(url)}`, {
      component: 'scraper',
      url: sanitizeUrlForLogging(url),
      method,
      success,
      ...details,
    });
  },

  llm(model: string, operation: string, tokensUsed?: number, durationMs?: number): void {
    this.info(`LLM ${operation} with ${model}`, {
      component: 'llm',
      model,
      operation,
      tokensUsed,
      durationMs,
    });
  },

  ocr(provider: 'gemini' | 'mistral', url: string, success: boolean, pages?: number): void {
    const level = success ? 'info' : 'warn';
    this[level](`OCR ${success ? 'succeeded' : 'failed'} with ${provider}`, {
      component: 'ocr',
      provider,
      url: sanitizeUrlForLogging(url),
      success,
      pages,
    });
  },

  db(operation: string, table: string, count?: number, durationMs?: number): void {
    this.debug(`DB ${operation} on ${table}`, {
      component: 'database',
      operation,
      table,
      count,
      durationMs,
    });
  },
};

// Middleware helper for Hono
export function withTraceId<T>(fn: () => T | Promise<T>): T | Promise<T> {
  const traceId = crypto.randomUUID();
  setTraceId(traceId);
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.finally(() => clearTraceId());
    }
    clearTraceId();
    return result;
  } catch (error) {
    clearTraceId();
    throw error;
  }
}
