/**
 * Tests for source health monitoring
 */

import { describe, it, expect } from 'vitest';
import {
  calculateHealthStatus,
  shouldAutoDisable,
  HEALTH_THRESHOLDS,
  AUTO_DISABLE_THRESHOLD,
} from '../../src/lib/sourceHealth';

describe('Source Health Monitoring', () => {
  describe('calculateHealthStatus', () => {
    it('should return healthy for 90%+ success rate', () => {
      expect(calculateHealthStatus(0.95)).toBe('healthy');
      expect(calculateHealthStatus(0.90)).toBe('healthy');
    });

    it('should return degraded for 70-90% success rate', () => {
      expect(calculateHealthStatus(0.89)).toBe('degraded');
      expect(calculateHealthStatus(0.75)).toBe('degraded');
      expect(calculateHealthStatus(0.70)).toBe('degraded');
    });

    it('should return failing for 50-70% success rate', () => {
      expect(calculateHealthStatus(0.69)).toBe('failing');
      expect(calculateHealthStatus(0.55)).toBe('failing');
      expect(calculateHealthStatus(0.50)).toBe('failing');
    });

    it('should return disabled for below 50% success rate', () => {
      expect(calculateHealthStatus(0.49)).toBe('disabled');
      expect(calculateHealthStatus(0.30)).toBe('disabled');
      expect(calculateHealthStatus(0.0)).toBe('disabled');
    });
  });

  describe('shouldAutoDisable', () => {
    it('should not disable with insufficient data', () => {
      const metrics = {
        sourceId: 1,
        sourceName: 'Test Source',
        successRate: 0.1,
        totalScrapes: 5, // Less than 10
        successfulScrapes: 1,
        failedScrapes: 4,
        lastSuccess: null,
        lastFailure: null,
        lastError: null,
        avgResponseTimeMs: null,
        status: 'failing' as const,
      };

      expect(shouldAutoDisable(metrics)).toBe(false);
    });

    it('should disable with low success rate and enough data', () => {
      const metrics = {
        sourceId: 1,
        sourceName: 'Test Source',
        successRate: 0.2, // Below 30% threshold
        totalScrapes: 15,
        successfulScrapes: 3,
        failedScrapes: 12,
        lastSuccess: null,
        lastFailure: null,
        lastError: null,
        avgResponseTimeMs: null,
        status: 'disabled' as const,
      };

      expect(shouldAutoDisable(metrics)).toBe(true);
    });

    it('should not disable healthy sources', () => {
      const metrics = {
        sourceId: 1,
        sourceName: 'Test Source',
        successRate: 0.95,
        totalScrapes: 100,
        successfulScrapes: 95,
        failedScrapes: 5,
        lastSuccess: null,
        lastFailure: null,
        lastError: null,
        avgResponseTimeMs: null,
        status: 'healthy' as const,
      };

      expect(shouldAutoDisable(metrics)).toBe(false);
    });
  });

  describe('thresholds', () => {
    it('should have correct health thresholds', () => {
      expect(HEALTH_THRESHOLDS.HEALTHY).toBe(0.9);
      expect(HEALTH_THRESHOLDS.DEGRADED).toBe(0.7);
      expect(HEALTH_THRESHOLDS.FAILING).toBe(0.5);
    });

    it('should have correct auto-disable threshold', () => {
      expect(AUTO_DISABLE_THRESHOLD).toBe(0.3);
    });
  });
});
