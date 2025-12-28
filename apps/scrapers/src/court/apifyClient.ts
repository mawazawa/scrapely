/**
 * Apify Client Wrapper
 * Wrapper for Apify API with retry logic and error handling
 */

import { ApifyClient } from 'apify-client';
import { logger } from '../lib/logger';
import { CourtScraperError, CourtScraperErrorCode, wrapError } from './errors';

/**
 * Apify client configuration
 */
export interface ApifyClientConfig {
  token: string;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

/**
 * Actor run options
 */
export interface ActorRunOptions {
  actorId: string;
  input: Record<string, unknown>;
  memory?: number;
  timeout?: number;
  webhooks?: Array<{
    eventTypes: string[];
    requestUrl: string;
  }>;
}

/**
 * Actor run result
 */
export interface ActorRunResult<T = unknown> {
  runId: string;
  actorId: string;
  status: 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMING-OUT' | 'TIMED-OUT' | 'ABORTING' | 'ABORTED';
  startedAt: Date;
  finishedAt?: Date;
  data?: T;
  stats?: {
    inputRecords: number;
    outputRecords: number;
    duration: number;
    compute?: number;
  };
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Partial<ApifyClientConfig> = {
  maxRetries: 3,
  retryDelayMs: 1000,
  timeoutMs: 300000, // 5 minutes
};

/**
 * Apify client wrapper with retry logic
 */
export class ApifyClientWrapper {
  private client: ApifyClient;
  private config: Required<ApifyClientConfig>;

  constructor(config: ApifyClientConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<ApifyClientConfig>;
    this.client = new ApifyClient({ token: this.config.token });
  }

  /**
   * Run an actor and wait for completion
   */
  async runActor<T = unknown>(options: ActorRunOptions): Promise<ActorRunResult<T>> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        logger.info('Starting Apify actor run', {
          actorId: options.actorId,
          attempt,
          maxRetries: this.config.maxRetries,
        });

        // Start the actor
        const run = await this.client.actor(options.actorId).call(options.input, {
          memory: options.memory,
          timeout: options.timeout,
          webhooks: options.webhooks,
        });

        if (!run) {
          throw new Error('Actor run returned no result');
        }

        // Get dataset items
        let data: T | undefined;
        if (run.defaultDatasetId) {
          const dataset = await this.client.dataset(run.defaultDatasetId).listItems();
          data = dataset.items as T;
        }

        const result: ActorRunResult<T> = {
          runId: run.id,
          actorId: options.actorId,
          status: run.status as ActorRunResult['status'],
          startedAt: new Date(run.startedAt),
          finishedAt: run.finishedAt ? new Date(run.finishedAt) : undefined,
          data,
          stats: {
            inputRecords: 1,
            outputRecords: Array.isArray(data) ? data.length : data ? 1 : 0,
            duration: Date.now() - startTime,
          },
        };

        logger.info('Apify actor run completed', {
          runId: result.runId,
          status: result.status,
          duration: result.stats?.duration,
          outputRecords: result.stats?.outputRecords,
        });

        return result;
      } catch (error) {
        lastError = error as Error;
        logger.warn('Apify actor run failed', {
          actorId: options.actorId,
          attempt,
          error: String(error),
        });

        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new CourtScraperError(
      `Apify actor run failed after ${this.config.maxRetries} attempts: ${lastError?.message}`,
      CourtScraperErrorCode.INTERNAL_ERROR,
      { context: { actorId: options.actorId }, cause: lastError }
    );
  }

  /**
   * Run an actor without waiting for completion
   */
  async startActor(options: ActorRunOptions): Promise<string> {
    try {
      const run = await this.client.actor(options.actorId).start(options.input, {
        memory: options.memory,
        timeout: options.timeout,
        webhooks: options.webhooks,
      });

      logger.info('Apify actor started', {
        actorId: options.actorId,
        runId: run.id,
      });

      return run.id;
    } catch (error) {
      throw wrapError(error, { actorId: options.actorId });
    }
  }

  /**
   * Get actor run status
   */
  async getRunStatus(runId: string): Promise<ActorRunResult['status']> {
    try {
      const run = await this.client.run(runId).get();
      return run?.status as ActorRunResult['status'] || 'FAILED';
    } catch (error) {
      throw wrapError(error, { runId });
    }
  }

