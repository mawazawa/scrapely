# Meridian TODO: Next 10 Highest Leverage Actions

> **Last Updated**: 2025-12-27T14:00:00Z
> **Research Validated**: December 27, 2025
> **Previous Actions Completed**: 20 (see ROADMAP.md, CHANGELOG.md)

---

## Recently Completed (This Session)

| # | Action | Confidence | Status |
|---|--------|------------|--------|
| 1 | Add OpenTelemetry Tracing | 94% | ✅ Completed |
| 4 | Add E2E Testing with Playwright | 93% | ✅ Completed |
| 5 | Implement KV/D1 Caching Layer | 89% | ✅ Completed |
| 6 | Add Real-time WebSocket Updates | 85% | ✅ Completed |
| 8 | Add Brief Scheduling & Delivery | 88% | ✅ Completed |
| 9 | Implement Analytics Dashboard | 86% | ✅ Completed |
| 10 | Add Multi-language Support | 80% | ✅ Completed |

---

## Next 10 High-Leverage Actions

| # | Action | Confidence | Impact | Effort | Status |
|---|--------|------------|--------|--------|--------|
| 1 | Implement Cloudflare Agents SDK | 87% | High | 2-3 days | Pending |
| 2 | Upgrade to Vitest 4 Browser Mode | 91% | Medium | 1 day | Pending |
| 3 | Implement User Preferences | 82% | Medium | 2-3 days | Pending |
| 4 | Add Source Health Monitoring | 90% | High | 1-2 days | Pending |
| 5 | Implement Article Deduplication | 88% | High | 1-2 days | Pending |
| 6 | Add Semantic Search | 85% | High | 2-3 days | Pending |
| 7 | Implement Brief Version History | 83% | Medium | 1-2 days | Pending |
| 8 | Add RSS Feed Discovery | 79% | Medium | 2 days | Pending |
| 9 | Implement Push Notifications | 76% | Medium | 2-3 days | Pending |
| 10 | Add Content Moderation Pipeline | 84% | High | 2-3 days | Pending |

---

## Action 1: Implement Cloudflare Agents SDK (Confidence: 87%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - [Agents SDK v0.3.0](https://developers.cloudflare.com/changelog/2025-12-22-agents-sdk-ai-sdk-v6/) (Dec 22, 2025)

### Why This Matters
- Unified tool pattern with AI SDK v6
- Dynamic tool approval for human-in-loop
- Built-in state management with SQL
- WebSocket streaming for long-running tasks
- Ideal for agentic article processing

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 1.1 | Install agents SDK | `apps/scrapers/package.json` | Add agents@^0.3.0 |
| 1.2 | Install workers-ai-provider | `apps/scrapers/package.json` | Add workers-ai-provider@^3.0.0 |
| 1.3 | Create agent class | `apps/scrapers/src/agents/ArticleAgent.ts` | Article processing agent |
| 1.4 | Define agent tools | `apps/scrapers/src/agents/tools/` | Scrape, analyze, summarize tools |
| 1.5 | Add agent state schema | `apps/scrapers/src/agents/state.ts` | Agent state management |
| 1.6 | Create agent workflow | `apps/scrapers/src/workflows/agent.workflow.ts` | Integrate with workflow |
| 1.7 | Add WebSocket handler | `apps/scrapers/src/app.ts` | Real-time agent updates |
| 1.8 | Configure agent bindings | `apps/scrapers/wrangler.toml` | Add agent bindings |
| 1.9 | Add human-in-loop approval | `apps/scrapers/src/agents/approval.ts` | Manual review |
| 1.10 | Test agent functionality | `apps/scrapers/test/agents/ArticleAgent.spec.ts` | Agent tests |

---

## Action 2: Upgrade to Vitest 4 Browser Mode (Confidence: 91%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - [Vitest 4.0 Release](https://www.infoq.com/news/2025/12/vitest-4-browser-mode/) (Dec 2025)

