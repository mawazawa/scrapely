/**
 * Tests for tracing utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTraceContext, trace, traceArticleScrape, traceLlmCall, traceOcr, traceDatabase, traceWorkflowStep } from '../../src/lib/tracing';

// Mock performance.now for consistent timing
vi.spyOn(performance, 'now').mockImplementation(() => 1000);

describe('Tracing Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTraceContext', () => {
    it('should create a trace context with unique ID', () => {
      const ctx = createTraceContext('test-span');
      expect(ctx.traceId).toBeDefined();
      expect(ctx.name).toBe('test-span');
      expect(ctx.startTime).toBe(1000);
    });

    it('should accept initial attributes', () => {
      const ctx = createTraceContext('test-span', {
        'meridian.component': 'test',
        'meridian.operation': 'test-op',
      });
      expect(ctx.attributes['meridian.component']).toBe('test');
      expect(ctx.attributes['meridian.operation']).toBe('test-op');
    });

    it('should allow setting attributes', () => {
      const ctx = createTraceContext('test-span');
      ctx.setAttribute('custom.key', 'value');
      expect(ctx.attributes['custom.key']).toBe('value');
    });

    it('should record errors correctly', () => {
      const ctx = createTraceContext('test-span');
      const error = new Error('Test error');
      ctx.recordError(error);
      expect(ctx.attributes['meridian.error']).toBe('Test error');
      expect(ctx.attributes['meridian.success']).toBe(false);
    });

    it('should calculate duration on end', () => {
      // Mock performance.now to return different values
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(1000) // start time
        .mockReturnValueOnce(1500); // end time

      const ctx = createTraceContext('test-span');
      const duration = ctx.end();
      expect(duration).toBe(500);
      expect(ctx.attributes['meridian.duration_ms']).toBe(500);
      expect(ctx.attributes['meridian.success']).toBe(true);
    });
  });

  describe('trace', () => {
    it('should trace successful async functions', async () => {
      const result = await trace('test-op', async () => 'success');
      expect(result).toBe('success');
    });

    it('should trace failed async functions', async () => {
      await expect(
        trace('test-op', async () => {
          throw new Error('Test failure');
        })
      ).rejects.toThrow('Test failure');
    });

    it('should pass custom attributes', async () => {
      const result = await trace(
        'test-op',
        async () => 42,
        { 'meridian.component': 'test' }
      );
      expect(result).toBe(42);
    });
  });

  describe('specialized trace functions', () => {
    it('traceArticleScrape should create article trace context', () => {
      const ctx = traceArticleScrape(123, 'https://example.com/article');
      expect(ctx.name).toBe('article.scrape');
      expect(ctx.attributes['meridian.component']).toBe('scraper');
      expect(ctx.attributes['meridian.article_id']).toBe(123);
      expect(ctx.attributes['meridian.url']).toBe('https://example.com/article');
    });

    it('traceLlmCall should create LLM trace context', () => {
      const ctx = traceLlmCall('gemini-3-flash', 'analyze');
      expect(ctx.name).toBe('llm.call');
      expect(ctx.attributes['meridian.component']).toBe('llm');
      expect(ctx.attributes['meridian.model']).toBe('gemini-3-flash');
      expect(ctx.attributes['meridian.operation']).toBe('analyze');
    });

    it('traceOcr should create OCR trace context', () => {
      const ctx = traceOcr('gemini', 'https://example.com/doc.pdf');
      expect(ctx.name).toBe('ocr.process');
      expect(ctx.attributes['meridian.component']).toBe('ocr');
      expect(ctx.attributes['meridian.provider']).toBe('gemini');
    });

    it('traceDatabase should create database trace context', () => {
      const ctx = traceDatabase('select', 'articles');
      expect(ctx.name).toBe('db.query');
      expect(ctx.attributes['meridian.component']).toBe('database');
      expect(ctx.attributes['meridian.operation']).toBe('select');
      expect(ctx.attributes['db.table']).toBe('articles');
    });

    it('traceWorkflowStep should create workflow trace context', () => {
      const ctx = traceWorkflowStep('processArticles', 'fetch');
      expect(ctx.name).toBe('workflow.processArticles.fetch');
      expect(ctx.attributes['meridian.component']).toBe('workflow');
      expect(ctx.attributes['workflow.name']).toBe('processArticles');
      expect(ctx.attributes['workflow.step']).toBe('fetch');
    });
  });
});
