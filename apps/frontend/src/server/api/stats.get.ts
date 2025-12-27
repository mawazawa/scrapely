import { $articles, $sources, $reports, sql, gte, eq, isNotNull, isNull, and, desc, count } from '@meridian/database';
import { getDb } from '@meridian/database';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const db = getDb(config.DATABASE_URL);

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get stats in parallel
  const [
    totalSources,
    totalArticles,
    articlesLast24h,
    processedLast24h,
    pendingArticles,
    failedArticles,
    recentReports,
    sourceBreakdown,
    relevanceBreakdown,
  ] = await Promise.all([
    // Total sources
    db.select({ count: sql<number>`count(*)` }).from($sources),

    // Total articles
    db.select({ count: sql<number>`count(*)` }).from($articles),

    // Articles scraped in last 24h
    db
      .select({ count: sql<number>`count(*)` })
      .from($articles)
      .where(gte($articles.createdAt, last24h)),

    // Articles processed in last 24h
    db
      .select({ count: sql<number>`count(*)` })
      .from($articles)
      .where(gte($articles.processedAt, last24h)),

    // Pending articles (not processed, no fail reason) - using parameterized query
    db
      .select({ count: sql<number>`count(*)` })
      .from($articles)
      .where(and(isNull($articles.processedAt), isNull($articles.failReason))),

    // Failed articles
    db
      .select({ count: sql<number>`count(*)` })
      .from($articles)
      .where(isNotNull($articles.failReason)),

    // Recent reports - using desc() instead of raw SQL
    db
      .select({
        id: $reports.id,
        title: $reports.title,
        createdAt: $reports.createdAt,
        totalArticles: $reports.totalArticles,
      })
      .from($reports)
      .orderBy(desc($reports.createdAt))
      .limit(5),

    // Articles by source (top 10)
    db
      .select({
        sourceName: $sources.name,
        count: sql<number>`count(${$articles.id})`,
      })
      .from($articles)
      .innerJoin($sources, eq($articles.sourceId, $sources.id))
      .where(gte($articles.createdAt, last7d))
      .groupBy($sources.name)
      .orderBy(sql`count(${$articles.id}) DESC`)
      .limit(10),

    // Relevance breakdown (last 7 days)
    db
      .select({
        relevance: $articles.relevance,
        count: sql<number>`count(*)`,
      })
      .from($articles)
      .where(gte($articles.createdAt, last7d))
      .groupBy($articles.relevance),
  ]);

  return {
    overview: {
      totalSources: totalSources[0]?.count || 0,
      totalArticles: totalArticles[0]?.count || 0,
      articlesLast24h: articlesLast24h[0]?.count || 0,
      processedLast24h: processedLast24h[0]?.count || 0,
      pendingArticles: pendingArticles[0]?.count || 0,
      failedArticles: failedArticles[0]?.count || 0,
    },
    recentReports,
    sourceBreakdown,
    relevanceBreakdown,
    models: {
      analysis: 'Gemini 3 Flash',
      synthesis: 'GPT-5.2 Thinking',
      ocr: 'Mistral OCR 3',
      scraping: 'Firecrawl Agent',
    },
  };
});