### Why This Matters
- Browser Mode now stable (was experimental)
- Visual regression testing built-in
- Playwright Traces integration
- 2-5x faster than traditional frameworks

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 2.1 | Upgrade vitest to v4 | `apps/scrapers/package.json` | Update to vitest@^4.0.0 |
| 2.2 | Install browser provider | `apps/scrapers/package.json` | Add @vitest/browser-playwright |
| 2.3 | Configure browser mode | `apps/scrapers/vitest.config.ts` | Enable browser testing |
| 2.4 | Add visual regression test | `apps/scrapers/test/visual/openGraph.spec.ts` | Test OG images |
| 2.5 | Configure screenshot baseline | `apps/scrapers/vitest.config.ts`, `.gitignore` | Snapshot dir |
| 2.6 | Add component tests | `apps/frontend/test/components/` | Vue browser tests |
| 2.7 | Configure frontend vitest | `apps/frontend/vitest.config.ts` | Nuxt + Vitest |
| 2.8 | Add CI browser test step | `.github/workflows/deploy-services.yaml` | CI browser tests |
| 2.9 | Add performance benchmarks | `apps/scrapers/test/benchmarks/` | vitest bench |
| 2.10 | Document testing strategy | `docs/TESTING.md` | Best practices |

---

## Action 3: Implement User Preferences (Confidence: 82%)

**Research Date**: 2025-12-27
**Documentation Validated**: Requires schema design

### Why This Matters
- Briefs are currently global
- No personalization options
- Users can't filter by topic/region
- Foundation for recommendation engine

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 3.1 | Design preferences schema | `packages/database/src/schema.ts` | $userPreferences table |
| 3.2 | Generate migration | `packages/database/migrations/` | Create migration |
| 3.3 | Create preferences API | `apps/scrapers/src/routers/preferences.router.ts` | CRUD endpoints |
| 3.4 | Add auth middleware | `apps/scrapers/src/middleware/auth.ts` | User identification |
| 3.5 | Create preferences form | `apps/frontend/src/pages/preferences.vue` | UI for prefs |
| 3.6 | Add topic selection | `apps/frontend/src/components/TopicSelector.vue` | Topic multi-select |
| 3.7 | Add region selection | `apps/frontend/src/components/RegionSelector.vue` | Region filter |
| 3.8 | Apply preferences to events | `apps/scrapers/src/app.ts` | Filter by prefs |
| 3.9 | Store prefs in cookie/KV | `apps/scrapers/src/lib/preferences.ts` | Persistence |
| 3.10 | Test preferences flow | `apps/scrapers/test/routers/preferences.spec.ts` | API tests |

---

## Action 4: Add Source Health Monitoring (Confidence: 90%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - Cloudflare Analytics Engine

### Why This Matters
- No visibility into source reliability
- Failed sources silently break
- Essential for maintaining quality
- Enables automated source management

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 4.1 | Add health columns to sources | `packages/database/src/schema.ts` | successRate, lastError |
| 4.2 | Generate migration | `packages/database/migrations/` | Add columns |
| 4.3 | Track scrape success/failure | `apps/scrapers/src/workflows/rssFeed.workflow.ts` | Record outcomes |
| 4.4 | Calculate rolling success rate | `apps/scrapers/src/lib/sourceHealth.ts` | 7-day rolling average |
| 4.5 | Create health dashboard view | `apps/frontend/src/pages/admin/sources.vue` | Source health UI |
| 4.6 | Add health alerts | `apps/scrapers/src/lib/alerts.ts` | Notify on degradation |
| 4.7 | Implement auto-disable | `apps/scrapers/src/lib/sourceHealth.ts` | Disable failing sources |
| 4.8 | Add health API endpoint | `apps/scrapers/src/routers/sources.router.ts` | GET /sources/health |
| 4.9 | Create health trends chart | `apps/frontend/src/components/charts/SourceHealth.vue` | Trend visualization |
| 4.10 | Test health tracking | `apps/scrapers/test/lib/sourceHealth.spec.ts` | Health tests |

---

## Action 5: Implement Article Deduplication (Confidence: 88%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - SimHash/MinHash algorithms

### Why This Matters
- Same story from multiple sources
- Wastes processing resources
- Clutters briefs with duplicates
- Improves brief quality

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 5.1 | Add fingerprint column | `packages/database/src/schema.ts` | contentHash field |
| 5.2 | Generate migration | `packages/database/migrations/` | Add hash column |
| 5.3 | Implement SimHash | `apps/scrapers/src/lib/dedup.ts` | Content fingerprinting |
| 5.4 | Add dedup check before processing | `apps/scrapers/src/workflows/processArticles.workflow.ts` | Skip duplicates |
| 5.5 | Create similarity threshold config | `apps/scrapers/src/lib/dedup.ts` | Configurable threshold |
| 5.6 | Link related articles | `packages/database/src/schema.ts` | relatedArticles join |
| 5.7 | Show related articles in UI | `apps/frontend/src/pages/articles/[id].vue` | Related list |
| 5.8 | Add dedup metrics | `apps/scrapers/src/lib/logger.ts` | Track dedup rate |
| 5.9 | Create dedup admin view | `apps/frontend/src/pages/admin/dedup.vue` | Review duplicates |
| 5.10 | Test deduplication | `apps/scrapers/test/lib/dedup.spec.ts` | Dedup tests |

