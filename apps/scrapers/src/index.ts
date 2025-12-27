import app from './app';

export type Env = {
  // Bindings
  SCRAPE_RSS_FEED: Workflow;
  PROCESS_ARTICLES: Workflow;
  BROWSER: Fetcher;

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
};

export default {
  fetch: app.fetch,
  async scheduled({ cron }: ScheduledController, env: Env, ctx: ExecutionContext) {
    // - Every hour (at minute 4): trigger scrapping of RSS feeds
    if (cron === '4 * * * *') {
      await env.SCRAPE_RSS_FEED.create({ id: crypto.randomUUID() });
      console.log('Starting RSS feed scraping...');
      return;
    }
  },
} satisfies ExportedHandler<Env>;

export { ScrapeRssFeed } from './workflows/rssFeed.workflow';
export { ProcessArticles } from './workflows/processArticles.workflow';
