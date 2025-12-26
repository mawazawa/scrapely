# Meridian Roadmap: 10 Highest Leverage Actions

> Generated: December 26, 2025
> Analysis based on comprehensive codebase exploration

---

## Overview

| # | Action | Confidence | Impact | Effort |
|---|--------|------------|--------|--------|
| 1 | Add Comprehensive Test Suite | 95% | Critical | 3-4 days |
| 2 | Fix Error Handling Patterns | 92% | Critical | 1-2 days |
| 3 | Enhance CI/CD Pipeline | 94% | High | 1 day |
| 4 | Optimize Article Processing Performance | 88% | High | 2 days |
| 5 | Implement Structured Logging & Monitoring | 90% | High | 1-2 days |
| 6 | Add API Documentation (OpenAPI) | 93% | Medium | 1 day |
| 7 | Implement Newsletter Email Sending | 85% | Medium | 2-3 days |
| 8 | Fix Security Vulnerabilities | 96% | Critical | 1 day |
| 9 | Add Database Migration Tests | 91% | Medium | 1 day |
| 10 | Implement Brief Continuity Tracking | 82% | Medium | 1-2 days |

---

## Action 1: Add Comprehensive Test Suite
**Confidence: 95%** | **Impact: Critical** | **Files: 0 tests → 20+ test files**

### Why This Matters
- Zero test coverage on 99% of codebase
- Can't verify changes don't break production
- Makes refactoring risky

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 1.1 | Setup vitest for scrapers workflows | `apps/scrapers/vitest.config.ts`, `apps/scrapers/test/setup.ts` | Configure vitest with Cloudflare Workers pool |
| 1.2 | Create test mocks for Cloudflare bindings | `apps/scrapers/test/mocks/env.ts`, `apps/scrapers/test/mocks/db.ts` | Mock DATABASE, PROCESS_ARTICLES, etc. |
| 1.3 | Test RSS feed parsing | `apps/scrapers/test/lib/parsers.spec.ts`, `apps/scrapers/src/lib/parsers.ts` | Unit tests for RSS/Atom parsing with fixtures |
| 1.4 | Test rate limiter logic | `apps/scrapers/test/lib/rateLimiter.spec.ts`, `apps/scrapers/src/lib/rateLimiter.ts` | Test domain cooldowns, batch processing |
| 1.5 | Test Firecrawl domain detection | `apps/scrapers/test/lib/firecrawl.spec.ts`, `apps/scrapers/src/lib/firecrawl.ts` | Test shouldUseFirecrawl, smartFirecrawlScrape |
| 1.6 | Test document OCR provider selection | `apps/scrapers/test/lib/documentOcr.spec.ts`, `apps/scrapers/src/lib/documentOcr.ts` | Test Gemini/Mistral fallback logic |
| 1.7 | Test puppeteer article extraction | `apps/scrapers/test/lib/puppeteer.spec.ts`, `apps/scrapers/src/lib/puppeteer.ts` | Test getArticleWithFetch, getArticleWithBrowser |
| 1.8 | Test model configuration | `apps/scrapers/test/lib/models.spec.ts`, `apps/scrapers/src/lib/models.ts` | Test getModel, getProviders |
| 1.9 | Test article analysis prompt | `apps/scrapers/test/prompts/articleAnalysis.spec.ts`, `apps/scrapers/src/prompts/articleAnalysis.prompt.ts` | Test prompt generation, schema validation |
| 1.10 | Integration test: processArticles workflow | `apps/scrapers/test/workflows/processArticles.spec.ts`, `apps/scrapers/src/workflows/processArticles.workflow.ts` | Test end-to-end article processing |
| 1.11 | Integration test: rssFeed workflow | `apps/scrapers/test/workflows/rssFeed.spec.ts`, `apps/scrapers/src/workflows/rssFeed.workflow.ts` | Test feed scraping flow |
| 1.12 | Setup vitest for frontend | `apps/frontend/vitest.config.ts`, `apps/frontend/test/setup.ts` | Configure vitest with Nuxt |
| 1.13 | Test stats API endpoint | `apps/frontend/test/server/api/stats.spec.ts`, `apps/frontend/src/server/api/stats.get.ts` | Test aggregation queries |
| 1.14 | Test reports API endpoint | `apps/frontend/test/server/api/reports.spec.ts`, `apps/frontend/src/server/api/reports.get.ts` | Test pagination, filtering |
| 1.15 | Test subscribe API endpoint | `apps/frontend/test/server/api/subscribe.spec.ts`, `apps/frontend/src/server/api/subscribe.post.ts` | Test email validation, DB insert |
| 1.16 | Test useSEO composable | `apps/frontend/test/composables/useSEO.spec.ts`, `apps/frontend/src/composables/useSEO.ts` | Test meta tag generation |
| 1.17 | Setup pytest for briefs | `apps/briefs/pytest.ini`, `apps/briefs/tests/__init__.py`, `apps/briefs/requirements-dev.txt` | Configure Python test framework |
| 1.18 | Test LLM client | `apps/briefs/tests/test_llm.py`, `apps/briefs/src/llm.py` | Test model selection, token counting |
| 1.19 | Test events API client | `apps/briefs/tests/test_events.py`, `apps/briefs/src/events.py` | Test article fetching |
| 1.20 | Add test coverage reporting | `apps/scrapers/vitest.config.ts`, `.github/workflows/deploy-services.yaml` | Generate and track coverage |