---

## Action 6: Add Semantic Search (Confidence: 85%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - Cloudflare Vectorize, AI Gateway

### Why This Matters
- Current search is keyword-based
- Can't find conceptually related content
- Essential for power users
- Enables "find similar articles"

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 6.1 | Setup Vectorize index | `apps/scrapers/wrangler.toml` | Add vectorize binding |
| 6.2 | Generate embeddings on ingest | `apps/scrapers/src/workflows/processArticles.workflow.ts` | Use AI Gateway |
| 6.3 | Create search endpoint | `apps/scrapers/src/routers/search.router.ts` | Vector search API |
| 6.4 | Add search UI | `apps/frontend/src/pages/search.vue` | Search page |
| 6.5 | Implement "similar articles" | `apps/scrapers/src/routers/articles.router.ts` | GET /articles/:id/similar |
| 6.6 | Add search suggestions | `apps/frontend/src/components/SearchSuggestions.vue` | Autocomplete |
| 6.7 | Create search analytics | `apps/scrapers/src/lib/searchAnalytics.ts` | Track queries |
| 6.8 | Add hybrid search | `apps/scrapers/src/routers/search.router.ts` | Combine keyword + vector |
| 6.9 | Cache popular searches | `apps/scrapers/src/lib/cache.ts` | KV caching |
| 6.10 | Test search functionality | `apps/scrapers/test/routers/search.spec.ts` | Search tests |

---

## Action 7: Implement Brief Version History (Confidence: 83%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - PostgreSQL history patterns

### Why This Matters
- No way to see brief edits
- Can't compare versions
- Useful for tracking story evolution
- Enables rollback capability

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 7.1 | Create versions table | `packages/database/src/schema.ts` | $reportVersions |
| 7.2 | Generate migration | `packages/database/migrations/` | Version table |
| 7.3 | Save version on update | `apps/scrapers/src/routers/reports.router.ts` | Auto-version |
| 7.4 | Create version history API | `apps/scrapers/src/routers/reports.router.ts` | GET /reports/:id/versions |
| 7.5 | Add version diff UI | `apps/frontend/src/pages/briefs/[slug]/history.vue` | Diff view |
| 7.6 | Implement diff algorithm | `apps/frontend/src/lib/diff.ts` | Text diff |
| 7.7 | Add version restore | `apps/scrapers/src/routers/reports.router.ts` | POST /reports/:id/restore |
| 7.8 | Create version selector | `apps/frontend/src/components/VersionSelector.vue` | Version dropdown |
| 7.9 | Add version metadata | `packages/database/src/schema.ts` | author, reason |
| 7.10 | Test version history | `apps/scrapers/test/routers/reports.spec.ts` | Version tests |

---

## Action 8: Add RSS Feed Discovery (Confidence: 79%)

**Research Date**: 2025-12-27
**Documentation Validated**: Requires research on feed discovery APIs

### Why This Matters
- Manual source addition is tedious
- Users may know topics but not sources
- Automatic discovery expands coverage
- Reduces maintenance burden

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 8.1 | Create feed discovery service | `apps/scrapers/src/lib/feedDiscovery.ts` | Discover feeds from URL |
| 8.2 | Integrate Google News RSS | `apps/scrapers/src/lib/feedDiscovery.ts` | Google News topics |
| 8.3 | Add discovery endpoint | `apps/scrapers/src/routers/sources.router.ts` | POST /sources/discover |
| 8.4 | Create discovery UI | `apps/frontend/src/pages/admin/discover.vue` | Discovery page |
| 8.5 | Add feed validation | `apps/scrapers/src/lib/feedDiscovery.ts` | Verify feeds work |
| 8.6 | Implement topic suggestions | `apps/scrapers/src/lib/feedDiscovery.ts` | Suggest by topic |
| 8.7 | Add feed preview | `apps/frontend/src/components/FeedPreview.vue` | Preview before add |
| 8.8 | Track discovery sources | `packages/database/src/schema.ts` | discoveredFrom field |
| 8.9 | Add bulk import | `apps/scrapers/src/routers/sources.router.ts` | POST /sources/bulk |
| 8.10 | Test discovery | `apps/scrapers/test/lib/feedDiscovery.spec.ts` | Discovery tests |

