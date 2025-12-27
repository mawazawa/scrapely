/**
 * Time series analytics endpoint
 * Returns historical data for charts
 */

import { getDb } from '@meridian/database';
import { $articles, $reports, sql, and, gte, lte } from '@meridian/database';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const db = getDb(config.databaseUrl);

  const query = getQuery(event);
  const days = Math.min(Number(query.days) || 30, 90); // Max 90 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  try {
    // Get article counts by day
    const articlesByDay = await db.execute<{
      date: string;
      total: number;
      relevant: number;
      irrelevant: number;
    }>(sql`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as total,
        SUM(CASE WHEN relevance = 'RELEVANT' THEN 1 ELSE 0 END) as relevant,
        SUM(CASE WHEN relevance = 'IRRELEVANT' THEN 1 ELSE 0 END) as irrelevant
      FROM articles
      WHERE created_at >= ${startDate.toISOString()}
        AND created_at <= ${endDate.toISOString()}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    // Get report counts by day
    const reportsByDay = await db.execute<{
      date: string;
      count: number;
    }>(sql`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM reports
      WHERE created_at >= ${startDate.toISOString()}
        AND created_at <= ${endDate.toISOString()}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    // Get source performance (articles per source)
    const sourcePerformance = await db.execute<{
      source_id: number;
      source_name: string;
      total_articles: number;
      relevant_articles: number;
      success_rate: number;
    }>(sql`
      SELECT
        s.id as source_id,
        s.name as source_name,
        COUNT(a.id) as total_articles,
        SUM(CASE WHEN a.relevance = 'RELEVANT' THEN 1 ELSE 0 END) as relevant_articles,
        ROUND(100.0 * SUM(CASE WHEN a.relevance = 'RELEVANT' THEN 1 ELSE 0 END) / NULLIF(COUNT(a.id), 0), 1) as success_rate
      FROM sources s
      LEFT JOIN articles a ON a.source_id = s.id
        AND a.created_at >= ${startDate.toISOString()}
      GROUP BY s.id, s.name
      ORDER BY total_articles DESC
      LIMIT 20
    `);

    // Get processing metrics (if available)
    const processingMetrics = await db.execute<{
      date: string;
      avg_processing_time_ms: number;
      processed_count: number;
    }>(sql`
      SELECT
        DATE(processed_at) as date,
        AVG(EXTRACT(EPOCH FROM (processed_at - created_at)) * 1000) as avg_processing_time_ms,
        COUNT(*) as processed_count
      FROM articles
      WHERE processed_at IS NOT NULL
        AND processed_at >= ${startDate.toISOString()}
      GROUP BY DATE(processed_at)
      ORDER BY date ASC
    `);

    // Fill in missing dates with zeros
    const filledArticles = fillMissingDates(
      articlesByDay.rows || [],
      startDate,
      endDate,
      { total: 0, relevant: 0, irrelevant: 0 }
    );

    const filledReports = fillMissingDates(
      reportsByDay.rows || [],
      startDate,
      endDate,
      { count: 0 }
    );

    return {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        days,
      },
      articles: {
        timeseries: filledArticles,
        summary: {
          total: filledArticles.reduce((sum, d) => sum + (d.total || 0), 0),
          relevant: filledArticles.reduce((sum, d) => sum + (d.relevant || 0), 0),
          irrelevant: filledArticles.reduce((sum, d) => sum + (d.irrelevant || 0), 0),
        },
      },
      reports: {
        timeseries: filledReports,
        total: filledReports.reduce((sum, d) => sum + (d.count || 0), 0),
      },
      sources: sourcePerformance.rows || [],
      processing: {
        timeseries: processingMetrics.rows || [],
        avgProcessingTime:
          processingMetrics.rows && processingMetrics.rows.length > 0
            ? Math.round(
                processingMetrics.rows.reduce((sum, d) => sum + (d.avg_processing_time_ms || 0), 0) /
                  processingMetrics.rows.length
              )
            : null,
      },
    };
  } catch (error) {
    console.error('Analytics error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch analytics data',
    });
  }
});

/**
 * Fill missing dates in a time series
 */
function fillMissingDates<T extends Record<string, unknown>>(
  data: Array<{ date: string } & T>,
  startDate: Date,
  endDate: Date,
  defaults: Omit<T, 'date'>
): Array<{ date: string } & T> {
  const dateMap = new Map(data.map((d) => [d.date, d]));
  const result: Array<{ date: string } & T> = [];

  const current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];
    const existing = dateMap.get(dateStr);

    if (existing) {
      result.push(existing);
    } else {
      result.push({ date: dateStr, ...defaults } as { date: string } & T);
    }

    current.setDate(current.getDate() + 1);
  }

  return result;
}
