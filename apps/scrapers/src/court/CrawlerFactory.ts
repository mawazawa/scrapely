/**
 * Crawler Factory
 * Factory for creating configured court crawlers
 */

import { logger } from '../lib/logger';
import { BaseCrawler, type BaseCrawlerOptions, type SessionStore } from './BaseCrawler';
import { ProxyManager, createProxyManagerFromEnv, type ProxyProvider } from './proxy';
import { CourtRateLimiter, DistributedRateLimiter, createRateLimiter } from './rateLimit';
import { getCourtCrawlerConfig } from './crawlee.config';
import type { CrawlerConfig, CourtInfo } from './types';

/**
 * Factory configuration
 */
export interface CrawlerFactoryConfig {
  useProxy?: boolean;
  proxyProvider?: ProxyProvider;
  sessionStore?: SessionStore;
  rateLimiter?: CourtRateLimiter | DistributedRateLimiter;
  kvNamespace?: KVNamespace;
}

/**
 * KV-based session store
 */
export class KVSessionStore implements SessionStore {
  private kv: KVNamespace;
  private prefix: string;
  private ttlSeconds: number;

  constructor(kv: KVNamespace, prefix: string = 'session:', ttlSeconds: number = 86400) {
    this.kv = kv;
    this.prefix = prefix;
    this.ttlSeconds = ttlSeconds;
  }

  async get(courtId: string): Promise<import('./types').SessionData | null> {
    const data = await this.kv.get<import('./types').SessionData>(`${this.prefix}${courtId}`, 'json');
    if (!data) return null;

    // Convert date strings back to Date objects
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      expiresAt: new Date(data.expiresAt),
    };
  }

  async set(session: import('./types').SessionData): Promise<void> {
    await this.kv.put(
      `${this.prefix}${session.courtId}`,
      JSON.stringify(session),
      { expirationTtl: this.ttlSeconds }
    );
  }

  async delete(sessionId: string): Promise<void> {
    // Note: We store by courtId, so this would need court context
    await this.kv.delete(`${this.prefix}${sessionId}`);
  }
}

/**
 * In-memory session store (for development/testing)
 */
export class MemorySessionStore implements SessionStore {
  private sessions: Map<string, import('./types').SessionData> = new Map();

  async get(courtId: string): Promise<import('./types').SessionData | null> {
    const session = this.sessions.get(courtId);
    if (!session) return null;

    // Check if expired
    if (new Date() > session.expiresAt) {
      this.sessions.delete(courtId);
      return null;
    }

    return session;
  }

  async set(session: import('./types').SessionData): Promise<void> {
    this.sessions.set(session.courtId, session);
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}

/**
 * Registered crawler classes
 */
const crawlerRegistry: Map<string, new (options: BaseCrawlerOptions) => BaseCrawler> = new Map();

/**
 * Register a crawler class for a court
 */
export function registerCrawler(
  courtId: string,
  crawlerClass: new (options: BaseCrawlerOptions) => BaseCrawler
): void {
  crawlerRegistry.set(courtId, crawlerClass);
  logger.debug('Crawler registered', { courtId });
}

/**
 * Crawler factory
 */
export class CrawlerFactory {
  private config: CrawlerFactoryConfig;
  private proxyManager: ProxyManager | null = null;
  private rateLimiter: CourtRateLimiter | DistributedRateLimiter;
  private sessionStore: SessionStore;

  constructor(config: CrawlerFactoryConfig = {}) {
    this.config = config;

    // Initialize proxy manager
    if (config.useProxy) {
      this.proxyManager = createProxyManagerFromEnv(config.proxyProvider);
    }

    // Initialize rate limiter
    if (config.rateLimiter) {
      this.rateLimiter = config.rateLimiter;
    } else if (config.kvNamespace) {
      this.rateLimiter = new DistributedRateLimiter(config.kvNamespace);
    } else {
      this.rateLimiter = createRateLimiter();
    }

    // Initialize session store
    if (config.sessionStore) {
      this.sessionStore = config.sessionStore;
    } else if (config.kvNamespace) {
      this.sessionStore = new KVSessionStore(config.kvNamespace);
    } else {
      this.sessionStore = new MemorySessionStore();
    }
  }

  /**
   * Create a crawler for a specific court
   */
  createCrawler(courtId: string, configOverrides?: Partial<CrawlerConfig>): BaseCrawler {
    const CrawlerClass = crawlerRegistry.get(courtId);

    if (!CrawlerClass) {
      throw new Error(`No crawler registered for court: ${courtId}`);
    }

    const options: BaseCrawlerOptions = {
      courtId,
      config: configOverrides,
      proxyManager: this.proxyManager || undefined,
      rateLimiter: this.rateLimiter instanceof CourtRateLimiter ? this.rateLimiter : undefined,
      sessionStore: this.sessionStore,
    };

    const crawler = new CrawlerClass(options);

    logger.info('Crawler created', { courtId, hasProxy: !!this.proxyManager });

    return crawler;
  }

  /**
   * Get list of supported courts
   */
  getSupportedCourts(): string[] {
    return Array.from(crawlerRegistry.keys());
  }

  /**
   * Check if a court is supported
   */
  isCourtSupported(courtId: string): boolean {
    return crawlerRegistry.has(courtId);
  }

  /**
   * Get crawler configuration for a court
   */
  getCrawlerConfig(courtId: string): CrawlerConfig {
    return getCourtCrawlerConfig(courtId);
  }

  /**
   * Get proxy manager
   */
  getProxyManager(): ProxyManager | null {
    return this.proxyManager;
  }

  /**
   * Get rate limiter
   */
  getRateLimiter(): CourtRateLimiter | DistributedRateLimiter {
    return this.rateLimiter;
  }

  /**
   * Get session store
   */
  getSessionStore(): SessionStore {
    return this.sessionStore;
  }
}

/**
 * Create a crawler factory
 */
export function createCrawlerFactory(config?: CrawlerFactoryConfig): CrawlerFactory {
  return new CrawlerFactory(config);
}

/**
 * Quick helper to create a crawler with minimal config
 */
export async function createAndInitializeCrawler(
  courtId: string,
  options?: {
    useProxy?: boolean;
    configOverrides?: Partial<CrawlerConfig>;
  }
): Promise<BaseCrawler> {
  const factory = createCrawlerFactory({
    useProxy: options?.useProxy,
  });

  const crawler = factory.createCrawler(courtId, options?.configOverrides);
  await crawler.initialize();

  return crawler;
}

/**
 * Default export
 */
export default CrawlerFactory;