---

## Action 2: Fix Error Handling Patterns
**Confidence: 92%** | **Impact: Critical** | **Files: 8 files**

### Why This Matters
- Silent failures hide production issues
- Mixed patterns (throw vs neverthrow) cause confusion
- No error recovery strategy

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 2.1 | Create ApplicationError type | `apps/scrapers/src/lib/errors.ts` | Define typed error codes, messages |
| 2.2 | Add global error middleware to Hono | `apps/scrapers/src/app.ts`, `apps/scrapers/src/lib/errors.ts` | Catch and format all errors |
| 2.3 | Fix rssFeed workflow error handling | `apps/scrapers/src/workflows/rssFeed.workflow.ts` | Replace throws with err() returns |
| 2.4 | Fix processArticles error propagation | `apps/scrapers/src/workflows/processArticles.workflow.ts` | Consistent neverthrow usage |
| 2.5 | Fix rate limiter silent failures | `apps/scrapers/src/lib/rateLimiter.ts` | Log and record skipped items |
| 2.6 | Add circuit breaker for external APIs | `apps/scrapers/src/lib/circuitBreaker.ts`, `apps/scrapers/src/lib/firecrawl.ts` | Prevent cascade failures |
| 2.7 | Fix frontend API error handling | `apps/frontend/src/server/api/subscribe.post.ts`, `apps/frontend/src/server/api/stats.get.ts` | Remove `any` types, add proper catches |
| 2.8 | Add error recovery for workflows | `apps/scrapers/src/workflows/processArticles.workflow.ts` | Retry failed articles on next run |
| 2.9 | Fix reports router error responses | `apps/scrapers/src/routers/reports.router.ts` | Return structured error objects |
| 2.10 | Add error boundary to admin dashboard | `apps/frontend/src/pages/admin/index.vue`, `apps/frontend/src/components/ErrorBoundary.vue` | Graceful UI error handling |

---

## Action 3: Enhance CI/CD Pipeline
**Confidence: 94%** | **Impact: High** | **Files: 3 files**

### Why This Matters
- No tests run before deployment
- No type checking enforcement
- No security scanning

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 3.1 | Add pnpm typecheck step | `.github/workflows/deploy-services.yaml` | Run typecheck before build |
| 3.2 | Add pnpm test step | `.github/workflows/deploy-services.yaml` | Run all test suites |
| 3.3 | Add pnpm lint step | `.github/workflows/deploy-services.yaml`, `package.json` | Enforce code quality |
| 3.4 | Add dependency vulnerability scan | `.github/workflows/deploy-services.yaml` | Use npm audit or Snyk |
| 3.5 | Add database migration dry-run | `.github/workflows/deploy-services.yaml` | Validate migrations before apply |
| 3.6 | Enable Cloudflare Pages deployment | `.github/workflows/deploy-services.yaml` | Uncomment and configure |
| 3.7 | Add post-deploy smoke tests | `.github/workflows/deploy-services.yaml`, `scripts/smoke-test.sh` | Verify endpoints after deploy |
| 3.8 | Add rollback workflow | `.github/workflows/rollback.yaml` | Quick revert capability |
| 3.9 | Add branch protection rules doc | `docs/CONTRIBUTING.md` | Require checks before merge |
| 3.10 | Add test coverage threshold | `.github/workflows/deploy-services.yaml` | Fail if coverage drops |

