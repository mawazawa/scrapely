import app from './app';
import { initSentry, captureException, addBreadcrumb } from './lib/sentry';

export type Env = {
  // Bindings
  SCRAPE_RSS_FEED: Workflow;
  PROCESS_ARTICLES: Workflow;
  SEND_NEWSLETTER?: Workflow;
  BROWSER: Fetcher;
  CACHE_KV?: KVNamespace;
  STATS_ROOM?: DurableObjectNamespace;

  // Secrets
  CLOUDFLARE_BROWSER_RENDERING_API_TOKEN: string;
  CLOUDFLARE_ACCOUNT_ID: string;

  DATABASE_URL: string;

  // Google Gemini 3 (primary)
  GOOGLE_API_KEY: string;
  GOOGLE_BASE_URL: string;

  // OpenAI GPT-5.2 (briefs synthesis)
  OPENAI_API_KEY?: string;

  // Anthropic Claude 4.5 (fallback)
  ANTHROPIC_API_KEY?: string;

  // Mistral OCR 3 (document processing)
  MISTRAL_API_KEY?: string;

  // Firecrawl (AI scraping)
  FIRECRAWL_API_KEY?: string;

  // Email (Resend)
  RESEND_API_KEY?: string;

  MERIDIAN_SECRET_KEY: string;

  // Sentry Error Tracking
  SENTRY_DSN?: string;
  SENTRY_RELEASE?: string;
  ENVIRONMENT?: string;
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Initialize Sentry for this request
    initSentry(env, ctx);

    try {
      return await app.fetch(request, env, ctx);
    } catch (error) {
      // Capture unhandled errors in Sentry
      captureException(error, {
        tags: {
          handler: 'fetch',
          url: new URL(request.url).pathname,
        },
        extra: {
          method: request.method,
          url: request.url,
        },
      });
      throw error;
    }
  },

  async scheduled({ cron }: ScheduledController, env: Env, ctx: ExecutionContext) {
    // Initialize Sentry for this scheduled event
    initSentry(env, ctx);

    addBreadcrumb({
      category: 'cron',
      message: `Scheduled job triggered: ${cron}`,
      level: 'info',
    });

    try {
      // - Every hour (at minute 4): trigger scrapping of RSS feeds
      if (cron === '4 * * * *') {
        await env.SCRAPE_RSS_FEED.create({ id: crypto.randomUUID() });
        console.log('Starting RSS feed scraping...');
        return;
      }

      // - Daily at 08:00 UTC: send newsletter
      if (cron === '0 8 * * *') {
        if (env.SEND_NEWSLETTER) {
          await env.SEND_NEWSLETTER.create({ id: crypto.randomUUID() });
          console.log('Starting newsletter delivery...');
        }
        return;
      }
    } catch (error) {
      captureException(error, {
        tags: {
          handler: 'scheduled',
          cron,
        },
      });
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;

export { ScrapeRssFeed } from './workflows/rssFeed.workflow';
export { ProcessArticles } from './workflows/processArticles.workflow';
export { SendNewsletter } from './workflows/newsletter.workflow';
export { StatsRoom } from './durable/StatsRoom';
