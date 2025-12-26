import { err, ok, Result, ResultAsync } from 'neverthrow';
import { Env } from '../index';

/**
 * Firecrawl Integration for AI-powered web scraping
 * Uses the /agent endpoint (Dec 2025) for complex navigation
 */

interface FirecrawlScrapeResult {
  success: boolean;
  data?: {
    markdown: string;
    metadata: {
      title: string;
      description?: string;
      publishedTime?: string;
      author?: string;
    };
  };
  error?: string;
}

interface FirecrawlAgentResult {
  success: boolean;
  data?: {
    content: string;
    markdown: string;
    extractedData?: Record<string, unknown>;
  };
  error?: string;
}

// Domains that benefit from Firecrawl's AI scraping
export const FIRECRAWL_DOMAINS: Record<string, 'agent' | 'scrape'> = {
  'reuters.com': 'agent',
  'nytimes.com': 'agent',
  'wsj.com': 'agent',
  'bloomberg.com': 'agent',
  'economist.com': 'agent',
  'ft.com': 'scrape',
  'washingtonpost.com': 'agent',
  'theguardian.com': 'scrape',
};

export function shouldUseFirecrawl(url: string): 'agent' | 'scrape' | false {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return FIRECRAWL_DOMAINS[domain] || false;
  } catch {
    return false;
  }
}

/**
 * Standard Firecrawl scrape - converts page to LLM-ready markdown
 */
export async function firecrawlScrape(
  env: Env,
  url: string
): Promise<Result<{ title: string; text: string; publishedTime?: string }, Error>> {
  if (!env.FIRECRAWL_API_KEY) {
    return err(new Error('Firecrawl API key not configured'));
  }

  const result = await ResultAsync.fromPromise(
    fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 2000,
      }),
    }).then(res => res.json() as Promise<FirecrawlScrapeResult>),
    e => (e instanceof Error ? e : new Error(String(e)))
  );

  if (result.isErr()) return err(result.error);

  const data = result.value;
  if (!data.success || !data.data) {
    return err(new Error(data.error || 'Firecrawl scrape failed'));
  }

  return ok({
    title: data.data.metadata.title || 'Untitled',
    text: data.data.markdown,
    publishedTime: data.data.metadata.publishedTime,
  });
}

/**
 * Firecrawl Agent - AI-powered navigation for complex sites
 * Handles paywalls, dynamic content, multi-step navigation
 */
export async function firecrawlAgent(
  env: Env,
  url: string,
  objective: string = 'Extract the full article text, title, author, and publication date'
): Promise<Result<{ title: string; text: string; publishedTime?: string }, Error>> {
  if (!env.FIRECRAWL_API_KEY) {
    return err(new Error('Firecrawl API key not configured'));
  }

  const result = await ResultAsync.fromPromise(
    fetch('https://api.firecrawl.dev/v1/agent', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        objective,
        formats: ['markdown'],
        maxSteps: 10,
      }),
    }).then(res => res.json() as Promise<FirecrawlAgentResult>),
    e => (e instanceof Error ? e : new Error(String(e)))
  );

  if (result.isErr()) return err(result.error);

  const data = result.value;
  if (!data.success || !data.data) {
    return err(new Error(data.error || 'Firecrawl agent failed'));
  }

  // Extract title from markdown (first # heading)
  const titleMatch = data.data.markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1] || 'Untitled';

  return ok({
    title,
    text: data.data.markdown,
    publishedTime: undefined,
  });
}

/**
 * Smart scrape - automatically chooses the best method
 */
export async function smartFirecrawlScrape(
  env: Env,
  url: string
): Promise<Result<{ title: string; text: string; publishedTime?: string }, Error>> {
  const method = shouldUseFirecrawl(url);

  if (method === 'agent') {
    return firecrawlAgent(env, url);
  }

  return firecrawlScrape(env, url);
}
