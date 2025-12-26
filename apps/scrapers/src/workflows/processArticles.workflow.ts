import getArticleAnalysisPrompt, { articleAnalysisSchema } from '../prompts/articleAnalysis.prompt';
import { $articles, and, eq, gte, isNull, sql } from '@meridian/database';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { Env } from '../index';
import { generateObject } from 'ai';
import { getArticleWithBrowser, getArticleWithFetch } from '../lib/puppeteer';
import { getDb } from '../lib/utils';
import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent, WorkflowStepConfig } from 'cloudflare:workers';
import { err, ok } from 'neverthrow';
import { ResultAsync } from 'neverthrow';
import { DomainRateLimiter } from '../lib/rateLimiter';
import { shouldUseFirecrawl, smartFirecrawlScrape } from '../lib/firecrawl';
import { isPdfUrl, processDocument } from '../lib/documentOcr';
import { MODELS } from '../lib/models';

type Params = Record<string, unknown>;

const dbStepConfig: WorkflowStepConfig = {
  retries: { limit: 3, delay: '1 second', backoff: 'linear' },
  timeout: '5 seconds',
};

// Main workflow class
export class ProcessArticles extends WorkflowEntrypoint<Env, Params> {
  async run(_event: WorkflowEvent<Params>, step: WorkflowStep) {
    const env = this.env;
    const db = getDb(env);

    // Use Gemini 3 Flash for article analysis (Dec 2025)
    const google = createGoogleGenerativeAI({ apiKey: env.GOOGLE_API_KEY, baseURL: env.GOOGLE_BASE_URL });
    const analysisModel = MODELS.analysis;

    async function getUnprocessedArticles(opts: { limit?: number }) {
      const articles = await db
        .select({
          id: $articles.id,
          url: $articles.url,
          title: $articles.title,
          publishedAt: $articles.publishDate,
        })
        .from($articles)
        .where(
          and(
            // only process articles that haven't been processed yet
            isNull($articles.processedAt),
            // only process articles that have a publish date in the last 48 hours
            gte($articles.publishDate, new Date(new Date().getTime() - 48 * 60 * 60 * 1000)),
            // only articles that have not failed
            isNull($articles.failReason)
          )
        )
        .limit(opts.limit ?? 100)
        .orderBy(sql`RANDOM()`);
      return articles;
    }

    // get articles to process
    const articles = await step.do('get articles', dbStepConfig, async () => getUnprocessedArticles({ limit: 200 }));

    // Create rate limiter with article processing specific settings
    const rateLimiter = new DomainRateLimiter<{
      id: number;
      url: string;
      title: string;
      publishedAt: Date | null;
    }>({
      maxConcurrent: 8,
      globalCooldownMs: 1000,
      domainCooldownMs: 5000,
    });

    const articlesToProcess: Array<{
      id: number;
      title: string;
      text: string;
      publishedTime?: string;
      source: 'fetch' | 'browser' | 'firecrawl' | 'ocr';
    }> = [];

    // Process articles with rate limiting
    const articleResults = await rateLimiter.processBatch(articles, step, async (article, domain) => {
      const result = await step.do(
        `scrape article ${article.id}`,
        {
          retries: { limit: 3, delay: '2 second', backoff: 'exponential' },
          timeout: '2 minutes',
        },
        async () => {
          let articleData: { title: string; text: string; publishedTime?: string } | undefined = undefined;
          let source: 'fetch' | 'browser' | 'firecrawl' | 'ocr' = 'fetch';

          // 1. Check if PDF - use Gemini 3 or Mistral OCR 3
          if (isPdfUrl(article.url)) {
            const ocrResult = await processDocument(env, article.url);
            if (ocrResult.isErr()) {
              return { id: article.id, success: false, error: ocrResult.error.message };
            }
            articleData = {
              title: ocrResult.value.title,
              text: ocrResult.value.text,
            };
            source = 'ocr';
            console.log(`[OCR:${ocrResult.value.provider}] Processed PDF: ${article.url}${ocrResult.value.pages ? ` (${ocrResult.value.pages} pages)` : ''}`);
          }

          // 2. Check if Firecrawl domain - use AI scraping
          const firecrawlMode = shouldUseFirecrawl(article.url);
          if (!articleData && firecrawlMode && env.FIRECRAWL_API_KEY) {
            const fcResult = await smartFirecrawlScrape(env, article.url);
            if (fcResult.isOk()) {
              articleData = fcResult.value;
              source = 'firecrawl';
              console.log(`[Firecrawl:${firecrawlMode}] Scraped: ${article.url}`);
            }
            // Fall through to other methods if Firecrawl fails
          }

          // 3. Try light fetch first
          if (!articleData) {
            const lightResult = await getArticleWithFetch(article.url);
            if (lightResult.isOk()) {
              articleData = lightResult.value;
              source = 'fetch';
            }
          }

          // 4. Fall back to browser rendering
          if (!articleData) {
            const jitterTime = Math.random() * 2500 + 500;
            await step.sleep(`jitter`, jitterTime);

            const browserResult = await getArticleWithBrowser(env, article.url);
            if (browserResult.isErr()) {
              return { id: article.id, success: false, error: browserResult.error.error };
            }
            articleData = browserResult.value;
            source = 'browser';
          }

          return { id: article.id, success: true, data: articleData, source };
        }
      );

      return result;
    });

    // Handle results
    for (const result of articleResults) {
      if (result.success && 'data' in result && result.data) {
        articlesToProcess.push({
          id: result.id,
          title: result.data.title,
          text: result.data.text,
          publishedTime: result.data.publishedTime,
          source: result.source,
        });
      } else {
        // update failed articles in DB with the fail reason
        await step.do(`update db for failed article ${result.id}`, dbStepConfig, async () => {
          await db
            .update($articles)
            .set({
              processedAt: new Date(),
              failReason: 'error' in result && result.error ? String(result.error) : 'Unknown error',
            })
            .where(eq($articles.id, result.id));
        });
      }
    }

    // Process with LLM - using Gemini 3 Flash with thinking levels
    await Promise.all(
      articlesToProcess.map(async article => {
        const articleAnalysis = await step.do(
          `analyze article ${article.id}`,
          {
            retries: { limit: 3, delay: '2 seconds', backoff: 'exponential' },
            timeout: '1 minute',
          },
          async () => {
            // Use Gemini 3 Flash with low thinking level for standard analysis
            const response = await generateObject({
              model: google(analysisModel.model),
              temperature: 0,
              prompt: getArticleAnalysisPrompt(article.title, article.text),
              schema: articleAnalysisSchema,
              // Gemini 3 thinking level configuration
              experimental_providerMetadata: {
                google: {
                  thinkingConfig: {
                    thinkingLevel: analysisModel.thinkingLevel || 'low',
                  },
                },
              },
            });
            return response.object;
          }
        );

        // update db
        await step.do(`update db for article ${article.id}`, dbStepConfig, async () => {
          await db
            .update($articles)
            .set({
              processedAt: new Date(),
              content: article.text,
              title: article.title,
              completeness: articleAnalysis.completeness,
              relevance: articleAnalysis.relevance,
              language: articleAnalysis.language,
              location: articleAnalysis.location,
              summary: (() => {
                if (articleAnalysis.summary === undefined) return null;
                let txt = '';
                txt += `HEADLINE: ${articleAnalysis.summary.headline.trim()}\n`;
                txt += `ENTITIES: ${articleAnalysis.summary.entities.join(', ')}\n`;
                txt += `EVENT: ${articleAnalysis.summary.event.trim()}\n`;
                txt += `CONTEXT: ${articleAnalysis.summary.context.trim()}\n`;
                return txt.trim();
              })(),
            })
            .where(eq($articles.id, article.id))
            .execute();
        });
      })
    );

    console.log(`Processed ${articlesToProcess.length} articles`);

    // Log source breakdown
    const sourceBreakdown = articlesToProcess.reduce(
      (acc, a) => {
        acc[a.source] = (acc[a.source] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    console.log(`Source breakdown:`, sourceBreakdown);

    // check if there are articles to process still
    const remainingArticles = await step.do('get remaining articles', dbStepConfig, async () =>
      getUnprocessedArticles({ limit: 100 })
    );
    if (remainingArticles.length > 0) {
      console.log(`Found at least ${remainingArticles.length} remaining articles to process`);

      // trigger the workflow again
      await step.do('trigger_article_processor', dbStepConfig, async () => {
        const workflow = await this.env.PROCESS_ARTICLES.create({ id: crypto.randomUUID() });
        return workflow.id;
      });
    }
  }
}

// helper to start the workflow from elsewhere
export async function startProcessArticleWorkflow(env: Env) {
  const workflow = await ResultAsync.fromPromise(env.PROCESS_ARTICLES.create({ id: crypto.randomUUID() }), e =>
    e instanceof Error ? e : new Error(String(e))
  );
  if (workflow.isErr()) {
    return err(workflow.error);
  }
  return ok(workflow.value);
}
