/**
 * Proxy Configuration
 * Residential proxy support for court scraping
 */

import { logger } from '../lib/logger';
import type { ProxyConfig } from './types';

/**
 * Proxy provider types
 */
export type ProxyProvider = 'brightdata' | 'smartproxy' | 'oxylabs' | 'custom';

/**
 * Proxy pool configuration
 */
export interface ProxyPoolConfig {
  provider: ProxyProvider;
  username: string;
  password: string;
  host: string;
  port: number;
  country?: string;
  state?: string;
  city?: string;
  sessionDuration?: number;  // Minutes
  rotateOnEachRequest?: boolean;
}

/**
 * Proxy URL formats for different providers
 */
const PROXY_URL_FORMATS: Record<ProxyProvider, (config: ProxyPoolConfig, sessionId?: string) => string> = {
  brightdata: (config, sessionId) => {
    const session = sessionId ? `-session-${sessionId}` : '';
    const country = config.country ? `-country-${config.country}` : '';
    const state = config.state ? `-state-${config.state}` : '';
    const city = config.city ? `-city-${config.city}` : '';
    return `http://${config.username}${session}${country}${state}${city}:${config.password}@${config.host}:${config.port}`;
  },

  smartproxy: (config, sessionId) => {
    const session = sessionId ? `-session-${sessionId}` : '';
    const country = config.country ? `-cc-${config.country}` : '';
    const state = config.state ? `-state-${config.state}` : '';
    return `http://${config.username}${session}${country}${state}:${config.password}@${config.host}:${config.port}`;
  },

  oxylabs: (config, sessionId) => {
    const session = sessionId ? `-sessid-${sessionId}` : '';
    const country = config.country ? `-cc-${config.country}` : '';
    const state = config.state ? `-st-${config.state}` : '';
    const city = config.city ? `-city-${config.city}` : '';
    return `http://${config.username}${session}${country}${state}${city}:${config.password}@${config.host}:${config.port}`;
  },

  custom: (config) => {
    return `http://${config.username}:${config.password}@${config.host}:${config.port}`;
  },
};

/**
 * Default proxy hosts for providers
 */
const DEFAULT_PROXY_HOSTS: Record<ProxyProvider, { host: string; port: number }> = {
  brightdata: { host: 'brd.superproxy.io', port: 22225 },
  smartproxy: { host: 'gate.smartproxy.com', port: 7000 },
  oxylabs: { host: 'pr.oxylabs.io', port: 7777 },
  custom: { host: 'localhost', port: 8080 },
};

/**
 * Proxy manager for court scraping
 */
export class ProxyManager {
  private config: ProxyPoolConfig;
  private sessionCounter: number = 0;
  private currentSession: string | null = null;
  private sessionStartTime: number = 0;

  constructor(config: ProxyPoolConfig) {
    const defaults = DEFAULT_PROXY_HOSTS[config.provider];
    this.config = {
      ...config,
      host: config.host || defaults.host,
      port: config.port || defaults.port,
    };
  }

  /**
   * Get a proxy URL
   */
  getProxyUrl(newSession: boolean = false): string {
    let sessionId = this.currentSession;

    // Check if we need a new session
    const sessionExpired = this.config.sessionDuration &&
      Date.now() - this.sessionStartTime > this.config.sessionDuration * 60 * 1000;

    if (newSession || this.config.rotateOnEachRequest || !sessionId || sessionExpired) {
      sessionId = this.generateSessionId();
      this.currentSession = sessionId;
      this.sessionStartTime = Date.now();
    }

    const url = PROXY_URL_FORMATS[this.config.provider](this.config, sessionId);

    logger.debug('Generated proxy URL', {
      provider: this.config.provider,
      sessionId,
      country: this.config.country,
    });

    return url;
  }

  /**
   * Get proxy config for Playwright
   */
  getPlaywrightProxy(newSession: boolean = false): { server: string; username?: string; password?: string } {
    const sessionId = newSession || this.config.rotateOnEachRequest
      ? this.generateSessionId()
      : this.currentSession || this.generateSessionId();

    this.currentSession = sessionId;
    this.sessionStartTime = Date.now();

    // Build username with session and location
    let username = this.config.username;
    if (sessionId) username += `-session-${sessionId}`;
    if (this.config.country) username += `-country-${this.config.country}`;
    if (this.config.state) username += `-state-${this.config.state}`;
    if (this.config.city) username += `-city-${this.config.city}`;

    return {
      server: `http://${this.config.host}:${this.config.port}`,
      username,
      password: this.config.password,
    };
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    this.sessionCounter++;
    return `court${Date.now()}${this.sessionCounter}`;
  }

  /**
   * Rotate to a new session
   */
  rotateSession(): void {
    this.currentSession = this.generateSessionId();
    this.sessionStartTime = Date.now();
    logger.debug('Rotated proxy session', { sessionId: this.currentSession });
  }

  /**
   * Get current session info
   */
  getSessionInfo(): { sessionId: string | null; startTime: number; age: number } {
    return {
      sessionId: this.currentSession,
      startTime: this.sessionStartTime,
      age: this.sessionStartTime ? Date.now() - this.sessionStartTime : 0,
    };
  }
}

/**
 * Proxy configuration for California court scraping
 */
export const CALIFORNIA_PROXY_CONFIG: Partial<ProxyPoolConfig> = {
  country: 'us',
  state: 'california',
  sessionDuration: 30,  // 30 minutes
  rotateOnEachRequest: false,
};

/**
 * Create proxy manager from environment variables
 */
export function createProxyManagerFromEnv(provider: ProxyProvider = 'brightdata'): ProxyManager | null {
  const username = process.env.PROXY_USERNAME;
  const password = process.env.PROXY_PASSWORD;

  if (!username || !password) {
    logger.warn('Proxy credentials not found in environment');
    return null;
  }

  return new ProxyManager({
    provider,
    username,
    password,
    ...DEFAULT_PROXY_HOSTS[provider],
    ...CALIFORNIA_PROXY_CONFIG,
  });
}

/**
 * Create proxy config from simple URL
 */
export function parseProxyUrl(url: string): ProxyConfig {
  const parsed = new URL(url);

  return {
    url,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    type: parsed.protocol.replace(':', '') as 'http' | 'https' | 'socks5',
    isResidential: url.includes('residential') || url.includes('brd') || url.includes('smartproxy'),
  };
}

/**
 * Validate proxy is working
 */
export async function validateProxy(proxyUrl: string): Promise<{ valid: boolean; ip?: string; location?: string; latency?: number }> {
  const startTime = Date.now();

  try {
    // Use a simple IP check service
    const response = await fetch('https://api.ipify.org?format=json', {
      // Note: In production, you'd configure the fetch to use the proxy
      // This is a placeholder for validation logic
    });

    if (!response.ok) {
      return { valid: false };
    }

    const data = await response.json() as { ip: string };

    return {
      valid: true,
      ip: data.ip,
      latency: Date.now() - startTime,
    };
  } catch (error) {
    logger.error('Proxy validation failed', { error: String(error) });
    return { valid: false };
  }
}