---

## Action 4: Optimize Article Processing Performance
**Confidence: 88%** | **Impact: High** | **Files: 4 files**

### Why This Matters
- 200 articles take 2+ minutes to process
- Rate limiter causes unnecessary serialization
- No LLM call batching

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 4.1 | Reduce global cooldown | `apps/scrapers/src/workflows/processArticles.workflow.ts` | Change 1000ms → 250ms |
| 4.2 | Increase max concurrent | `apps/scrapers/src/workflows/processArticles.workflow.ts` | Change 8 → 15 with smarter backoff |
| 4.3 | Batch LLM analysis calls | `apps/scrapers/src/workflows/processArticles.workflow.ts`, `apps/scrapers/src/prompts/articleAnalysis.prompt.ts` | Process 5 articles per call |
| 4.4 | Optimize DB updates with batch insert | `apps/scrapers/src/workflows/processArticles.workflow.ts` | Use single UPDATE with CASE |
| 4.5 | Move filtering to SQL in rssFeed | `apps/scrapers/src/workflows/rssFeed.workflow.ts` | Filter by scrape_frequency in query |
| 4.6 | Add processing metrics | `apps/scrapers/src/workflows/processArticles.workflow.ts`, `apps/scrapers/src/lib/metrics.ts` | Track times per step |
| 4.7 | Implement parallel OCR + fetch | `apps/scrapers/src/workflows/processArticles.workflow.ts` | Race Gemini and fetch for PDFs |
| 4.8 | Cache domain rate limit state | `apps/scrapers/src/lib/rateLimiter.ts` | Use KV for cross-workflow state |
| 4.9 | Add stats API caching | `apps/frontend/src/server/api/stats.get.ts` | Cache for 30s to reduce DB load |
| 4.10 | Benchmark before/after | `apps/scrapers/test/benchmarks/processing.bench.ts` | Verify improvements |

---

## Action 5: Implement Structured Logging & Monitoring
**Confidence: 90%** | **Impact: High** | **Files: 6 files**

### Why This Matters
- console.log statements are unstructured
- No way to aggregate or search logs
- No alerting on failures

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 5.1 | Create logger utility | `apps/scrapers/src/lib/logger.ts` | Structured JSON logging with levels |
| 5.2 | Replace console.log in workflows | `apps/scrapers/src/workflows/processArticles.workflow.ts`, `apps/scrapers/src/workflows/rssFeed.workflow.ts` | Use structured logger |
| 5.3 | Add trace IDs to requests | `apps/scrapers/src/app.ts`, `apps/scrapers/src/lib/logger.ts` | Correlate logs across requests |
| 5.4 | Add metrics tracking | `apps/scrapers/src/lib/metrics.ts` | Track success/failure rates |
| 5.5 | Create metrics dashboard endpoint | `apps/scrapers/src/routers/metrics.router.ts`, `apps/scrapers/src/app.ts` | Expose Prometheus metrics |
| 5.6 | Configure Cloudflare observability | `apps/scrapers/wrangler.toml` | Enable detailed tracing |
| 5.7 | Add alert rules | `apps/scrapers/src/lib/alerts.ts`, `apps/scrapers/src/workflows/processArticles.workflow.ts` | Notify on high failure rates |
| 5.8 | Log OCR provider usage | `apps/scrapers/src/lib/documentOcr.ts` | Track Gemini vs Mistral usage |
| 5.9 | Add frontend error tracking | `apps/frontend/src/plugins/errorTracking.ts`, `apps/frontend/nuxt.config.ts` | Client-side error capture |
| 5.10 | Create runbook for common issues | `docs/RUNBOOK.md` | Document incident response |

---

## Action 6: Add API Documentation (OpenAPI)
**Confidence: 93%** | **Impact: Medium** | **Files: 5 files**