---

## Action 9: Implement Push Notifications (Confidence: 76%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - Web Push API, Firebase Cloud Messaging

### Why This Matters
- Only email notifications currently
- Users miss time-sensitive news
- Push has higher engagement
- Mobile-first experience

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 9.1 | Add push subscription table | `packages/database/src/schema.ts` | $pushSubscriptions |
| 9.2 | Generate migration | `packages/database/migrations/` | Subscriptions table |
| 9.3 | Create service worker | `apps/frontend/public/sw.js` | Push SW |
| 9.4 | Add subscription endpoint | `apps/scrapers/src/routers/push.router.ts` | POST /push/subscribe |
| 9.5 | Implement web-push | `apps/scrapers/src/lib/webPush.ts` | VAPID keys |
| 9.6 | Add push UI | `apps/frontend/src/components/PushPrompt.vue` | Enable prompt |
| 9.7 | Send on new brief | `apps/scrapers/src/workflows/newsletter.workflow.ts` | Push + email |
| 9.8 | Add notification settings | `apps/frontend/src/pages/preferences.vue` | Toggle push |
| 9.9 | Track delivery status | `apps/scrapers/src/lib/webPush.ts` | Delivery logging |
| 9.10 | Test push flow | `apps/scrapers/test/lib/webPush.spec.ts` | Push tests |

---

## Action 10: Add Content Moderation Pipeline (Confidence: 84%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - Cloudflare AI Gateway moderation

### Why This Matters
- No content filtering currently
- Risk of harmful content in briefs
- Essential for public deployment
- Compliance with platform policies

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 10.1 | Create moderation service | `apps/scrapers/src/lib/moderation.ts` | Content check |
| 10.2 | Integrate AI Gateway | `apps/scrapers/src/lib/moderation.ts` | Cloudflare AI |
| 10.3 | Add moderation to processing | `apps/scrapers/src/workflows/processArticles.workflow.ts` | Flag content |
| 10.4 | Create moderation queue | `apps/frontend/src/pages/admin/moderation.vue` | Review UI |
| 10.5 | Add moderation columns | `packages/database/src/schema.ts` | flagged, reason |
| 10.6 | Generate migration | `packages/database/migrations/` | Moderation columns |
| 10.7 | Implement human review | `apps/scrapers/src/routers/moderation.router.ts` | Approve/reject |
| 10.8 | Add auto-block rules | `apps/scrapers/src/lib/moderation.ts` | Keyword blocklist |
| 10.9 | Create moderation metrics | `apps/frontend/src/pages/admin/index.vue` | Flag rate |
| 10.10 | Test moderation | `apps/scrapers/test/lib/moderation.spec.ts` | Moderation tests |

---

## Cognitive Empathy Analysis

### User Perspective (Updated)
- **Wants**: Personalized content, fast search, push notifications
- **Pain Points**: Generic briefs, no search, email-only
- **Priorities**: Action 3 (Preferences), Action 6 (Search), Action 9 (Push)

### Developer Perspective (Updated)
- **Wants**: Better testing, agent capabilities, monitoring
- **Pain Points**: Limited browser testing, no agents
- **Priorities**: Action 1 (Agents), Action 2 (Vitest 4), Action 4 (Health)

### Operations Perspective (Updated)
- **Wants**: Source reliability, deduplication, moderation
- **Pain Points**: Silent failures, duplicate processing
- **Priorities**: Action 4 (Health), Action 5 (Dedup), Action 10 (Moderation)

---

## Sources

- [Cloudflare Agents SDK v0.3.0](https://developers.cloudflare.com/changelog/2025-12-22-agents-sdk-ai-sdk-v6/)
- [Vitest 4.0 Release](https://www.infoq.com/news/2025/12/vitest-4-browser-mode/)
- [Cloudflare Vectorize](https://developers.cloudflare.com/vectorize/)
- [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/)
- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
