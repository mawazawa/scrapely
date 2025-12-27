# Meridian TODO: Next 10 Highest Leverage Actions

> **Last Updated**: 2025-12-27T12:30:00Z
> **Research Validated**: December 27, 2025
> **Previous Actions Completed**: 10 (see ROADMAP.md)

---

## Overview

| # | Action | Confidence | Impact | Effort | Status |
|---|--------|------------|--------|--------|--------|
| 1 | Add OpenTelemetry Tracing | 94% | High | 1-2 days | Pending |
| 2 | Upgrade to Vitest 4 Browser Mode | 91% | Medium | 1 day | Pending |
| 3 | Implement Cloudflare Agents SDK | 87% | High | 2-3 days | Pending |
| 4 | Add E2E Testing with Playwright | 93% | High | 2 days | Pending |
| 5 | Implement KV/D1 Caching Layer | 89% | High | 1-2 days | Pending |
| 6 | Add Real-time WebSocket Updates | 85% | Medium | 2 days | Pending |
| 7 | Implement User Preferences | 82% | Medium | 2-3 days | Pending |
| 8 | Add Brief Scheduling & Delivery | 88% | High | 2 days | Pending |
| 9 | Implement Analytics Dashboard | 86% | Medium | 2 days | Pending |
| 10 | Add Multi-language Support | 80% | Medium | 2-3 days | Pending |

---

## Action 1: Add OpenTelemetry Tracing (Confidence: 94%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - [Cloudflare Workers Tracing Open Beta](https://blog.cloudflare.com/workers-tracing-now-in-open-beta/) (Dec 2025)

### Why This Matters
- Automatic instrumentation of all I/O operations
- OpenTelemetry-compliant spans for debugging
- Compatible with Grafana, Honeycomb, Axiom
- Zero code changes required for basic tracing
- Essential for production debugging

