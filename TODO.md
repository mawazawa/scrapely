# Meridian TODO: Next 10 Highest Leverage Actions

> **Last Updated**: 2025-12-27T20:00:00Z
> **Research Validated**: December 27, 2025
> **Previous Actions Completed**: 49 (see CHANGELOG.md)

---

## Recently Completed (This Session)

| # | Action | Confidence | Status |
|---|--------|------------|--------|
| 1 | Implement GraphQL API Layer | 88% | ✅ Completed |
| 2 | Add Article Clustering with HDBSCAN | 86% | ✅ Completed |
| 3 | Create Source Quality Scoring | 84% | ✅ Completed |
| 4 | Implement Caching Layer with R2 | 82% | ✅ Completed |
| 5 | Add Article Sentiment Analysis | 80% | ✅ Completed |
| 6 | Create Alert System for Breaking News | 78% | ✅ Completed |
| 7 | Implement Multi-tenant Support | 76% | ✅ Completed |
| 8 | Add Article Archive with S3 | 74% | ✅ Completed |
| 9 | Create Custom Report Builder | 72% | ✅ Completed |
| 10 | Implement Webhook Integrations | 70% | ✅ Completed |

---

## Next 10 High-Leverage Actions

| # | Action | Confidence | Impact | Effort | Status |
|---|--------|------------|--------|--------|--------|
| 1 | Add Database Connection Pooling | 90% | High | 1 day | Pending |
| 2 | Implement Full-Text Search with Postgres | 88% | High | 2 days | Pending |
| 3 | Create Article Recommendation Engine | 85% | Medium | 2-3 days | Pending |
| 4 | Add Metrics and Observability Dashboard | 83% | High | 2 days | Pending |
| 5 | Implement OAuth2 Authentication | 80% | High | 2-3 days | Pending |
| 6 | Create Source Category Auto-Classification | 78% | Medium | 2 days | Pending |
| 7 | Add Article Translation Support | 75% | Medium | 2 days | Pending |
| 8 | Implement Read Later/Bookmarks | 73% | Low | 1 day | Pending |
| 9 | Create Digest Email Personalization | 70% | Medium | 2 days | Pending |
| 10 | Add API Key Management | 68% | Medium | 1-2 days | Pending |

---

## Action 1: Add Database Connection Pooling (Confidence: 90%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - Drizzle + Hyperdrive docs

### Why This Matters
- Reduce connection overhead for Workers
- Improve response times
- Handle higher concurrency
- Prevent connection exhaustion

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 1.1 | Configure connection pool | `packages/database/src/client.ts` | Add pooling config |
| 1.2 | Add health checks | `packages/database/src/health.ts` | Connection health |
| 1.3 | Implement retry logic | `packages/database/src/retry.ts` | Connection retries |
| 1.4 | Add connection metrics | `packages/database/src/metrics.ts` | Pool statistics |
| 1.5 | Update worker bindings | `apps/scrapers/wrangler.toml` | Hyperdrive config |

---

## Action 2: Implement Full-Text Search with Postgres (Confidence: 88%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - PostgreSQL FTS docs

### Why This Matters
- Fast article search without external services
- Relevance ranking built-in
- No additional infrastructure cost
- Works with existing database

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 2.1 | Add tsvector column | `packages/database/src/schema.ts` | Search vector column |
| 2.2 | Create GIN index | `packages/database/migrations/` | Full-text index |
| 2.3 | Build search function | `apps/scrapers/src/lib/ftsSearch.ts` | Search implementation |
| 2.4 | Add search API endpoint | `apps/scrapers/src/index.ts` | /search route |
| 2.5 | Create search UI | `apps/frontend/src/pages/search.vue` | Search page |

---

## Action 3: Create Article Recommendation Engine (Confidence: 85%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes

### Why This Matters
- Increase user engagement
- Personalized content discovery
- Reduce information overload
- Better user retention

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 3.1 | Build collaborative filter | `apps/scrapers/src/lib/recommendations.ts` | User-based CF |
| 3.2 | Add content-based filter | `apps/scrapers/src/lib/recommendations.ts` | Topic similarity |
| 3.3 | Create hybrid scorer | `apps/scrapers/src/lib/recommendations.ts` | Combined approach |
| 3.4 | Add recommendation API | `apps/scrapers/src/index.ts` | /recommendations |
| 3.5 | Display recommendations | `apps/frontend/src/components/` | Recommendation widget |

---

## Action 4: Add Metrics and Observability Dashboard (Confidence: 83%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - Cloudflare Analytics Engine

### Why This Matters
- Monitor system health
- Track key metrics
- Debug issues faster
- Capacity planning

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 4.1 | Add Analytics Engine | `apps/scrapers/wrangler.toml` | AE binding |
| 4.2 | Create metrics collector | `apps/scrapers/src/lib/metrics.ts` | Event tracking |
| 4.3 | Build dashboard API | `apps/scrapers/src/routes/metrics.router.ts` | Metrics queries |
| 4.4 | Create metrics UI | `apps/frontend/src/pages/admin/metrics.vue` | Visualizations |
| 4.5 | Add alerting | `apps/scrapers/src/lib/metricsAlerts.ts` | Threshold alerts |

---

## Action 5: Implement OAuth2 Authentication (Confidence: 80%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - OAuth 2.0 + OIDC

### Why This Matters
- Secure user authentication
- Social login support
- Enterprise SSO ready
- Better security posture

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 5.1 | Add OAuth provider | `apps/scrapers/src/lib/oauth.ts` | OAuth2 flow |
| 5.2 | Create session management | `apps/scrapers/src/lib/sessions.ts` | JWT sessions |
| 5.3 | Add login routes | `apps/scrapers/src/routes/auth.router.ts` | Auth endpoints |
| 5.4 | Create login UI | `apps/frontend/src/pages/login.vue` | Login page |
| 5.5 | Add auth middleware | `apps/scrapers/src/middleware/auth.ts` | Route protection |

---

## Cognitive Empathy Analysis

### User Perspective
- **Wants**: Better search, personalized content, bookmarks
- **Pain Points**: Hard to find old articles, generic recommendations
- **Priorities**: Action 2 (Search), Action 3 (Recommendations), Action 8 (Bookmarks)

### Developer Perspective
- **Wants**: Better observability, authentication, API management
- **Pain Points**: Limited metrics, no auth system
- **Priorities**: Action 4 (Metrics), Action 5 (OAuth2), Action 10 (API Keys)

### Operations Perspective
- **Wants**: Connection pooling, monitoring, scaling
- **Pain Points**: Connection limits, no metrics
- **Priorities**: Action 1 (Pooling), Action 4 (Metrics)

---

## Sources

- [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/)
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [Cloudflare Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/)
- [OAuth 2.0](https://oauth.net/2/)
- [Collaborative Filtering](https://en.wikipedia.org/wiki/Collaborative_filtering)
