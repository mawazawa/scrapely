/**
 * Case Tracking Service
 * Manages case tracking and change detection
 */

import { logger } from '../../lib/logger';
import type { CaseInfo, RulingInfo, ScrapeResult } from '../types';
import { SFCourtScraper } from '../sfCourt/SFCourtScraper';
import { createCrawlerFactory, type CrawlerFactory } from '../CrawlerFactory';

/**
 * Tracked case update
 */
export interface CaseUpdate {
  caseId: number;
  caseNumber: string;
  updateType: 'new_ruling' | 'new_filing' | 'status_change' | 'hearing_update' | 'party_change';
  details: string;
  data?: unknown;
  timestamp: Date;
}

/**
 * Tracking job result
 */
export interface TrackingJobResult {
  caseId: number;
  caseNumber: string;
  success: boolean;
  hasUpdates: boolean;
  updates: CaseUpdate[];
  error?: string;
  duration: number;
  scrapedAt: Date;
}

/**
 * Tracking service configuration
 */
export interface TrackingServiceConfig {
  maxConcurrency: number;
  checkIntervalMs: number;
  priorityBoostHours: number;  // Hours before hearing to boost priority
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: TrackingServiceConfig = {
  maxConcurrency: 1,
  checkIntervalMs: 4 * 60 * 60 * 1000,  // 4 hours
  priorityBoostHours: 48,  // 2 days before hearing
};

/**
 * Case Tracking Service
 */
export class TrackingService {
  private config: TrackingServiceConfig;
  private crawlerFactory: CrawlerFactory;
  private db: unknown;  // Database connection
  private queue: unknown;  // Cloudflare Queue for async processing

  constructor(
    db: unknown,
    queue?: unknown,
    config: Partial<TrackingServiceConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.db = db;
    this.queue = queue;
    this.crawlerFactory = createCrawlerFactory();
  }

  /**
   * Start tracking a case
   */
  async trackCase(
    userId: string,
    caseNumber: string,
    courtId: string,
    options?: { nickname?: string; priority?: string }
  ): Promise<{ success: boolean; caseId?: number; error?: string }> {
    try {
      // First, scrape the case to get current data
      const crawler = this.crawlerFactory.createCrawler(courtId);
      await crawler.initialize();

      const result = await (crawler as SFCourtScraper).lookupCase(caseNumber);
      await crawler.close();

      if (!result.success || !result.data) {
        return { success: false, error: result.error || 'Case not found' };
      }

      // Store case in database
      const caseId = await this.upsertCase(result.data, courtId);

      // Create tracking record
      await this.createTracking(userId, caseId, options);

      // Create initial snapshot
      await this.createSnapshot(caseId, result.data);

      // Queue for periodic updates
      if (this.queue) {
        await this.queueUpdate(caseId, 'normal');
      }

      logger.info('Case tracking started', {
        userId,
        caseNumber,
        caseId,
        courtId,
      });

      return { success: true, caseId };
    } catch (error) {
      logger.error('Failed to start case tracking', {
        caseNumber,
        courtId,
        error: String(error),
      });
      return { success: false, error: String(error) };
    }
  }

  /**
   * Stop tracking a case
   */
  async untrackCase(userId: string, caseId: number): Promise<boolean> {
    try {
      // Remove tracking record
      // await this.db.delete($caseTracking).where(...)

      logger.info('Case tracking stopped', { userId, caseId });
      return true;
    } catch (error) {
      logger.error('Failed to stop case tracking', { userId, caseId, error: String(error) });
      return false;
    }
  }

  /**
   * Check a single case for updates
   */
  async checkCaseForUpdates(caseId: number): Promise<TrackingJobResult> {
    const startTime = Date.now();

    try {
      // Get case and last snapshot
      const caseRecord = await this.getCase(caseId);
      if (!caseRecord) {
        return {
          caseId,
          caseNumber: 'unknown',
          success: false,
          hasUpdates: false,
          updates: [],
          error: 'Case not found',
          duration: Date.now() - startTime,
          scrapedAt: new Date(),
        };
      }

      const lastSnapshot = await this.getLastSnapshot(caseId);

      // Scrape current data
      const crawler = this.crawlerFactory.createCrawler(caseRecord.courtId);
      await crawler.initialize();

      const result = await (crawler as SFCourtScraper).lookupCase(caseRecord.caseNumber);
      await crawler.close();

      if (!result.success || !result.data) {
        return {
          caseId,
          caseNumber: caseRecord.caseNumber,
          success: false,
          hasUpdates: false,
          updates: [],
          error: result.error,
          duration: Date.now() - startTime,
          scrapedAt: new Date(),
        };
      }

      // Compare with last snapshot
      const updates = this.detectChanges(lastSnapshot, result.data);

      // Create new snapshot if there are changes
      if (updates.length > 0) {
        await this.createSnapshot(caseId, result.data, updates[0]?.updateType);
      }

      // Update case record
      await this.updateCase(caseId, result.data);

      logger.info('Case check completed', {
        caseId,
        caseNumber: caseRecord.caseNumber,
        hasUpdates: updates.length > 0,
        updateCount: updates.length,
      });

      return {
        caseId,
        caseNumber: caseRecord.caseNumber,
        success: true,
        hasUpdates: updates.length > 0,
        updates,
        duration: Date.now() - startTime,
        scrapedAt: new Date(),
      };
    } catch (error) {
      return {
        caseId,
        caseNumber: 'unknown',
        success: false,
        hasUpdates: false,
        updates: [],
        error: String(error),
        duration: Date.now() - startTime,
        scrapedAt: new Date(),
      };
    }
  }

