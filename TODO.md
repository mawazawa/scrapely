# Meridian TODO: Next 10 Highest Leverage Actions

> **Last Updated**: 2025-12-27T18:00:00Z
> **Research Validated**: December 27, 2025
> **Previous Actions Completed**: 39 (see CHANGELOG.md)

---

## Recently Completed (This Session)

| # | Action | Confidence | Status |
|---|--------|------------|--------|
| 1 | Create API Documentation with OpenAPI | 91% | ✅ Completed |
| 2 | Add Database Migrations for New Features | 92% | ✅ Completed |
| 3 | Implement Rate Limiting per User | 90% | ✅ Completed |
| 4 | Add Batch Article Processing | 86% | ✅ Completed |
| 5 | Create Admin API for Source Management | 85% | ✅ Completed |
| 6 | Implement Brief Scheduling UI | 83% | ✅ Completed |
| 7 | Add Export Functionality (PDF/Email) | 80% | ✅ Completed |
| 8 | Create Mobile-Optimized PWA | 78% | ✅ Completed |
| 9 | Implement A/B Testing Framework | 75% | ✅ Completed |

---

## Next 10 High-Leverage Actions

| # | Action | Confidence | Impact | Effort | Status |
|---|--------|------------|--------|--------|--------|
| 1 | Implement GraphQL API Layer | 88% | High | 2-3 days | Pending |
| 2 | Add Article Clustering with HDBSCAN | 86% | High | 2 days | Pending |
| 3 | Create Source Quality Scoring | 84% | Medium | 1-2 days | Pending |
| 4 | Implement Caching Layer with R2 | 82% | High | 1-2 days | Pending |
| 5 | Add Article Sentiment Analysis | 80% | Medium | 2 days | Pending |
| 6 | Create Alert System for Breaking News | 78% | High | 2-3 days | Pending |
| 7 | Implement Multi-tenant Support | 76% | Medium | 3-4 days | Pending |
| 8 | Add Article Archive with S3 | 74% | Medium | 2 days | Pending |
| 9 | Create Custom Report Builder | 72% | Low | 3-4 days | Pending |
| 10 | Implement Webhook Integrations | 70% | Low | 2 days | Pending |

---

## Action 1: Implement GraphQL API Layer (Confidence: 88%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - GraphQL Yoga for Cloudflare Workers

### Why This Matters
- Better query flexibility for frontend
- Reduced over-fetching of data
- Strong typing with codegen
- Subscription support for real-time

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 1.1 | Install graphql-yoga | `apps/scrapers/package.json` | Add graphql-yoga, graphql |
| 1.2 | Create GraphQL schema | `apps/scrapers/src/graphql/schema.ts` | Define types |
| 1.3 | Add resolvers | `apps/scrapers/src/graphql/resolvers.ts` | Query/Mutation handlers |
| 1.4 | Mount endpoint | `apps/scrapers/src/index.ts` | Add /graphql route |
| 1.5 | Generate client types | `apps/frontend/` | Add codegen config |

---

## Action 2: Add Article Clustering with HDBSCAN (Confidence: 86%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - Python HDBSCAN library

### Why This Matters
- Group related articles automatically
- Identify story clusters for briefs
- Reduce redundancy in reports
- Better topic discovery

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 2.1 | Add HDBSCAN to briefs | `apps/briefs/requirements.txt` | pip install hdbscan |
| 2.2 | Create clustering module | `apps/briefs/src/clustering.py` | HDBSCAN clustering |
| 2.3 | Add embedding generation | `apps/briefs/src/embeddings.py` | e5-small embeddings |
| 2.4 | Create cluster labels | `apps/briefs/src/labeling.py` | Auto-generate topics |
| 2.5 | Integrate with brief gen | `apps/briefs/src/generate.py` | Use clusters |

---

## Action 3: Create Source Quality Scoring (Confidence: 84%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes

### Why This Matters
- Prioritize high-quality sources
- Auto-demote unreliable sources
- Quality-based article weighting
- Better brief content quality

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 3.1 | Define scoring algorithm | `apps/scrapers/src/lib/sourceQuality.ts` | Quality metrics |
| 3.2 | Add credibility factors | `apps/scrapers/src/lib/sourceQuality.ts` | Trust signals |
| 3.3 | Store quality scores | `packages/database/src/schema.ts` | qualityScore column |
| 3.4 | Update on scrape | `apps/scrapers/src/workflows/rssFeed.workflow.ts` | Recalculate |
| 3.5 | Use in brief weights | `apps/briefs/src/weighting.py` | Quality weighting |

---

## Action 4: Implement Caching Layer with R2 (Confidence: 82%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - Cloudflare R2 docs

### Why This Matters
- Reduce API latency
- Lower database load
- Cache article content
- Serve static assets

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 4.1 | Configure R2 bucket | `apps/scrapers/wrangler.toml` | R2 binding |
| 4.2 | Create R2 cache utility | `apps/scrapers/src/lib/r2Cache.ts` | Cache layer |
| 4.3 | Cache article content | `apps/scrapers/src/workflows/processArticles.workflow.ts` | Store in R2 |
| 4.4 | Cache API responses | `apps/scrapers/src/index.ts` | Response caching |
| 4.5 | Add cache invalidation | `apps/scrapers/src/lib/r2Cache.ts` | TTL and purge |

---

## Action 5: Add Article Sentiment Analysis (Confidence: 80%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - AI SDK structured output

### Why This Matters
- Understand article tone
- Track sentiment trends
- Filter by sentiment
- Improve brief context

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 5.1 | Create sentiment prompt | `apps/scrapers/src/prompts/sentiment.prompt.ts` | Sentiment schema |
| 5.2 | Add sentiment analysis | `apps/scrapers/src/lib/sentiment.ts` | Analysis function |
| 5.3 | Store sentiment score | `packages/database/src/schema.ts` | sentiment column |
| 5.4 | Add to processing | `apps/scrapers/src/workflows/processArticles.workflow.ts` | Analyze |
| 5.5 | Create sentiment chart | `apps/frontend/src/components/` | Visualization |

---

## Cognitive Empathy Analysis

### User Perspective
- **Wants**: Real-time alerts, mobile notifications, custom reports
- **Pain Points**: No breaking news alerts, limited customization
- **Priorities**: Action 6 (Alerts), Action 9 (Custom Reports)

### Developer Perspective
- **Wants**: GraphQL flexibility, better typing, clean API
- **Pain Points**: REST limitations, over-fetching
- **Priorities**: Action 1 (GraphQL), Action 4 (Caching)

### Operations Perspective
- **Wants**: Quality control, multi-tenant, webhooks
- **Pain Points**: Manual source review, single tenant
- **Priorities**: Action 3 (Quality), Action 7 (Multi-tenant)

---

## Sources

- [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server)
- [HDBSCAN](https://hdbscan.readthedocs.io/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [AI SDK Structured Output](https://sdk.vercel.ai/docs)
- [Cloudflare Webhooks](https://developers.cloudflare.com/workers/examples/respond-with-another-site/)