### Web Research Summary
- Workers automatic tracing is now in open beta
- Push-based pipeline forwards telemetry directly
- Spans billed as observability events starting Jan 15, 2026
- See: [Grafana Cloud Integration](https://grafana.com/blog/2025/12/04/send-opentelemetry-traces-and-logs-from-cloudflare-workers-to-grafana-cloud/)

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 1.1 | Enable tracing in wrangler.toml | `apps/scrapers/wrangler.toml` | Add observability.tracing = true |
| 1.2 | Configure tracing destination | `apps/scrapers/wrangler.toml` | Add OTel endpoint config |
| 1.3 | Create trace context utility | `apps/scrapers/src/lib/tracing.ts` | Helper for custom spans |
| 1.4 | Add trace IDs to logger | `apps/scrapers/src/lib/logger.ts`, `apps/scrapers/src/lib/tracing.ts` | Correlate logs with traces |
| 1.5 | Instrument workflow steps | `apps/scrapers/src/workflows/processArticles.workflow.ts` | Add custom spans for key operations |
| 1.6 | Instrument rssFeed workflow | `apps/scrapers/src/workflows/rssFeed.workflow.ts` | Add custom spans |
| 1.7 | Add tracing to Hono middleware | `apps/scrapers/src/app.ts`, `apps/scrapers/src/lib/tracing.ts` | Request tracing |
| 1.8 | Configure Grafana dashboard | `docs/OBSERVABILITY.md` | Document setup process |
| 1.9 | Add trace sampling config | `apps/scrapers/wrangler.toml` | Configure sampling rate |
| 1.10 | Test tracing in dev | `apps/scrapers/test/lib/tracing.spec.ts` | Verify trace generation |

---

## Action 2: Upgrade to Vitest 4 Browser Mode (Confidence: 91%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - [Vitest 4.0 Release](https://www.infoq.com/news/2025/12/vitest-4-browser-mode/) (Dec 2025)

### Why This Matters
- Browser Mode now stable (was experimental)
- Visual regression testing built-in
- Playwright Traces integration
- 2-5x faster than traditional frameworks
- 17M weekly downloads (up from 7M)

### Web Research Summary
- Vitest 4.0 released December 2025
- Browser Mode graduated to stable
- Requires separate provider packages (@vitest/browser-playwright)
- See: [Vitest Features](https://vitest.dev/guide/features)

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 2.1 | Upgrade vitest to v4 | `apps/scrapers/package.json` | Update to vitest@^4.0.0 |
| 2.2 | Install browser provider | `apps/scrapers/package.json` | Add @vitest/browser-playwright |
| 2.3 | Configure browser mode | `apps/scrapers/vitest.config.ts` | Enable browser testing |
| 2.4 | Add visual regression test | `apps/scrapers/test/visual/openGraph.spec.ts` | Test OG image generation |
| 2.5 | Configure screenshot baseline | `apps/scrapers/vitest.config.ts`, `.gitignore` | Setup snapshot directory |
| 2.6 | Add component tests | `apps/frontend/test/components/` | Vue component browser tests |
| 2.7 | Configure frontend vitest | `apps/frontend/vitest.config.ts` | Setup Nuxt + Vitest |
| 2.8 | Add CI browser test step | `.github/workflows/deploy-services.yaml` | Run browser tests in CI |
| 2.9 | Add performance benchmarks | `apps/scrapers/test/benchmarks/` | Use vitest bench |
| 2.10 | Document testing strategy | `docs/TESTING.md` | Testing best practices |

---

## Action 3: Implement Cloudflare Agents SDK (Confidence: 87%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - [Agents SDK v0.3.0](https://developers.cloudflare.com/changelog/2025-12-22-agents-sdk-ai-sdk-v6/) (Dec 22, 2025)

### Why This Matters
- Unified tool pattern with AI SDK v6
- Dynamic tool approval for human-in-loop
- Built-in state management with SQL
- WebSocket streaming for long-running tasks
- Ideal for agentic article processing

### Web Research Summary
- Agents SDK v0.3.0 released Dec 22, 2025
- Full AI SDK v6 compatibility
- workers-ai-provider v3.0.0 for Workers AI models
- See: [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 3.1 | Install agents SDK | `apps/scrapers/package.json` | Add agents@^0.3.0 |
| 3.2 | Install workers-ai-provider | `apps/scrapers/package.json` | Add workers-ai-provider@^3.0.0 |
| 3.3 | Create agent class | `apps/scrapers/src/agents/ArticleAgent.ts` | Article processing agent |
| 3.4 | Define agent tools | `apps/scrapers/src/agents/tools/` | Scrape, analyze, summarize tools |
| 3.5 | Add agent state schema | `apps/scrapers/src/agents/state.ts` | Agent state management |
| 3.6 | Create agent workflow | `apps/scrapers/src/workflows/agent.workflow.ts` | Integrate agent with workflow |
| 3.7 | Add WebSocket handler | `apps/scrapers/src/app.ts` | Real-time agent updates |
| 3.8 | Configure agent bindings | `apps/scrapers/wrangler.toml` | Add agent bindings |
| 3.9 | Add human-in-loop approval | `apps/scrapers/src/agents/approval.ts` | Manual review for edge cases |
| 3.10 | Test agent functionality | `apps/scrapers/test/agents/ArticleAgent.spec.ts` | Agent unit tests |

---

## Action 4: Add E2E Testing with Playwright (Confidence: 93%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - Current Playwright docs

### Why This Matters
- No E2E tests for user flows currently
- Critical paths untested (admin dashboard, briefs)
- Playwright integrates with Vitest 4
- Cross-browser testing support
- Visual regression for UI

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 4.1 | Install Playwright | `apps/frontend/package.json` | Add @playwright/test |
| 4.2 | Configure Playwright | `apps/frontend/playwright.config.ts` | Setup config |
| 4.3 | Add test for home page | `apps/frontend/e2e/home.spec.ts` | Test landing page |
| 4.4 | Add test for admin dashboard | `apps/frontend/e2e/admin.spec.ts` | Test stats display |
| 4.5 | Add test for briefs list | `apps/frontend/e2e/briefs.spec.ts` | Test brief listing |
| 4.6 | Add test for brief detail | `apps/frontend/e2e/brief-detail.spec.ts` | Test brief reading |
| 4.7 | Add test for newsletter signup | `apps/frontend/e2e/newsletter.spec.ts` | Test subscribe flow |
| 4.8 | Add visual regression | `apps/frontend/e2e/visual.spec.ts` | Screenshot comparisons |
| 4.9 | Add CI E2E step | `.github/workflows/deploy-services.yaml` | Run E2E in CI |
| 4.10 | Add test fixtures | `apps/frontend/e2e/fixtures/` | Mock data for tests |

---

## Action 5: Implement KV/D1 Caching Layer (Confidence: 89%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - Cloudflare KV/D1 docs current

### Why This Matters
- Stats API runs 9 queries per request
- No caching = high database load
- KV provides edge caching
- D1 for structured cache
- Reduces latency significantly

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 5.1 | Create KV namespace | `apps/scrapers/wrangler.toml` | Add CACHE_KV binding |
| 5.2 | Create cache utility | `apps/scrapers/src/lib/cache.ts` | KV wrapper with TTL |
| 5.3 | Cache stats response | `apps/scrapers/src/app.ts`, `apps/scrapers/src/lib/cache.ts` | Cache /events stats |
| 5.4 | Cache report list | `apps/scrapers/src/routers/reports.router.ts`, `apps/scrapers/src/lib/cache.ts` | Cache report listings |
| 5.5 | Add cache invalidation | `apps/scrapers/src/lib/cache.ts` | Invalidate on updates |
| 5.6 | Cache source list | `apps/scrapers/src/app.ts` | Cache sources query |
| 5.7 | Add cache headers | `apps/scrapers/src/app.ts` | Stale-while-revalidate |
| 5.8 | Configure frontend caching | `apps/frontend/nuxt.config.ts` | Route caching rules |
| 5.9 | Add cache metrics | `apps/scrapers/src/lib/cache.ts`, `apps/scrapers/src/lib/logger.ts` | Track hit/miss |
| 5.10 | Test cache behavior | `apps/scrapers/test/lib/cache.spec.ts` | Cache tests |

---

## Action 6: Add Real-time WebSocket Updates (Confidence: 85%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - Cloudflare Durable Objects/WebSockets docs

### Why This Matters
- Admin dashboard polls every 30s
- No real-time processing visibility
- WebSockets reduce server load
- Better UX for monitoring
- Foundation for live alerts

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 6.1 | Create Durable Object | `apps/scrapers/src/durable/StatsRoom.ts` | WebSocket room |
| 6.2 | Add DO binding | `apps/scrapers/wrangler.toml`, `apps/scrapers/src/index.ts` | Configure binding |
| 6.3 | Add WebSocket route | `apps/scrapers/src/app.ts` | /ws/stats endpoint |
| 6.4 | Create message types | `apps/scrapers/src/types/websocket.ts` | Type-safe messages |
| 6.5 | Broadcast workflow updates | `apps/scrapers/src/workflows/processArticles.workflow.ts` | Send progress |
| 6.6 | Create frontend composable | `apps/frontend/src/composables/useWebSocket.ts` | WebSocket client |
| 6.7 | Update admin dashboard | `apps/frontend/src/pages/admin/index.vue` | Use WebSocket |
| 6.8 | Add connection status | `apps/frontend/src/components/ConnectionStatus.vue` | Show connection state |
| 6.9 | Add reconnection logic | `apps/frontend/src/composables/useWebSocket.ts` | Auto-reconnect |
| 6.10 | Test WebSocket flow | `apps/scrapers/test/durable/StatsRoom.spec.ts` | DO tests |

---

## Action 7: Implement User Preferences (Confidence: 82%)

**Research Date**: 2025-12-27
**Documentation Validated**: Requires schema design

### Why This Matters
- Briefs are currently global
- No personalization options
- Users can't filter by topic/region
- Foundation for recommendation engine
- Increases engagement

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 7.1 | Design preferences schema | `packages/database/src/schema.ts` | Add $userPreferences table |
| 7.2 | Generate migration | `packages/database/migrations/` | Create migration |
| 7.3 | Create preferences API | `apps/scrapers/src/routers/preferences.router.ts` | CRUD endpoints |
| 7.4 | Add auth middleware | `apps/scrapers/src/middleware/auth.ts` | User identification |
| 7.5 | Create preferences form | `apps/frontend/src/pages/preferences.vue` | UI for preferences |
| 7.6 | Add topic selection | `apps/frontend/src/components/TopicSelector.vue` | Topic multi-select |
| 7.7 | Add region selection | `apps/frontend/src/components/RegionSelector.vue` | Region filter |
| 7.8 | Apply preferences to events | `apps/scrapers/src/app.ts` | Filter by prefs |
| 7.9 | Store prefs in cookie/KV | `apps/scrapers/src/lib/preferences.ts` | Persistence |
| 7.10 | Test preferences flow | `apps/scrapers/test/routers/preferences.spec.ts` | API tests |

---

## Action 8: Add Brief Scheduling & Delivery (Confidence: 88%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - Cloudflare Cron/Queues docs

### Why This Matters
- Newsletter signup exists but no delivery
- Manual brief generation
- No scheduling UI
- Users expect daily delivery
- Core product feature

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 8.1 | Create newsletter workflow | `apps/scrapers/src/workflows/newsletter.workflow.ts` | Daily send workflow |
| 8.2 | Add workflow binding | `apps/scrapers/wrangler.toml`, `apps/scrapers/src/index.ts` | NEWSLETTER binding |
| 8.3 | Add cron trigger | `apps/scrapers/wrangler.toml` | Daily 8am UTC |
| 8.4 | Fetch subscribers | `apps/scrapers/src/workflows/newsletter.workflow.ts` | Query newsletter table |
| 8.5 | Generate brief email | `apps/scrapers/src/lib/email.ts` | Use latest report |
| 8.6 | Send batch emails | `apps/scrapers/src/workflows/newsletter.workflow.ts` | Rate-limited sends |
| 8.7 | Track delivery status | `packages/database/src/schema.ts` | Add delivery columns |
| 8.8 | Add unsubscribe endpoint | `apps/scrapers/src/app.ts` | Handle unsubscribe |
| 8.9 | Add delivery dashboard | `apps/frontend/src/pages/admin/newsletter.vue` | View send stats |
| 8.10 | Test newsletter flow | `apps/scrapers/test/workflows/newsletter.spec.ts` | E2E test |

---

## Action 9: Implement Analytics Dashboard (Confidence: 86%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - Chart.js/D3 docs current

### Why This Matters
- Current dashboard shows only counts
- No trend visualization
- No processing pipeline metrics
- No source performance tracking
- Essential for operations

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 9.1 | Install chart library | `apps/frontend/package.json` | Add chart.js |
| 9.2 | Create chart components | `apps/frontend/src/components/charts/` | Reusable charts |
| 9.3 | Add time-series endpoint | `apps/frontend/src/server/api/analytics/timeseries.get.ts` | Historical data |
| 9.4 | Add article volume chart | `apps/frontend/src/pages/admin/index.vue` | Articles over time |
| 9.5 | Add source performance | `apps/frontend/src/pages/admin/index.vue` | Source success rates |
| 9.6 | Add processing metrics | `apps/frontend/src/pages/admin/index.vue` | Pipeline stats |
| 9.7 | Add relevance trends | `apps/frontend/src/pages/admin/index.vue` | Relevance over time |
| 9.8 | Add export functionality | `apps/frontend/src/pages/admin/index.vue` | CSV/JSON export |
| 9.9 | Add date range picker | `apps/frontend/src/components/DateRangePicker.vue` | Filter by date |
| 9.10 | Cache analytics queries | `apps/frontend/src/server/api/analytics/` | Optimize queries |

---

## Action 10: Add Multi-language Support (Confidence: 80%)

**Research Date**: 2025-12-27
**Documentation Validated**: Requires i18n research

### Why This Matters
- UI is English-only
- Articles analyzed in multiple languages
- Growing international audience
- SEO benefits for localized content
- Better accessibility

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 10.1 | Install i18n module | `apps/frontend/package.json` | Add @nuxtjs/i18n |
| 10.2 | Configure i18n | `apps/frontend/nuxt.config.ts` | Setup locales |
| 10.3 | Extract English strings | `apps/frontend/src/locales/en.json` | Create base locale |
| 10.4 | Add Spanish translation | `apps/frontend/src/locales/es.json` | Spanish strings |
| 10.5 | Add French translation | `apps/frontend/src/locales/fr.json` | French strings |
| 10.6 | Add language switcher | `apps/frontend/src/components/LanguageSwitcher.vue` | UI component |
| 10.7 | Localize date formats | `apps/frontend/src/composables/useLocale.ts` | Date formatting |
| 10.8 | Add RTL support | `apps/frontend/src/assets/css/rtl.css` | RTL styles |
| 10.9 | Localize SEO meta | `apps/frontend/src/composables/useSEO.ts` | Localized meta |
| 10.10 | Test i18n | `apps/frontend/test/i18n.spec.ts` | Translation tests |

---

## Cognitive Empathy Analysis

### User Perspective
- **Wants**: Real-time updates, personalized content, reliable delivery
- **Pain Points**: No visibility into processing, generic briefs
- **Priorities**: Action 6 (WebSockets), Action 7 (Preferences), Action 8 (Delivery)

### Developer Perspective
- **Wants**: Good testing, observability, clear architecture
- **Pain Points**: Limited visibility into production issues
- **Priorities**: Action 1 (Tracing), Action 2 (Vitest 4), Action 4 (E2E)

### Operations Perspective
- **Wants**: Monitoring, caching, performance metrics
- **Pain Points**: Database load, no tracing
- **Priorities**: Action 1 (Tracing), Action 5 (Caching), Action 9 (Analytics)

---

## Alternative Approaches (Confidence < 85%)

### For Action 6 (WebSocket - 85%)
**Alternative**: Server-Sent Events (SSE)
- Pros: Simpler, no Durable Object needed
- Cons: Unidirectional, less efficient for bidirectional

### For Action 7 (Preferences - 82%)
**Alternative**: Cookie-based preferences only
- Pros: No database changes, simpler
- Cons: Not synced across devices

### For Action 10 (i18n - 80%)
**Alternative**: Machine translation with Gemini
- Pros: Automatic, covers all content
- Cons: Quality varies, costs per translation

---

## Sources

- [Cloudflare Workers Tracing](https://blog.cloudflare.com/workers-tracing-now-in-open-beta/)
- [Grafana Cloud Integration](https://grafana.com/blog/2025/12/04/send-opentelemetry-traces-and-logs-from-cloudflare-workers-to-grafana-cloud/)
- [Vitest 4.0 Release](https://www.infoq.com/news/2025/12/vitest-4-browser-mode/)
- [Cloudflare Agents SDK v0.3.0](https://developers.cloudflare.com/changelog/2025-12-22-agents-sdk-ai-sdk-v6/)
- [Drizzle ORM v1 Beta](https://orm.drizzle.team/docs/latest-releases)
- [Nuxt 4.0 Announcement](https://nuxt.com/blog/v4)