### Why This Matters
- No endpoint documentation
- Hard for new contributors
- No client generation

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 6.1 | Add OpenAPI package | `apps/scrapers/package.json` | Install @hono/zod-openapi |
| 6.2 | Define events endpoint schema | `apps/scrapers/src/schemas/events.schema.ts`, `apps/scrapers/src/app.ts` | Document /events endpoint |
| 6.3 | Define reports endpoint schema | `apps/scrapers/src/schemas/reports.schema.ts`, `apps/scrapers/src/routers/reports.router.ts` | Document /reports endpoints |
| 6.4 | Define openGraph endpoint schema | `apps/scrapers/src/schemas/openGraph.schema.ts`, `apps/scrapers/src/routers/openGraph.router.ts` | Document /openGraph endpoint |
| 6.5 | Add Swagger UI route | `apps/scrapers/src/app.ts` | Serve interactive docs at /docs |
| 6.6 | Generate TypeScript client | `packages/api-client/package.json`, `packages/api-client/src/index.ts` | Auto-generate from OpenAPI |
| 6.7 | Document frontend API routes | `apps/frontend/src/server/api/README.md` | Describe internal APIs |
| 6.8 | Add request/response examples | `apps/scrapers/src/schemas/examples.ts` | Example payloads for each endpoint |
| 6.9 | Document auth requirements | `docs/API.md` | Explain Bearer token auth |
| 6.10 | Add API changelog | `docs/API_CHANGELOG.md` | Track breaking changes |

---

## Action 7: Implement Newsletter Email Sending
**Confidence: 85%** | **Impact: Medium** | **Files: 5 files**

### Why This Matters
- Subscribe endpoint exists but emails never sent
- Feature promised in README
- User engagement opportunity

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 7.1 | Choose email provider | `apps/scrapers/package.json` | Add Resend or SendGrid SDK |
| 7.2 | Create email templates | `apps/scrapers/src/emails/brief.template.ts`, `apps/scrapers/src/emails/welcome.template.ts` | Design brief email |
| 7.3 | Add email sending utility | `apps/scrapers/src/lib/email.ts` | Wrapper for email provider |
| 7.4 | Create send-newsletter workflow | `apps/scrapers/src/workflows/newsletter.workflow.ts` | Fetch subscribers, send emails |
| 7.5 | Add workflow binding | `apps/scrapers/wrangler.toml`, `apps/scrapers/src/index.ts` | Register NEWSLETTER workflow |
| 7.6 | Add cron trigger for newsletter | `apps/scrapers/wrangler.toml` | Daily at 8am UTC |
| 7.7 | Track email delivery status | `packages/database/src/schema.ts`, `packages/database/migrations/` | Add sent_at, status columns |
| 7.8 | Add unsubscribe endpoint | `apps/scrapers/src/app.ts`, `apps/scrapers/src/lib/email.ts` | Handle unsubscribe tokens |
| 7.9 | Add email preview route | `apps/scrapers/src/app.ts` | Preview emails before sending |
| 7.10 | Test email workflow | `apps/scrapers/test/workflows/newsletter.spec.ts` | Verify send logic |

---

## Action 8: Fix Security Vulnerabilities
**Confidence: 96%** | **Impact: Critical** | **Files: 5 files**

### Why This Matters
- XSS vulnerability in Open Graph
- No rate limiting on auth failures
- Secrets could leak in logs

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 8.1 | Fix XSS in Open Graph | `apps/scrapers/src/routers/openGraph.router.ts` | Escape HTML entities in title |
| 8.2 | Add auth rate limiting | `apps/scrapers/src/app.ts`, `apps/scrapers/src/lib/rateLimiter.ts` | Limit failed auth attempts |
| 8.3 | Sanitize URL logging | `apps/scrapers/src/lib/logger.ts` | Strip query params from logged URLs |
| 8.4 | Add input validation | `apps/scrapers/src/app.ts` | Validate date param format |
| 8.5 | Check for disposable emails | `apps/frontend/src/server/api/subscribe.post.ts` | Block temporary email domains |
| 8.6 | Use parameterized SQL | `apps/frontend/src/server/api/stats.get.ts` | Replace raw SQL with Drizzle methods |
| 8.7 | Add Content-Security-Policy | `apps/frontend/nuxt.config.ts` | Prevent XSS attacks |
| 8.8 | Add security headers | `apps/scrapers/src/app.ts` | X-Frame-Options, etc. |
| 8.9 | Audit npm dependencies | `.github/workflows/deploy-services.yaml` | Add npm audit step |
| 8.10 | Document security practices | `docs/SECURITY.md` | Responsible disclosure, etc. |

---

## Action 9: Add Database Migration Tests
**Confidence: 91%** | **Impact: Medium** | **Files: 4 files**

