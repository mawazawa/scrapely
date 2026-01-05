# Court Data Platform: 10 Highest Leverage Actions

> **Last Updated**: 2026-01-05T12:00:00Z
> **Research Validated**: January 5, 2026
> **Target**: Build a 10x improved alternative to UniCourt, starting with SF Superior Court
> **Phase**: Phase 3 - Production Readiness & Market Expansion

---

## Executive Summary

After deep codebase analysis, the following **critical gaps** were identified:

| Gap | Impact | Current State |
|-----|--------|---------------|
| **User Authentication** | 🔴 Blocking | Zero - only API keys exist |
| **Error Tracking** | 🔴 Critical | No Sentry, basic logging only |
| **Court Scraping Tests** | 🟠 High Risk | No integration tests for court/* |
| **Scheduled Scraping** | 🟠 Data Staleness | No court cron jobs (only RSS) |
| **Case Dashboard UI** | 🟠 User Adoption | No court UI pages at all |
| **LA Court Support** | 🟡 Market Size | Only SF (LA is 10x larger) |
| **Billing** | 🟡 Revenue | Zero payment infrastructure |

---

## Completed Actions (Phase 1 & 2)

| # | Action | Status |
|---|--------|--------|
| 1 | Apify + Crawlee Integration | ✅ Complete |
| 2 | SF Court Scraper with Cloudflare Bypass | ✅ Complete |
| 3 | Court Data Schema & Database | ✅ Complete |
| 4 | Tentative Rulings Parser | ✅ Complete |
| 5 | Case Tracking & Monitoring System | ✅ Complete |
| 6 | User Case Management | ✅ Complete |
| 7 | Court Document Storage (R2) | ✅ Complete |
| 8 | Case Update Alert System | ✅ Complete |
| 9 | Court Data Search Infrastructure | ✅ Complete |
| 10 | Public Court Data API | ✅ Complete |
| 🐛 | 10 Critical Bug Fixes | ✅ Complete |

---

## Next 10 High-Leverage Actions (Phase 3)

| # | Action | Confidence | Impact | Effort | Priority |
|---|--------|------------|--------|--------|----------|
| 1 | **User Authentication (Clerk)** | 92% | 🔴 Blocking | 3 days | P0 |
| 2 | **Production Error Tracking (Sentry)** | 95% | 🔴 Critical | 1 day | P0 |
| 3 | **Court Scraping Integration Tests** | 90% | 🟠 High Risk | 3 days | P0 |
| 4 | **Scheduled Court Scraping Jobs** | 88% | 🟠 Core Value | 2 days | P1 |
| 5 | **Case Tracking Dashboard UI** | 85% | 🟠 User Value | 4 days | P1 |
| 6 | **LA Superior Court Scraper** | 80% | 🟡 Market Size | 5 days | P1 |
| 7 | **Webhook Delivery Queue** | 85% | 🟡 Reliability | 2 days | P2 |
| 8 | **Usage Metrics Dashboard** | 82% | 🟡 Intelligence | 2 days | P2 |
| 9 | **Stripe Billing Integration** | 78% | 🟡 Revenue | 4 days | P2 |
| 10 | **Data Quality Pipeline** | 80% | 🟡 Integrity | 3 days | P2 |

---

## Action 1: User Authentication with Clerk (Confidence: 92%)

**Research Date**: 2026-01-05
**Documentation Validated**: Yes - [clerk.com/docs](https://clerk.com/docs)

### Why This Is Highest Leverage

Without user authentication, the platform cannot:
- Have real users sign up and log in
- Protect user-specific data (tracked cases, alerts)
- Enable personalized experiences
- Implement billing (requires user identity)
- Provide secure API access beyond static keys

**This blocks ALL user-facing features.**

### Why Clerk vs Auth0/Firebase

| Factor | Clerk | Auth0 | Firebase |
|--------|-------|-------|----------|
| **Cloudflare Workers** | ✅ First-class | ⚠️ Complex | ❌ Limited |
| **Nuxt 3 Integration** | ✅ Official SDK | ⚠️ Community | ⚠️ Community |
| **Pricing** | Free tier + usage | Expensive | Complex |
| **UI Components** | Pre-built | DIY | DIY |
| **Time to Implement** | ~3 days | ~7 days | ~5 days |

### Success Criteria
- [ ] Users can sign up with email or Google/GitHub
- [ ] Protected routes redirect to sign-in
- [ ] User ID flows through to database operations
- [ ] Session persists across page refreshes
- [ ] API routes validate Clerk session tokens

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 1.1 | Create Clerk account & app | - | Sign up at clerk.com, create application |
| 1.2 | Install Clerk packages | `apps/frontend/package.json`, `apps/scrapers/package.json` | `@clerk/nuxt`, `@clerk/backend` |
| 1.3 | Configure Clerk environment | `apps/frontend/.env`, `apps/scrapers/.dev.vars` | CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY |
| 1.4 | Add Clerk Nuxt module | `apps/frontend/nuxt.config.ts` | Register @clerk/nuxt module |
| 1.5 | Create auth middleware | `apps/frontend/src/middleware/auth.ts` | Protect routes requiring authentication |
| 1.6 | Add sign-in page | `apps/frontend/src/pages/sign-in/[[...sign-in]].vue` | Clerk SignIn component |
| 1.7 | Add sign-up page | `apps/frontend/src/pages/sign-up/[[...sign-up]].vue` | Clerk SignUp component |
| 1.8 | Add user button to header | `apps/frontend/src/layouts/default.vue` | UserButton component |
| 1.9 | Create users table | `packages/database/src/schema.ts` | $users table linked to Clerk IDs |
| 1.10 | Add user sync webhook | `apps/scrapers/src/routes/webhooks.router.ts` | Sync Clerk users to database |
| 1.11 | Create auth middleware for API | `apps/scrapers/src/middleware/clerkAuth.ts` | Verify Clerk session tokens |
| 1.12 | Update case tracking to use user ID | `apps/scrapers/src/court/tracking/TrackingService.ts` | Replace string userId with Clerk ID |
| 1.13 | Update alert service to use user ID | `apps/scrapers/src/court/alerts/AlertService.ts` | Link alerts to authenticated users |
| 1.14 | Add user profile page | `apps/frontend/src/pages/profile.vue` | Display user info, settings |
| 1.15 | Write auth integration tests | `apps/frontend/e2e/auth.spec.ts` | Test sign-in, sign-up, protected routes |

### Cognitive Empathy Analysis

| Perspective | Considerations |
|-------------|----------------|
| **User** | Frictionless sign-up, social login options, password recovery |
| **Developer** | Type-safe session handling, clear auth patterns |
| **Operations** | User management dashboard, suspicious activity monitoring |

---

## Action 2: Production Error Tracking with Sentry (Confidence: 95%)

**Research Date**: 2026-01-05
**Documentation Validated**: Yes - [docs.sentry.io/platforms/javascript/guides/cloudflare/](https://docs.sentry.io/platforms/javascript/guides/cloudflare/)

### Why This Is Critical

Current state: When the scraper fails in production, you have:
- Basic console logs in Cloudflare dashboard
- No stack traces with source maps
- No error grouping or deduplication
- No alerting on critical errors
- No performance monitoring

**You cannot debug production issues effectively without this.**

### Success Criteria
- [ ] All errors in Workers captured with full context
- [ ] Source maps uploaded for readable stack traces
- [ ] Alerts configured for critical errors (email/Slack)
- [ ] Performance monitoring enabled
- [ ] Frontend errors captured with user context

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 2.1 | Create Sentry account & project | - | Create projects for scrapers and frontend |
| 2.2 | Install Sentry Workers SDK | `apps/scrapers/package.json` | `@sentry/cloudflare` |
| 2.3 | Install Sentry Vue SDK | `apps/frontend/package.json` | `@sentry/vue` |
| 2.4 | Configure Sentry environment | `apps/scrapers/.dev.vars`, `apps/frontend/.env` | SENTRY_DSN |
| 2.5 | Initialize Sentry in Workers | `apps/scrapers/src/index.ts` | Wrap Hono app with Sentry |
| 2.6 | Initialize Sentry in Nuxt | `apps/frontend/src/plugins/sentry.ts` | Vue error handler integration |
| 2.7 | Add source map upload | `.github/workflows/deploy-services.yaml` | Upload source maps on deploy |
| 2.8 | Configure error sampling | `apps/scrapers/src/lib/sentry.ts` | Sample rate, environment tagging |
| 2.9 | Add user context | `apps/scrapers/src/middleware/sentry.ts` | Attach user ID to errors |
| 2.10 | Configure alerts | Sentry dashboard | Email alerts for critical errors |
| 2.11 | Add performance monitoring | `apps/scrapers/src/lib/sentry.ts` | Transaction tracing for scrapers |
| 2.12 | Create error boundary component | `apps/frontend/src/components/ErrorBoundary.vue` | Graceful error UI |
| 2.13 | Add scraper error tracking | `apps/scrapers/src/court/BaseCrawler.ts` | Capture scraping failures |
| 2.14 | Document error handling patterns | `docs/error-handling.md` | Team reference for error handling |
| 2.15 | Test error capture | Manual testing | Trigger errors, verify in Sentry |

---

## Action 3: Court Scraping Integration Tests (Confidence: 90%)

**Research Date**: 2026-01-05
**Documentation Validated**: Yes - [vitest.dev](https://vitest.dev/), [playwright.dev](https://playwright.dev/)

### Why This Is High Risk Without Tests

The court scraper:
- Bypasses Cloudflare protection (fragile)
- Parses complex HTML (changes break it)
- Handles rate limiting (easy to break)
- Manages sessions (state-dependent)

**Without tests, any change could break production scraping silently.**

### Current Test Coverage Analysis

| Module | Lines of Tests | Coverage |
|--------|---------------|----------|
| RSS parsing | 64 lines | ✅ Good |
| Cache library | 181 lines | ✅ Good |
| Dedup library | 187 lines | ✅ Good |
| Error handling | 136 lines | ✅ Good |
| Security | 115 lines | ✅ Good |
| **Court Cloudflare** | 0 lines | ❌ None |
| **Court SFCourt Scraper** | 0 lines | ❌ None |
| **Court Alert Service** | 0 lines | ❌ None |
| **Court Tracking Service** | 0 lines | ❌ None |
| **Court Search Service** | 0 lines | ❌ None |

### Success Criteria
- [ ] Cloudflare bypass tested with mock challenge page
- [ ] SF Court scraper tested with recorded HTML fixtures
- [ ] Alert service tested with mock delivery
- [ ] Tracking service tested with mock database
- [ ] 80%+ coverage on court/* modules

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 3.1 | Set up MSW for API mocking | `apps/scrapers/test/setup.ts`, `package.json` | Mock Service Worker for HTTP |
| 3.2 | Create HTML fixtures for SF Court | `apps/scrapers/test/fixtures/sfCourt/*.html` | Recorded court pages |
| 3.3 | Test Cloudflare detection | `apps/scrapers/test/court/cloudflare.spec.ts` | isCloudflareChallenge() |
| 3.4 | Test case number validation | `apps/scrapers/test/court/caseNumber.spec.ts` | All case number patterns |
| 3.5 | Test SFCourtScraper with fixtures | `apps/scrapers/test/court/sfCourt.spec.ts` | Mock page, test parsing |
| 3.6 | Test BaseCrawler methods | `apps/scrapers/test/court/baseCrawler.spec.ts` | navigate, typeText, click |
| 3.7 | Test AlertService | `apps/scrapers/test/court/alertService.spec.ts` | Mock email, push, webhook |
| 3.8 | Test TrackingService | `apps/scrapers/test/court/trackingService.spec.ts` | Mock database |
| 3.9 | Test SearchService | `apps/scrapers/test/court/searchService.spec.ts` | Mock database queries |
| 3.10 | Test presign token generation | `apps/scrapers/test/court/presign.spec.ts` | Token create/verify |
| 3.11 | Add coverage reporting | `apps/scrapers/vitest.config.ts` | c8 coverage provider |
| 3.12 | Add coverage to CI | `.github/workflows/deploy-services.yaml` | Fail if coverage drops |
| 3.13 | Create E2E scraper test | `apps/scrapers/test/e2e/scraper.spec.ts` | Full scrape with real browser |
| 3.14 | Document test patterns | `apps/scrapers/test/README.md` | How to write court tests |
| 3.15 | Add test data generators | `apps/scrapers/test/factories/*.ts` | Factory functions for test data |

---

## Action 4: Scheduled Court Scraping Jobs (Confidence: 88%)

**Research Date**: 2026-01-05
**Documentation Validated**: Yes - [developers.cloudflare.com/workers/configuration/cron-triggers/](https://developers.cloudflare.com/workers/configuration/cron-triggers/)

### Why This Enables Core Value

Without scheduled scraping:
- Court data becomes stale immediately after manual scrape
- Real-time alerts are impossible
- Users must manually trigger refreshes
- Value proposition of "monitoring" is broken

### Current Cron Jobs in wrangler.toml
```toml
crons = [ "4 * * * *", "0 8 * * *" ]
```
- `4 * * * *` - RSS feed scraping (hourly)
- `0 8 * * *` - Newsletter (daily)
- **MISSING**: Court scraping schedules

### Success Criteria
- [ ] SF Court tentative rulings scraped daily at 6 AM PT
- [ ] Tracked cases refreshed every 4 hours
- [ ] Failed jobs retry with exponential backoff
- [ ] Job status visible in admin dashboard
- [ ] Alerts triggered when new rulings found

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 4.1 | Create court scraping workflow | `apps/scrapers/src/workflows/courtScrape.workflow.ts` | Cloudflare Workflow for scraping |
| 4.2 | Add cron triggers for court | `apps/scrapers/wrangler.toml` | `0 14 * * *` (6 AM PT) |
| 4.3 | Create tracked cases refresh job | `apps/scrapers/src/workflows/refreshTracked.workflow.ts` | Refresh user-tracked cases |
| 4.4 | Add job scheduling table | `packages/database/src/schema.ts` | $courtScrapeJobs |
| 4.5 | Implement job queue | `apps/scrapers/src/court/jobs/queue.ts` | Priority queue for scrape jobs |
| 4.6 | Add retry logic with backoff | `apps/scrapers/src/court/jobs/retry.ts` | Exponential backoff |
| 4.7 | Create job status API | `apps/scrapers/src/routes/jobs.router.ts` | GET /jobs, GET /jobs/:id |
| 4.8 | Add job dashboard component | `apps/frontend/src/pages/admin/jobs.vue` | View job status |
| 4.9 | Implement job concurrency limits | `apps/scrapers/src/court/jobs/limiter.ts` | Max 1 concurrent per court |
| 4.10 | Add failure alerting | `apps/scrapers/src/court/jobs/alerts.ts` | Alert on repeated failures |
| 4.11 | Create job metrics | `apps/scrapers/src/court/jobs/metrics.ts` | Success rate, duration |
| 4.12 | Add manual trigger API | `apps/scrapers/src/routes/jobs.router.ts` | POST /jobs/trigger |
| 4.13 | Implement job history cleanup | `apps/scrapers/src/court/jobs/cleanup.ts` | Delete old job records |
| 4.14 | Add distributed locking | `apps/scrapers/src/court/jobs/lock.ts` | Prevent duplicate runs |
| 4.15 | Write job scheduling tests | `apps/scrapers/test/court/jobs.spec.ts` | Test scheduling logic |

---

## Action 5: Case Tracking Dashboard UI (Confidence: 85%)

**Research Date**: 2026-01-05
**Documentation Validated**: Yes - [nuxt.com/docs](https://nuxt.com/docs), [vuejs.org](https://vuejs.org/)

### Why This Enables User Value

Current frontend pages:
- `/` - Home page
- `/briefs` - Briefs listing (news, not courts)
- `/admin` - Admin dashboard
- **NO court case UI at all**

Users can track cases via API but have NO way to:
- See their tracked cases in a list
- View case details and history
- See recent rulings affecting their cases
- Manage alerts and notifications
- Search and add new cases

**Without a UI, the platform is API-only and unusable for lawyers.**

### Success Criteria
- [ ] Dashboard page showing all tracked cases
- [ ] Case detail page with full history
- [ ] Add case by case number
- [ ] Alert management (enable/disable, channels)
- [ ] Search cases across courts

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 5.1 | Create dashboard layout | `apps/frontend/src/layouts/dashboard.vue` | Sidebar nav, user menu |
| 5.2 | Create cases list page | `apps/frontend/src/pages/dashboard/cases/index.vue` | Table of tracked cases |
| 5.3 | Create case detail page | `apps/frontend/src/pages/dashboard/cases/[id].vue` | Full case information |
| 5.4 | Add case search component | `apps/frontend/src/components/court/CaseSearch.vue` | Search by number, party |
| 5.5 | Create add case modal | `apps/frontend/src/components/court/AddCaseModal.vue` | Add case to tracking |
| 5.6 | Create case card component | `apps/frontend/src/components/court/CaseCard.vue` | Case summary card |
| 5.7 | Create timeline component | `apps/frontend/src/components/court/CaseTimeline.vue` | Case event timeline |
| 5.8 | Create rulings list component | `apps/frontend/src/components/court/RulingsList.vue` | Recent rulings |
| 5.9 | Create alert settings page | `apps/frontend/src/pages/dashboard/alerts.vue` | Manage alert prefs |
| 5.10 | Add notifications dropdown | `apps/frontend/src/components/NotificationsDropdown.vue` | Recent alerts |
| 5.11 | Create court selector | `apps/frontend/src/components/court/CourtSelector.vue` | Filter by court |
| 5.12 | Add real-time updates | `apps/frontend/src/composables/useCourtUpdates.ts` | WebSocket for live updates |
| 5.13 | Create empty states | `apps/frontend/src/components/EmptyState.vue` | No cases, no results |
| 5.14 | Add loading skeletons | `apps/frontend/src/components/CaseSkeleton.vue` | Loading placeholders |
| 5.15 | Write dashboard E2E tests | `apps/frontend/e2e/dashboard.spec.ts` | Test all dashboard flows |

---

## Action 6: LA Superior Court Scraper (Confidence: 80%)

**Research Date**: 2026-01-05
**Documentation Validated**: Yes - [lacourt.org](https://www.lacourt.org/)

### Why This Is Major Market Expansion

| Metric | SF Superior | LA Superior |
|--------|-------------|-------------|
| **Annual Cases** | ~50,000 | ~500,000 |
| **Attorneys** | ~10,000 | ~100,000 |
| **Population** | 870,000 | 10,000,000 |
| **Market Size** | 1x | **10x** |

**LA County is the largest court system in the US. Adding it 10x the addressable market.**

### Technical Considerations
- Different website (lacourt.org vs sf.courts.ca.gov)
- Different case number format
- Different Cloudflare protection level
- Different page structures
- Public Portal vs Case Access

### Success Criteria
- [ ] Can look up LA cases by case number
- [ ] Can scrape tentative rulings
- [ ] Can track LA cases
- [ ] Handles LA's specific Cloudflare setup
- [ ] LA cases appear in unified search

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 6.1 | Research LA Court website | - | Document structure, selectors, auth |
| 6.2 | Create LA case number parser | `apps/scrapers/src/court/laCourt/caseNumber.ts` | LA case number format |
| 6.3 | Create LA URL helpers | `apps/scrapers/src/court/laCourt/urls.ts` | Portal URLs |
| 6.4 | Create LA selectors | `apps/scrapers/src/court/laCourt/selectors.ts` | CSS selectors for LA pages |
| 6.5 | Create LACourtScraper | `apps/scrapers/src/court/laCourt/LACourtScraper.ts` | Main scraper class |
| 6.6 | Implement case lookup | `apps/scrapers/src/court/laCourt/LACourtScraper.ts` | lookupCase method |
| 6.7 | Implement tentative rulings | `apps/scrapers/src/court/laCourt/tentativeRulings.ts` | LA tentative ruling parser |
| 6.8 | Add LA to court registry | `apps/scrapers/src/court/CrawlerFactory.ts` | Register LA scraper |
| 6.9 | Add LA court to database | `packages/database/src/seed/courts.ts` | Seed LA court record |
| 6.10 | Create LA HTML fixtures | `apps/scrapers/test/fixtures/laCourt/*.html` | Test fixtures |
| 6.11 | Write LA scraper tests | `apps/scrapers/test/court/laCourt.spec.ts` | Unit tests |
| 6.12 | Add LA to cron jobs | `apps/scrapers/wrangler.toml` | LA scraping schedule |
| 6.13 | Update search to include LA | `apps/scrapers/src/court/search/SearchService.ts` | Multi-court search |
| 6.14 | Add LA court to frontend | `apps/frontend/src/components/court/CourtSelector.vue` | LA option |
| 6.15 | E2E test LA scraping | `apps/scrapers/test/e2e/laCourt.spec.ts` | Integration test |

---

## Action 7: Webhook Delivery Queue with Retries (Confidence: 85%)

**Research Date**: 2026-01-05
**Documentation Validated**: Yes - [developers.cloudflare.com/queues/](https://developers.cloudflare.com/queues/)

### Why This Improves Reliability

Current webhook implementation (`apps/scrapers/src/court/alerts/webhook.ts`):
- Fire and forget delivery
- No retry on failure
- No delivery confirmation
- No dead letter handling

**For enterprise integrations, reliable delivery is non-negotiable.**

### Success Criteria
- [ ] Failed webhooks retry with exponential backoff
- [ ] Max 5 retries over 24 hours
- [ ] Dead letter queue for permanent failures
- [ ] Delivery status tracking
- [ ] Webhook signature verification

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 7.1 | Create Cloudflare Queue | `apps/scrapers/wrangler.toml` | WEBHOOK_QUEUE binding |
| 7.2 | Create queue producer | `apps/scrapers/src/court/alerts/webhookQueue.ts` | Queue webhook messages |
| 7.3 | Create queue consumer | `apps/scrapers/src/queues/webhookConsumer.ts` | Process queued webhooks |
| 7.4 | Implement retry logic | `apps/scrapers/src/queues/retry.ts` | Exponential backoff |
| 7.5 | Add delivery tracking table | `packages/database/src/schema.ts` | $webhookDeliveries |
| 7.6 | Implement webhook signatures | `apps/scrapers/src/court/alerts/webhookSignature.ts` | HMAC signing |
| 7.7 | Create dead letter handler | `apps/scrapers/src/queues/deadLetter.ts` | Handle permanent failures |
| 7.8 | Add delivery status API | `apps/scrapers/src/routes/webhooks.router.ts` | GET /webhooks/:id/deliveries |
| 7.9 | Add webhook test endpoint | `apps/scrapers/src/routes/webhooks.router.ts` | POST /webhooks/test |
| 7.10 | Create webhook dashboard | `apps/frontend/src/pages/dashboard/webhooks.vue` | View webhook status |
| 7.11 | Add webhook retry button | `apps/frontend/src/components/WebhookRetryButton.vue` | Manual retry |
| 7.12 | Implement rate limiting | `apps/scrapers/src/queues/rateLimit.ts` | Per-endpoint limits |
| 7.13 | Add webhook metrics | `apps/scrapers/src/queues/metrics.ts` | Success rate, latency |
| 7.14 | Write queue tests | `apps/scrapers/test/queues/webhook.spec.ts` | Test retry logic |
| 7.15 | Document webhook integration | `docs/webhooks.md` | Integration guide |

---

## Action 8: Usage Metrics Dashboard (Confidence: 82%)

**Research Date**: 2026-01-05
**Documentation Validated**: Yes - [developers.cloudflare.com/analytics/](https://developers.cloudflare.com/analytics/)

### Why This Enables Business Intelligence

Current state: No visibility into:
- API usage patterns
- Scraper success rates
- Feature adoption
- Cost drivers
- User engagement

**You can't improve what you can't measure.**

### Success Criteria
- [ ] Real-time API usage metrics
- [ ] Scraper health dashboard
- [ ] User engagement metrics
- [ ] Cost tracking per operation
- [ ] Exportable reports

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 8.1 | Design metrics schema | `packages/database/src/schema.ts` | $usageMetrics, $scraperMetrics |
| 8.2 | Create metrics collector | `apps/scrapers/src/lib/metrics.ts` | Record usage events |
| 8.3 | Add API usage middleware | `apps/scrapers/src/middleware/metrics.ts` | Track all API calls |
| 8.4 | Add scraper metrics | `apps/scrapers/src/court/BaseCrawler.ts` | Track scrape success/failure |
| 8.5 | Create metrics API | `apps/scrapers/src/routes/metrics.router.ts` | GET /metrics endpoints |
| 8.6 | Create admin metrics page | `apps/frontend/src/pages/admin/metrics.vue` | Metrics dashboard |
| 8.7 | Add API usage charts | `apps/frontend/src/components/charts/ApiUsage.vue` | Usage over time |
| 8.8 | Add scraper health charts | `apps/frontend/src/components/charts/ScraperHealth.vue` | Success rates |
| 8.9 | Create cost calculator | `apps/scrapers/src/lib/costCalculator.ts` | Estimate costs |
| 8.10 | Add cost dashboard | `apps/frontend/src/pages/admin/costs.vue` | Cost breakdown |
| 8.11 | Create usage alerts | `apps/scrapers/src/lib/usageAlerts.ts` | Alert on anomalies |
| 8.12 | Add export functionality | `apps/scrapers/src/routes/metrics.router.ts` | CSV/JSON export |
| 8.13 | Create daily digest | `apps/scrapers/src/workflows/metricsDigest.workflow.ts` | Email summary |
| 8.14 | Add Cloudflare Analytics | `apps/scrapers/wrangler.toml` | CF Analytics integration |
| 8.15 | Write metrics tests | `apps/scrapers/test/lib/metrics.spec.ts` | Test collection |

---

## Action 9: Stripe Billing Integration (Confidence: 78%)

**Research Date**: 2026-01-05
**Documentation Validated**: Yes - [stripe.com/docs](https://stripe.com/docs)

### Why This Enables Revenue

Current state:
- API tiers defined in `$courtApiKeys.tier`: `'free'`, `'pro'`, `'enterprise'`
- No way to upgrade
- No payment processing
- No subscription management
- **$0 revenue capability**

### Success Criteria
- [ ] Users can upgrade to paid plans
- [ ] Usage-based metering for API calls
- [ ] Subscription management portal
- [ ] Invoice generation
- [ ] Free trial with upgrade prompts

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 9.1 | Create Stripe account | - | Set up Stripe account, get keys |
| 9.2 | Install Stripe SDK | `apps/scrapers/package.json`, `apps/frontend/package.json` | stripe, @stripe/stripe-js |
| 9.3 | Configure Stripe environment | `apps/scrapers/.dev.vars`, `apps/frontend/.env` | STRIPE_SECRET_KEY |
| 9.4 | Create billing tables | `packages/database/src/schema.ts` | $subscriptions, $invoices |
| 9.5 | Create pricing page | `apps/frontend/src/pages/pricing.vue` | Display plans |
| 9.6 | Implement checkout flow | `apps/scrapers/src/routes/billing.router.ts` | Create checkout session |
| 9.7 | Create Stripe webhook handler | `apps/scrapers/src/routes/stripeWebhooks.router.ts` | Handle Stripe events |
| 9.8 | Implement subscription sync | `apps/scrapers/src/lib/billing/subscriptionSync.ts` | Sync subscription status |
| 9.9 | Add usage metering | `apps/scrapers/src/lib/billing/usageMetering.ts` | Report API usage to Stripe |
| 9.10 | Create billing portal link | `apps/scrapers/src/routes/billing.router.ts` | Customer portal redirect |
| 9.11 | Add billing page | `apps/frontend/src/pages/dashboard/billing.vue` | Subscription management |
| 9.12 | Implement trial periods | `apps/scrapers/src/lib/billing/trials.ts` | 14-day free trial |
| 9.13 | Add upgrade prompts | `apps/frontend/src/components/UpgradePrompt.vue` | In-app upgrade nudges |
| 9.14 | Create invoice history | `apps/frontend/src/pages/dashboard/invoices.vue` | View past invoices |
| 9.15 | Write billing tests | `apps/scrapers/test/billing/*.spec.ts` | Test subscription flows |

---

## Action 10: Data Quality Pipeline (Confidence: 80%)

**Research Date**: 2026-01-05
**Documentation Validated**: Yes - [zod.dev](https://zod.dev/), Best practices

### Why This Ensures Data Integrity

Scraped data can have issues:
- Invalid dates from parsing errors (fixed one bug already!)
- Duplicate cases from re-scraping
- Missing fields from page changes
- Inconsistent formats across courts

**Garbage in, garbage out. Data quality is trust.**

### Success Criteria
- [ ] All scraped data validated with Zod schemas
- [ ] Duplicate cases detected and merged
- [ ] Data quality scores per record
- [ ] Anomaly detection for unusual patterns
- [ ] Data freshness monitoring

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 10.1 | Create validation schemas | `apps/scrapers/src/court/validation/schemas.ts` | Zod schemas for all types |
| 10.2 | Add validation to scrapers | `apps/scrapers/src/court/BaseCrawler.ts` | Validate before storing |
| 10.3 | Create deduplication service | `apps/scrapers/src/court/quality/deduplication.ts` | Find and merge duplicates |
| 10.4 | Add quality score calculation | `apps/scrapers/src/court/quality/scoring.ts` | Score data completeness |
| 10.5 | Create anomaly detector | `apps/scrapers/src/court/quality/anomalies.ts` | Flag unusual data |
| 10.6 | Add freshness tracking | `apps/scrapers/src/court/quality/freshness.ts` | Track data age |
| 10.7 | Create quality dashboard | `apps/frontend/src/pages/admin/quality.vue` | View data quality |
| 10.8 | Add quality alerts | `apps/scrapers/src/court/quality/alerts.ts` | Alert on quality drops |
| 10.9 | Create data repair tools | `apps/scrapers/src/court/quality/repair.ts` | Fix common issues |
| 10.10 | Add quality API | `apps/scrapers/src/routes/quality.router.ts` | Quality endpoints |
| 10.11 | Create quality reports | `apps/scrapers/src/court/quality/reports.ts` | Weekly quality reports |
| 10.12 | Add duplicate merge UI | `apps/frontend/src/pages/admin/duplicates.vue` | Manual duplicate resolution |
| 10.13 | Implement data lineage | `apps/scrapers/src/court/quality/lineage.ts` | Track data source |
| 10.14 | Add validation tests | `apps/scrapers/test/court/validation.spec.ts` | Test validation |
| 10.15 | Document data standards | `docs/data-quality.md` | Data quality guidelines |

---

## Implementation Priority Order

```
Week 1: Foundation (P0) - MUST HAVE
├── Action 1: User Authentication (Clerk) [3 days]
├── Action 2: Error Tracking (Sentry) [1 day]
└── Action 3: Integration Tests [3 days, ongoing]

Week 2-3: Core Value (P1) - SHOULD HAVE
├── Action 4: Scheduled Scraping [2 days]
├── Action 5: Dashboard UI [4 days]
└── Action 6: LA Court Scraper [5 days]

Week 4-5: Scale & Monetize (P2) - NICE TO HAVE
├── Action 7: Webhook Queue [2 days]
├── Action 8: Metrics Dashboard [2 days]
├── Action 9: Stripe Billing [4 days]
└── Action 10: Data Quality [3 days]
```

---

## Success Metrics (90-Day Targets)

| Metric | Current | Target |
|--------|---------|--------|
| **Registered Users** | 0 | 100 |
| **Tracked Cases** | 0 | 1,000 |
| **Courts Supported** | 1 | 3 |
| **Test Coverage (court/*)** | ~0% | 80% |
| **Error Rate** | Unknown | <1% |
| **Data Freshness** | Manual | <6 hours |
| **MRR** | $0 | $1,000 |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Cloudflare blocks scrapers | Medium | High | Multiple browser options, IP rotation, Camoufox |
| Court website changes | High | Medium | HTML fixtures for tests, quick update cycle |
| Sentry costs escalate | Low | Low | Sample rate tuning, error budgets |
| Stripe integration complexity | Medium | Medium | Start with simple plans, iterate |
| User adoption is slow | Medium | High | Free tier, marketing, SEO, partnerships |
| LA Court has different tech | Medium | Medium | Research thoroughly before building |

---

## Cognitive Empathy Analysis

### Legal Professional Perspective
- **Wants**: Real-time case alerts, tentative rulings before 3pm, document access
- **Pain Points**: Manual court website checking, missing deadlines, Cloudflare blocks
- **Priorities**: Authentication → Dashboard → Alerts → LA Court support

### Developer/Integrator Perspective
- **Wants**: Clean API, SDKs, webhook integrations, documentation
- **Pain Points**: No court APIs exist, data is locked in websites
- **Priorities**: Error tracking → Tests → Webhook reliability → Metrics

### Operations Perspective
- **Wants**: Reliable scraping, monitoring, scaling, cost control
- **Pain Points**: Cloudflare blocks, rate limiting, data freshness, debugging
- **Priorities**: Sentry → Scheduled jobs → Metrics → Data quality

---

## Technology Research Notes (January 2026)

### Clerk Authentication
- Clerk v6.x has native Cloudflare Workers support
- `@clerk/nuxt` officially supported for Nuxt 3
- Pricing: Free up to 10K MAUs, then $0.02/MAU
- Alternative considered: Auth0 (more complex Workers setup)

### Sentry Error Tracking
- `@sentry/cloudflare` v8.x has first-class Workers support
- Source maps work with Wrangler deploy
- Pricing: Free up to 5K errors/month, then $26/month for 50K
- Alternative considered: LogRocket (more expensive, less CF support)

### LA Court Technical Research
- Website: lacourt.org (different from sf.courts.ca.gov)
- Has case search portal requiring registration
- Different case number format than SF
- May have stronger Cloudflare protection
- Research needed before implementation

---

*This document should be updated after each major milestone completion.*
