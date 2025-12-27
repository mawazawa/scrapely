import { $articles, $sources, and, gte, lte, isNotNull, eq, not } from '@meridian/database';
import { Env } from './index';
import { getDb, hasValidAuthToken } from './lib/utils';
import { Hono } from 'hono';
import { trimTrailingSlash } from 'hono/trailing-slash';
import openGraph from './routers/openGraph.router';
import reportsRouter from './routers/reports.router';
import { SECURITY_HEADERS, checkAuthRateLimit, recordFailedAuth, isValidDateFormat } from './lib/security';

export type HonoEnv = { Bindings: Env };

const app = new Hono<HonoEnv>()
  // Add security headers to all responses
  .use('*', async (c, next) => {
    await next();
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      c.res.headers.set(key, value);
    }
  })
  // Global error handler
  .onError((err, c) => {
    console.error('[Error]', err.message);
    return c.json({ error: 'Internal server error' }, 500);
  })
  .use(trimTrailingSlash())
  .get('/favicon.ico', async c => c.notFound()) // disable favicon
  .route('/reports', reportsRouter)
  .route('/openGraph', openGraph)
  .get('/ping', async c => c.json({ pong: true }))
  .get('/events', async c => {
    // Get client IP for rate limiting
    const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';

    // Check rate limit before auth
    const rateCheck = checkAuthRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return c.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
      );
    }

    // require bearer auth token
    const hasValidToken = hasValidAuthToken(c);
    if (!hasValidToken) {
      recordFailedAuth(clientIp);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check if a date query parameter was provided in yyyy-mm-dd format
    const dateParam = c.req.query('date');

    let endDate: Date;
    if (dateParam) {
      // Validate date format strictly
      if (!isValidDateFormat(dateParam)) {
        return c.json({ error: 'Invalid date format. Please use YYYY-MM-DD' }, 400);
      }
      // Parse the date parameter explicitly with UTC
      // Append T07:00:00Z to ensure it's 7am UTC
      endDate = new Date(`${dateParam}T07:00:00Z`);
    } else {
      // Use current date if no date parameter was provided
      endDate = new Date();
      // Set to 7am UTC today
      endDate.setUTCHours(7, 0, 0, 0);
    }

    // Create a 30-hour window ending at 7am UTC on the specified date
    const startDate = new Date(endDate.getTime() - 30 * 60 * 60 * 1000);

    const db = getDb(c.env.DATABASE_URL);

    const allSources = await db.select({ id: $sources.id, name: $sources.name }).from($sources);

    let events = await db
      .select({
        id: $articles.id,
        sourceId: $articles.sourceId,
        url: $articles.url,
        title: $articles.title,
        publishDate: $articles.publishDate,
        content: $articles.content,
        location: $articles.location,
        completeness: $articles.completeness,
        relevance: $articles.relevance,
        summary: $articles.summary,
        createdAt: $articles.createdAt,
      })
      .from($articles)
      .where(
        and(
          isNotNull($articles.location),
          gte($articles.publishDate, startDate),
          lte($articles.publishDate, endDate),
          eq($articles.relevance, 'RELEVANT'),
          not(eq($articles.completeness, 'PARTIAL_USELESS')),
          isNotNull($articles.summary)
        )
      );

    const response = {
      sources: allSources,
      events,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    };

    return c.json(response);
  });

export default app;
