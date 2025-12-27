import { Hono } from 'hono';
import { ImageResponse } from 'workers-og';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { HonoEnv } from '../app';
import { escapeHtml } from '../lib/security';

const getBriefOpenGraph = (opts: { title: string; date: Date; totalArticles: number; totalSources: number }) =>
  `
<div style="display: flex; width: 100%; height: 100%; background-color: white">
  <div
    style="
      display: flex;
      height: 100%;
      width: 100%;
      align-items: center;
      justify-content: center;
      letter-spacing: -0.02em;
      font-weight: 700;
      position: relative;
    "
  >
    <div style="right: 42px; top: 42px; position: absolute; display: flex; align-items: center">
      <span style="margin-left: 8px; font-size: 20px; font-weight: normal; letter-spacing: normal">
        ${opts.date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
      </span>
    </div>

    <div style="left: 42px; bottom: 42px; position: absolute; display: flex; align-items: center">
      <span style="margin-left: 8px; font-size: 20px; font-weight: normal; letter-spacing: normal">
        Intelligence brief · ${opts.totalArticles} articles · ${opts.totalSources} sources
      </span>
    </div>

    <div style="right: 42px; bottom: 42px; position: absolute; display: flex; align-items: center">
      <span style="margin-left: 8px; font-size: 20px; font-weight: normal; letter-spacing: normal"> news.iliane.xyz </span>
    </div>

    <div
      style="
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        padding: 10px 25px;
        margin: 0 42px;
        font-size: 40px;
        width: auto;
        max-width: 600px;
        text-align: center;
        background-color: white;
        color: black;
        line-height: 1.4;
      "
    >
      ${escapeHtml(decodeURIComponent(opts.title.trim()))}
    </div>
  </div>
</div>`;

const getHomeOpenGraph = () => `
<div style="display: flex; width: 100%; height: 100%; background-color: white">
  <div
    style="
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      align-items: center;
      justify-content: center;
      letter-spacing: -0.02em;
      font-weight: 700;
      position: relative;
    "
  >
    <div
      style="
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        padding: 10px 25px;
        margin: 0 42px;
        font-size: 40px;
        width: auto;
        max-width: 600px;
        text-align: center;
        background-color: white;
        color: black;
        line-height: 1.4;
      "
    >
      Meridian
    </div>

    <div
      style="
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        padding: 10px 25px;
        margin: 0 42px;
        font-size: 20px;
        width: auto;
        max-width: 600px;
        text-align: center;
        background-color: white;
        color: black;
        font-weight: 100;
      "
    >
      a daily brief of everything important happening that i care about, with actual analysis beyond headlines
    </div>
  </div>
</div>`;

const route = new Hono<HonoEnv>()
  .get('/default', async c => {
    const response = new ImageResponse(getHomeOpenGraph(), { width: 1200, height: 630 });
    response.headers.set('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    return response;
  })
  .get(
    '/brief',
    zValidator(
      'query',
      z.object({
        title: z.string(),
        date: z.string().transform(val => new Date(parseInt(val))),
        articles: z.string().transform(val => parseInt(val)),
        sources: z.string().transform(val => parseInt(val)),
      })
    ),
    async c => {
      const query = c.req.valid('query');
      const response = new ImageResponse(
        getBriefOpenGraph({
          title: query.title,
          date: query.date,
          totalArticles: query.articles,
          totalSources: query.sources,
        }),
        { width: 1200, height: 630 }
      );

      // Cache brief images for longer since they don't change much despite having params
      response.headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=43200');
      return response;
    }
  );

export default route;
