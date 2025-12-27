/**
 * RSS Feed Discovery
 * Discovers and validates RSS feeds from URLs and topics
 */

import { logger } from './logger';
import { parseRSSFeed } from './parsers';

/**
 * Discovered feed
 */
export interface DiscoveredFeed {
  url: string;
  title: string;
  description?: string;
  type: 'rss' | 'atom' | 'json';
  lastUpdated?: Date;
  itemCount?: number;
  language?: string;
  category?: string;
  source: 'autodiscover' | 'google-news' | 'manual';
}

/**
 * Common RSS feed paths to check
 */
const FEED_PATHS = [
  '/feed',
  '/rss',
  '/feed.xml',
  '/rss.xml',
  '/atom.xml',
  '/feed/rss',
  '/feeds/posts/default',
  '/index.xml',
  '/blog/feed',
  '/news/feed',
  '/.rss',
];

/**
 * Google News RSS base URL
 */
const GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search';

/**
 * Discover feeds from a website URL
 */
export async function discoverFeedsFromUrl(url: string): Promise<DiscoveredFeed[]> {
  const discovered: DiscoveredFeed[] = [];
  const baseUrl = new URL(url);
  const origin = baseUrl.origin;

  // Try to fetch the page and look for feed links
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MeridianBot/1.0)' },
    });

    if (response.ok) {
      const html = await response.text();

      // Look for link tags with RSS/Atom types
      const feedLinkPattern = /<link[^>]+type=["']application\/(rss|atom)\+xml["'][^>]*>/gi;
      const matches = html.matchAll(feedLinkPattern);

      for (const match of matches) {
        const hrefMatch = match[0].match(/href=["']([^"']+)["']/i);
        const titleMatch = match[0].match(/title=["']([^"']+)["']/i);

        if (hrefMatch) {
          let feedUrl = hrefMatch[1];
          if (feedUrl.startsWith('/')) {
            feedUrl = origin + feedUrl;
          } else if (!feedUrl.startsWith('http')) {
            feedUrl = origin + '/' + feedUrl;
          }

          discovered.push({
            url: feedUrl,
            title: titleMatch?.[1] || baseUrl.hostname,
            type: match[1] === 'atom' ? 'atom' : 'rss',
            source: 'autodiscover',
          });
        }
      }
    }
  } catch (error) {
    logger.debug('Failed to fetch page for autodiscovery', { url, error: String(error) });
  }

  // Try common feed paths
  for (const path of FEED_PATHS) {
    const feedUrl = origin + path;
    const isValid = await validateFeed(feedUrl);

    if (isValid) {
      discovered.push({
        url: feedUrl,
        title: baseUrl.hostname,
        type: 'rss',
        source: 'autodiscover',
      });
      break; // Found a working feed, no need to check more paths
    }
  }

  return discovered;
}

/**
 * Validate if a URL is a valid RSS/Atom feed
 */
export async function validateFeed(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MeridianBot/1.0)' },
    });

    if (!response.ok) return false;

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    // Check content type
    if (
      contentType.includes('xml') ||
      contentType.includes('rss') ||
      contentType.includes('atom')
    ) {
      return true;
    }

    // Check content for RSS/Atom markers
    if (
      text.includes('<rss') ||
      text.includes('<feed') ||
      text.includes('<channel>')
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Get feed details
 */
export async function getFeedDetails(url: string): Promise<DiscoveredFeed | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MeridianBot/1.0)' },
    });

    if (!response.ok) return null;

    const text = await response.text();
    const parseResult = await parseRSSFeed(text);

    if (parseResult.isErr()) return null;

    const items = parseResult.value;
    const isAtom = text.includes('<feed');

    // Extract feed title from XML
    const titleMatch = text.match(/<title>([^<]+)<\/title>/);

    return {
      url,
      title: titleMatch?.[1] || new URL(url).hostname,
      type: isAtom ? 'atom' : 'rss',
      itemCount: items.length,
      lastUpdated: items[0]?.pubDate || undefined,
      source: 'autodiscover',
    };
  } catch {
    return null;
  }
}

/**
 * Discover feeds by topic using Google News
 */
export async function discoverFeedsByTopic(topic: string, language: string = 'en'): Promise<DiscoveredFeed[]> {
  const encodedTopic = encodeURIComponent(topic);
  const url = `${GOOGLE_NEWS_RSS}?q=${encodedTopic}&hl=${language}`;

  const isValid = await validateFeed(url);

  if (isValid) {
    return [{
      url,
      title: `Google News: ${topic}`,
      type: 'rss',
      category: topic,
      language,
      source: 'google-news',
    }];
  }

  return [];
}

/**
 * Bulk import feeds from OPML
 */
export function parseOPML(opmlContent: string): DiscoveredFeed[] {
  const feeds: DiscoveredFeed[] = [];

  // Simple regex-based OPML parsing
  const outlinePattern = /<outline[^>]+>/gi;
  const matches = opmlContent.matchAll(outlinePattern);

  for (const match of matches) {
    const xmlUrl = match[0].match(/xmlUrl=["']([^"']+)["']/i);
    const title = match[0].match(/title=["']([^"']+)["']/i);
    const text = match[0].match(/text=["']([^"']+)["']/i);
    const type = match[0].match(/type=["']([^"']+)["']/i);

    if (xmlUrl) {
      feeds.push({
        url: xmlUrl[1],
        title: title?.[1] || text?.[1] || 'Unknown',
        type: type?.[1]?.toLowerCase() === 'atom' ? 'atom' : 'rss',
        source: 'manual',
      });
    }
  }

  return feeds;
}

/**
 * Generate OPML export
 */
export function generateOPML(feeds: DiscoveredFeed[], title: string = 'Meridian Feeds'): string {
  const outlines = feeds.map(feed =>
    `    <outline type="${feed.type}" text="${escapeXml(feed.title)}" title="${escapeXml(feed.title)}" xmlUrl="${escapeXml(feed.url)}" />`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>${escapeXml(title)}</title>
    <dateCreated>${new Date().toISOString()}</dateCreated>
  </head>
  <body>
${outlines}
  </body>
</opml>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Suggest feeds based on category
 */
export const SUGGESTED_FEEDS: Record<string, string[]> = {
  politics: [
    'https://feeds.reuters.com/reuters/politicsNews',
    'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml',
  ],
  technology: [
    'https://feeds.arstechnica.com/arstechnica/index',
    'https://www.theverge.com/rss/index.xml',
  ],
  economics: [
    'https://feeds.reuters.com/reuters/businessNews',
    'https://www.economist.com/finance-and-economics/rss.xml',
  ],
  security: [
    'https://feeds.feedburner.com/TheHackersNews',
    'https://www.schneier.com/feed/atom',
  ],
};

/**
 * Get suggested feeds for a category
 */
export function getSuggestedFeeds(category: string): string[] {
  return SUGGESTED_FEEDS[category.toLowerCase()] || [];
}