### Why This Matters
- 10 migrations with no tests
- No rollback verification
- Production data at risk

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 9.1 | Setup test database | `packages/database/test/setup.ts`, `packages/database/package.json` | Configure test PostgreSQL |
| 9.2 | Test migration apply | `packages/database/test/migrations.spec.ts` | Verify all migrations run |
| 9.3 | Test migration rollback | `packages/database/test/migrations.spec.ts` | Verify rollback works |
| 9.4 | Test schema validation | `packages/database/test/schema.spec.ts`, `packages/database/src/schema.ts` | Verify table definitions |
| 9.5 | Test query builders | `packages/database/test/queries.spec.ts` | Verify common queries |
| 9.6 | Add seed data script | `packages/database/src/seed.ts`, `packages/database/package.json` | Create test data |
| 9.7 | Test database constraints | `packages/database/test/constraints.spec.ts` | Verify foreign keys, unique |
| 9.8 | Add migration dry-run | `packages/database/scripts/dry-run.ts` | Preview SQL before apply |
| 9.9 | Document migration process | `packages/database/README.md` | How to create, test, apply |
| 9.10 | Add backup/restore scripts | `packages/database/scripts/backup.sh`, `packages/database/scripts/restore.sh` | Disaster recovery |

---

## Action 10: Implement Brief Continuity Tracking
**Confidence: 82%** | **Impact: Medium** | **Files: 4 files**

### Why This Matters
- synthesize_brief() has previous_tldr param but unused
- Briefs lack context from previous days
- Reduces coherence of daily narratives

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 10.1 | Add tldr column to reports | `packages/database/src/schema.ts`, `packages/database/migrations/` | Store TLDR separately |
| 10.2 | Extract TLDR in brief generation | `apps/briefs/src/llm.py` | Parse TLDR section from output |
| 10.3 | Fetch previous TLDR | `apps/briefs/src/events.py`, `apps/briefs/reportV5.ipynb` | Get last report's TLDR |
| 10.4 | Pass TLDR to synthesis | `apps/briefs/reportV5.ipynb` | Use previous_tldr parameter |
| 10.5 | Add continuity section to brief | `apps/briefs/src/llm.py` | "Since Yesterday" section |
| 10.6 | Store running themes | `packages/database/src/schema.ts` | Track multi-day story arcs |
| 10.7 | Display continuity in frontend | `apps/frontend/src/pages/briefs/[slug].vue` | Show related previous briefs |
| 10.8 | Add story thread tracking | `apps/briefs/src/threads.py` | Track evolving stories |
| 10.9 | Test continuity logic | `apps/briefs/tests/test_continuity.py` | Verify TLDR extraction |
| 10.10 | Document continuity feature | `docs/BRIEFS.md` | Explain how tracking works |

---

## Alternative Approaches (Confidence < 80%)

### For Action 7 (Newsletter - 85%)
**Alternative**: Instead of building custom email system:
- Use Buttondown or Substack integration (external service)
- Pros: Faster to implement, managed deliverability
- Cons: Less control, recurring cost

### For Action 10 (Continuity - 82%)
**Alternative**: Instead of database-stored TLDR:
- Use vector embeddings to find related past briefs
- Pros: More sophisticated matching
- Cons: Requires embedding pipeline, more complex

---

## Cognitive Empathy Analysis

### User Perspective
- **Frustration**: "Why isn't newsletter working? I subscribed but never got emails"
- **Anxiety**: "How do I know the system is working? No visibility"
- **Confusion**: "What does this codebase do? Hard to understand"

### Developer Perspective
- **Fear**: "I can't safely change this code without tests"
- **Overwhelm**: "Too many console.logs to grep through"
- **Blocked**: "No docs for API endpoints I need to call"

### Operations Perspective
- **Blind**: "Production could be failing and I wouldn't know"
- **Risk**: "Deployments are untested, any push could break prod"
- **Debt**: "Security issues accumulating without scan"

---

## Implementation Order Recommendation

```
Week 1: Security + CI/CD (Actions 8, 3)
   └── Critical vulnerabilities + deployment safety

Week 2: Testing + Error Handling (Actions 1.1-1.11, 2)
   └── Foundation for safe development

Week 3: Performance + Monitoring (Actions 4, 5)
   └── Faster processing, visibility

Week 4: Documentation + Features (Actions 6, 7, 10)
   └── DX improvements, complete features

Week 5: Remaining Tests + Database (Actions 1.12-1.20, 9)
   └── Full coverage, data safety
```

---

*This roadmap provides a structured path to significantly improve Meridian's reliability, security, and developer experience.*