  /**
   * Wait for actor run to complete
   */
  async waitForRun<T = unknown>(runId: string): Promise<ActorRunResult<T>> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - startTime < this.config.timeoutMs) {
      const run = await this.client.run(runId).get();

      if (!run) {
        throw new CourtScraperError(
          `Run ${runId} not found`,
          CourtScraperErrorCode.INTERNAL_ERROR
        );
      }

      const status = run.status as ActorRunResult['status'];

      if (['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED'].includes(status)) {
        let data: T | undefined;

        if (run.defaultDatasetId && status === 'SUCCEEDED') {
          const dataset = await this.client.dataset(run.defaultDatasetId).listItems();
          data = dataset.items as T;
        }

        return {
          runId: run.id,
          actorId: run.actId,
          status,
          startedAt: new Date(run.startedAt),
          finishedAt: run.finishedAt ? new Date(run.finishedAt) : undefined,
          data,
          stats: {
            inputRecords: 1,
            outputRecords: Array.isArray(data) ? data.length : data ? 1 : 0,
            duration: Date.now() - startTime,
          },
        };
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new CourtScraperError(
      `Timeout waiting for run ${runId}`,
      CourtScraperErrorCode.TIMEOUT
    );
  }

  /**
   * Get dataset items
   */
  async getDataset<T = unknown>(datasetId: string): Promise<T[]> {
    try {
      const dataset = await this.client.dataset(datasetId).listItems();
      return dataset.items as T[];
    } catch (error) {
      throw wrapError(error, { datasetId });
    }
  }

  /**
   * Store data in key-value store
   */
  async storeValue(storeId: string, key: string, value: unknown): Promise<void> {
    try {
      await this.client.keyValueStore(storeId).setRecord({
        key,
        value,
        contentType: 'application/json',
      });
    } catch (error) {
      throw wrapError(error, { storeId, key });
    }
  }

  /**
   * Get value from key-value store
   */
  async getValue<T = unknown>(storeId: string, key: string): Promise<T | null> {
    try {
      const record = await this.client.keyValueStore(storeId).getRecord(key);
      return record?.value as T || null;
    } catch (error) {
      throw wrapError(error, { storeId, key });
    }
  }

  /**
   * List available actors
   */
  async listActors(): Promise<Array<{ id: string; name: string; title: string }>> {
    try {
      const actors = await this.client.actors().list();
      return actors.items.map(actor => ({
        id: actor.id,
        name: actor.name,
        title: actor.title || actor.name,
      }));
    } catch (error) {
      throw wrapError(error);
    }
  }

  /**
   * Get actor info
   */
  async getActor(actorId: string): Promise<{
    id: string;
    name: string;
    title: string;
    description?: string;
    stats?: {
      totalRuns: number;
      totalUsers: number;
    };
  } | null> {
    try {
      const actor = await this.client.actor(actorId).get();
      if (!actor) return null;

      return {
        id: actor.id,
        name: actor.name,
        title: actor.title || actor.name,
        description: actor.description,
        stats: actor.stats ? {
          totalRuns: actor.stats.totalRuns,
          totalUsers: actor.stats.totalUsers,
        } : undefined,
      };
    } catch (error) {
      throw wrapError(error, { actorId });
    }
  }
}

/**
 * Recommended Apify actors for court scraping
 */
export const COURT_SCRAPING_ACTORS = {
  // Web scraper with Cloudflare bypass
  webScraper: 'apify/web-scraper',

  // Cheerio scraper (fast, no JS)
  cheerioScraper: 'apify/cheerio-scraper',

  // Puppeteer scraper
  puppeteerScraper: 'apify/puppeteer-scraper',

  // Playwright scraper
  playwrightScraper: 'apify/playwright-scraper',

  // Anti-captcha integration
  captchaSolver: 'apify/captcha-solver',
};

/**
 * Create Apify client instance
 */
export function createApifyClient(token: string, options?: Partial<ApifyClientConfig>): ApifyClientWrapper {
  return new ApifyClientWrapper({ token, ...options });
}