  /**
   * Detect changes between snapshots
   */
  private detectChanges(lastSnapshot: unknown, currentData: CaseInfo): CaseUpdate[] {
    const updates: CaseUpdate[] = [];

    if (!lastSnapshot) {
      // No previous snapshot, this is the initial scrape
      return updates;
    }

    const last = lastSnapshot as CaseInfo;

    // Check status change
    if (last.status !== currentData.status) {
      updates.push({
        caseId: 0,  // Will be set by caller
        caseNumber: currentData.caseNumber.full,
        updateType: 'status_change',
        details: `Status changed from ${last.status} to ${currentData.status}`,
        data: { oldStatus: last.status, newStatus: currentData.status },
        timestamp: new Date(),
      });
    }

    // Check judge change
    if (last.judge !== currentData.judge) {
      updates.push({
        caseId: 0,
        caseNumber: currentData.caseNumber.full,
        updateType: 'hearing_update',
        details: `Judge changed from ${last.judge || 'Unknown'} to ${currentData.judge || 'Unknown'}`,
        data: { oldJudge: last.judge, newJudge: currentData.judge },
        timestamp: new Date(),
      });
    }

    // Check department change
    if (last.department !== currentData.department) {
      updates.push({
        caseId: 0,
        caseNumber: currentData.caseNumber.full,
        updateType: 'hearing_update',
        details: `Department changed from ${last.department || 'Unknown'} to ${currentData.department || 'Unknown'}`,
        data: { oldDept: last.department, newDept: currentData.department },
        timestamp: new Date(),
      });
    }

    // Check party changes
    const lastPartyNames = new Set(last.parties?.map(p => p.name) || []);
    const currentPartyNames = new Set(currentData.parties?.map(p => p.name) || []);

    for (const name of currentPartyNames) {
      if (!lastPartyNames.has(name)) {
        updates.push({
          caseId: 0,
          caseNumber: currentData.caseNumber.full,
          updateType: 'party_change',
          details: `New party added: ${name}`,
          data: { partyName: name },
          timestamp: new Date(),
        });
      }
    }

    // Check next hearing change
    if (last.nextHearing?.date?.getTime() !== currentData.nextHearing?.date?.getTime()) {
      updates.push({
        caseId: 0,
        caseNumber: currentData.caseNumber.full,
        updateType: 'hearing_update',
        details: currentData.nextHearing
          ? `Next hearing scheduled: ${currentData.nextHearing.date.toLocaleDateString()}`
          : 'Next hearing removed',
        data: { hearing: currentData.nextHearing },
        timestamp: new Date(),
      });
    }

    return updates;
  }

  /**
   * Get cases that need checking
   */
  async getCasesToCheck(limit: number = 100): Promise<Array<{ caseId: number; priority: string }>> {
    // In production, query database for cases that:
    // 1. Haven't been checked recently
    // 2. Have alerts enabled
    // 3. Prioritize by hearing date proximity

    // Placeholder implementation
    return [];
  }

  /**
   * Queue a case update
   */
  private async queueUpdate(caseId: number, priority: string): Promise<void> {
    if (!this.queue) return;

    // Queue implementation would go here
    logger.debug('Queued case update', { caseId, priority });
  }

  // Database helper methods (placeholders)
  private async upsertCase(caseData: CaseInfo, courtId: string): Promise<number> {
    // Insert or update case in database
    return 1;
  }

  private async createTracking(
    userId: string,
    caseId: number,
    options?: { nickname?: string; priority?: string }
  ): Promise<void> {
    // Create tracking record
  }

  private async createSnapshot(
    caseId: number,
    data: CaseInfo,
    changeType?: string
  ): Promise<void> {
    // Create case snapshot
  }

  private async getCase(caseId: number): Promise<{ caseNumber: string; courtId: string } | null> {
    // Get case from database
    return null;
  }

  private async getLastSnapshot(caseId: number): Promise<unknown> {
    // Get last snapshot
    return null;
  }

  private async updateCase(caseId: number, data: CaseInfo): Promise<void> {
    // Update case record
  }
}

/**
 * Create tracking service instance
 */
export function createTrackingService(
  db: unknown,
  queue?: unknown,
  config?: Partial<TrackingServiceConfig>
): TrackingService {
  return new TrackingService(db, queue, config);
}
