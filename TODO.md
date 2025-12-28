# Court Data Platform: 10 Highest Leverage Actions

> **Last Updated**: 2025-12-28T00:00:00Z
> **Research Validated**: December 28, 2025
> **Target**: Build a 10x improved alternative to UniCourt, starting with SF Superior Court
> **Phase**: MVP - Personal cases + test users

---

## Platform Vision

Build a comprehensive court data platform that:
1. Bypasses Cloudflare protection using Apify/Crawlee/Camoufox
2. Scrapes SF Superior Court tentative rulings and case information
3. Provides real-time case tracking and alerts
4. Scales to support multiple California courts
5. Eventually becomes a UniCourt competitor

---

## Technology Stack (Verified December 2025)

| Component | Technology | Version | Documentation |
|-----------|------------|---------|---------------|
| **Scraping Framework** | Crawlee | 3.15.3 | [crawlee.dev](https://crawlee.dev/) |
| **Cloudflare Bypass** | Camoufox-js | Latest | [npm](https://www.npmjs.com/package/camoufox-js) |
| **API Client** | apify-client | Latest | [docs.apify.com](https://docs.apify.com/api/client/js) |
| **Browser** | Playwright + Firefox | Latest | [playwright.dev](https://playwright.dev/) |
| **Database** | PostgreSQL + Drizzle | 0.45.x | [orm.drizzle.team](https://orm.drizzle.team/) |
| **Workers** | Cloudflare Workers | Latest | [developers.cloudflare.com](https://developers.cloudflare.com/workers/) |
| **Storage** | Cloudflare R2 | Latest | [developers.cloudflare.com/r2](https://developers.cloudflare.com/r2/) |

---

## Next 10 High-Leverage Actions

| # | Action | Confidence | Impact | Effort | Status |
|---|--------|------------|--------|--------|--------|
| 1 | **Apify + Crawlee Integration** | 92% | Critical | 2 days | Pending |
| 2 | **SF Court Scraper with Cloudflare Bypass** | 88% | Critical | 3 days | Pending |
| 3 | **Court Data Schema & Database** | 95% | Critical | 1 day | Pending |
| 4 | **Tentative Rulings Parser** | 85% | High | 2 days | Pending |
| 5 | **Case Tracking & Monitoring System** | 82% | High | 2 days | Pending |
| 6 | **User Case Management** | 80% | High | 2 days | Pending |
| 7 | **Court Document Storage (R2)** | 90% | Medium | 1 day | Pending |
| 8 | **Case Update Alert System** | 78% | High | 2 days | Pending |
| 9 | **Court Data Search Infrastructure** | 85% | High | 2 days | Pending |
| 10 | **Public Court Data API** | 75% | Medium | 2 days | Pending |

---

## Action 1: Apify + Crawlee Integration (Confidence: 92%)

**Research Date**: 2025-12-28
**Documentation Validated**: Yes - [Crawlee 3.15.3](https://www.npmjs.com/package/crawlee), [apify-client](https://docs.apify.com/api/client/js)

### Why This Matters
- Foundation for all court scraping
- Cloudflare bypass capability with Camoufox
- Automatic retries and rate limiting
- Scales to millions of pages

### Success Criteria
- [ ] Crawlee installed and configured
- [ ] Camoufox browser launches successfully
- [ ] Can bypass Cloudflare challenge page
- [ ] Apify client connects to API
- [ ] Test scrape of protected page succeeds

### Atomic Subtasks

| # | Task | Files (≤5) | Success Criteria |
|---|------|------------|------------------|
| 1.1 | Add Crawlee dependencies | `apps/scrapers/package.json` | `crawlee@3.15.3`, `@crawlee/playwright`, `playwright` installed |
| 1.2 | Add Camoufox dependencies | `apps/scrapers/package.json` | `camoufox-js`, `playwright-core` installed |
| 1.3 | Add Apify client | `apps/scrapers/package.json` | `apify-client` installed |
| 1.4 | Create Crawlee config | `apps/scrapers/src/court/crawlee.config.ts` | Export valid CrawlerConfig |
| 1.5 | Create Camoufox launcher | `apps/scrapers/src/court/camoufox.ts` | `launchCamoufox()` returns browser |
| 1.6 | Create Cloudflare handler | `apps/scrapers/src/court/cloudflare.ts` | `handleCloudflareChallenge()` solves turnstile |
| 1.7 | Create Apify client wrapper | `apps/scrapers/src/court/apifyClient.ts` | `ApifyClientWrapper` with retry logic |
| 1.8 | Create base crawler class | `apps/scrapers/src/court/BaseCrawler.ts` | Abstract class with common methods |
| 1.9 | Add proxy configuration | `apps/scrapers/src/court/proxy.ts` | Residential proxy support |
| 1.10 | Create crawler factory | `apps/scrapers/src/court/CrawlerFactory.ts` | Factory returns configured crawler |
| 1.11 | Add rate limiting | `apps/scrapers/src/court/rateLimit.ts` | Max 1 req/min to courts |
| 1.12 | Create test for Cloudflare bypass | `apps/scrapers/test/court/cloudflare.spec.ts` | Test passes on protected site |
| 1.13 | Add environment variables | `apps/scrapers/.dev.vars.example` | APIFY_TOKEN, proxy config documented |
| 1.14 | Create types for court scraping | `apps/scrapers/src/court/types.ts` | All interfaces exported |
| 1.15 | Add error handling | `apps/scrapers/src/court/errors.ts` | CourtScraperError class with codes |

---

## Action 2: SF Court Scraper with Cloudflare Bypass (Confidence: 88%)

**Research Date**: 2025-12-28
**Documentation Validated**: Yes - [sf.courts.ca.gov](https://sf.courts.ca.gov/online-services)

### Why This Matters
- Core scraper for SF Superior Court
- Handles case info and tentative rulings
- Foundation for other California courts
- Cloudflare Turnstile bypass tested

### SF Court Case Number Format
- Format: `AAA-YY-######` (e.g., `CGC-24-123456`)
- Prefixes: `CGC` (Civil), `FDI` (Family Dissolution), `CNC` (Civil Non-Complex)
- Years: 2-digit (e.g., `24` = 2024)

### Success Criteria
- [ ] Scraper navigates to sf.courts.ca.gov
- [ ] Cloudflare challenge solved automatically
- [ ] Case lookup by number works
- [ ] Tentative rulings page scraped
- [ ] Data extracted matches schema

### Atomic Subtasks

| # | Task | Files (≤5) | Success Criteria |
|---|------|------------|------------------|
| 2.1 | Create SF Court scraper class | `apps/scrapers/src/court/sfCourt/SFCourtScraper.ts` | Extends BaseCrawler |
| 2.2 | Define SF Court URLs | `apps/scrapers/src/court/sfCourt/urls.ts` | All endpoint URLs exported |
| 2.3 | Create case lookup method | `apps/scrapers/src/court/sfCourt/SFCourtScraper.ts` | `lookupCase(caseNumber)` returns CaseInfo |
| 2.4 | Create tentative rulings scraper | `apps/scrapers/src/court/sfCourt/tentativeRulings.ts` | `scrapeTentativeRulings(date)` returns array |
| 2.5 | Add case number validator | `apps/scrapers/src/court/sfCourt/caseNumber.ts` | Validates CGC, FDI, CNC formats |
| 2.6 | Create page selectors | `apps/scrapers/src/court/sfCourt/selectors.ts` | CSS selectors for all elements |
| 2.7 | Handle session persistence | `apps/scrapers/src/court/sfCourt/session.ts` | Reuse Cloudflare cookies |
| 2.8 | Create party name search | `apps/scrapers/src/court/sfCourt/SFCourtScraper.ts` | `searchByPartyName(name)` returns cases |
| 2.9 | Extract case calendar | `apps/scrapers/src/court/sfCourt/calendar.ts` | `getCaseCalendar(caseNumber)` works |
| 2.10 | Extract case documents list | `apps/scrapers/src/court/sfCourt/documents.ts` | `getDocuments(caseNumber)` returns list |
| 2.11 | Handle pagination | `apps/scrapers/src/court/sfCourt/pagination.ts` | Multi-page results scraped |
| 2.12 | Create retry logic | `apps/scrapers/src/court/sfCourt/retry.ts` | Exponential backoff on failures |
| 2.13 | Add scrape logging | `apps/scrapers/src/court/sfCourt/logging.ts` | All actions logged with trace ID |
| 2.14 | Create integration test | `apps/scrapers/test/court/sfCourt.spec.ts` | Full flow test passes |
| 2.15 | Add mock responses | `apps/scrapers/test/fixtures/sfCourt/` | HTML fixtures for testing |
| 2.16 | Create scraper health check | `apps/scrapers/src/court/sfCourt/health.ts` | `checkHealth()` verifies access |

---

## Action 3: Court Data Schema & Database (Confidence: 95%)

**Research Date**: 2025-12-28
**Documentation Validated**: Yes - [Drizzle ORM](https://orm.drizzle.team/)

### Why This Matters
- Structured storage for all court data
- Relationships between cases, parties, rulings
- Supports search and analytics
- Scales to millions of records

### Success Criteria
- [ ] All court tables created
- [ ] Indexes for common queries
- [ ] Migrations generated and applied
- [ ] Types exported for TypeScript
- [ ] Test queries execute successfully

### Atomic Subtasks

| # | Task | Files (≤5) | Success Criteria |
|---|------|------------|------------------|
| 3.1 | Create courts table | `packages/database/src/schema.ts` | $courts with id, name, county, state |
| 3.2 | Create cases table | `packages/database/src/schema.ts` | $cases with caseNumber, courtId, caseType |
| 3.3 | Create parties table | `packages/database/src/schema.ts` | $parties with name, type, caseId |
| 3.4 | Create attorneys table | `packages/database/src/schema.ts` | $attorneys with name, barNumber, firm |
| 3.5 | Create rulings table | `packages/database/src/schema.ts` | $rulings with caseId, rulingDate, content |
| 3.6 | Create documents table | `packages/database/src/schema.ts` | $documents with caseId, title, filedDate |
| 3.7 | Create events table | `packages/database/src/schema.ts` | $caseEvents with caseId, eventType, date |
| 3.8 | Create case_tracking table | `packages/database/src/schema.ts` | $caseTracking with userId, caseId |
| 3.9 | Add indexes | `packages/database/src/schema.ts` | Indexes on caseNumber, partyName, date |
| 3.10 | Create relations | `packages/database/src/relations.ts` | Drizzle relations defined |
| 3.11 | Generate migrations | `packages/database/migrations/` | Migration files created |
| 3.12 | Create type exports | `packages/database/src/types.ts` | All table types exported |
| 3.13 | Add seed data | `packages/database/src/seed.ts` | SF Court seeded |
| 3.14 | Create query helpers | `packages/database/src/queries/court.ts` | Common court queries |
| 3.15 | Add test for schema | `packages/database/test/court.spec.ts` | CRUD operations work |

---

## Action 4: Tentative Rulings Parser (Confidence: 85%)

**Research Date**: 2025-12-28
**Documentation Validated**: Yes - SF Court rulings format analyzed

### Why This Matters
- Extracts structured data from rulings
- Identifies case outcomes
- Enables ruling search
- Critical for case tracking

### Success Criteria
- [ ] HTML rulings parsed to structured data
- [ ] Judge name extracted
- [ ] Ruling date extracted
- [ ] Case number linked
- [ ] Ruling text cleaned and stored

### Atomic Subtasks

| # | Task | Files (≤5) | Success Criteria |
|---|------|------------|------------------|
| 4.1 | Create ruling parser | `apps/scrapers/src/court/parsers/rulingParser.ts` | `parseRuling(html)` returns Ruling |
| 4.2 | Extract judge name | `apps/scrapers/src/court/parsers/rulingParser.ts` | Judge name parsed correctly |
| 4.3 | Extract ruling date | `apps/scrapers/src/court/parsers/rulingParser.ts` | Date in ISO format |
| 4.4 | Extract case number | `apps/scrapers/src/court/parsers/rulingParser.ts` | Case number validated |
| 4.5 | Clean ruling text | `apps/scrapers/src/court/parsers/textCleaner.ts` | HTML tags removed, text normalized |
| 4.6 | Identify ruling type | `apps/scrapers/src/court/parsers/rulingParser.ts` | GRANTED/DENIED/CONTINUED detected |
| 4.7 | Extract motion type | `apps/scrapers/src/court/parsers/rulingParser.ts` | Motion type categorized |
| 4.8 | Parse hearing info | `apps/scrapers/src/court/parsers/hearingParser.ts` | Hearing date/time/dept extracted |
| 4.9 | Create ruling schema | `apps/scrapers/src/court/parsers/schemas.ts` | Zod schema for validation |
| 4.10 | Handle multi-ruling pages | `apps/scrapers/src/court/parsers/rulingParser.ts` | Array of rulings returned |
| 4.11 | Create parser tests | `apps/scrapers/test/court/rulingParser.spec.ts` | Test fixtures pass |
| 4.12 | Add HTML fixtures | `apps/scrapers/test/fixtures/rulings/` | Sample ruling HTML |
| 4.13 | Handle edge cases | `apps/scrapers/src/court/parsers/rulingParser.ts` | Empty/malformed rulings handled |
| 4.14 | Create ruling differ | `apps/scrapers/src/court/parsers/rulingDiff.ts` | Detect changes between rulings |
| 4.15 | Add ruling metadata | `apps/scrapers/src/court/parsers/rulingParser.ts` | scrapedAt, sourceUrl stored |

---

## Action 5: Case Tracking & Monitoring System (Confidence: 82%)

**Research Date**: 2025-12-28
**Documentation Validated**: Yes - Cloudflare Workflows

### Why This Matters
- Monitors cases for updates
- Scheduled scraping per case
- Detects new rulings/filings
- Core feature for users

### Success Criteria
- [ ] Cases tracked in database
- [ ] Scheduled checks run automatically
- [ ] Changes detected and logged
- [ ] Update history maintained
- [ ] Workflow handles failures

### Atomic Subtasks

| # | Task | Files (≤5) | Success Criteria |
|---|------|------------|------------------|
| 5.1 | Create tracking service | `apps/scrapers/src/court/tracking/TrackingService.ts` | `trackCase(caseNumber)` works |
| 5.2 | Define tracking workflow | `apps/scrapers/src/workflows/caseTracking.workflow.ts` | Durable workflow defined |
| 5.3 | Schedule periodic checks | `apps/scrapers/wrangler.toml` | Cron trigger every 4 hours |
| 5.4 | Create change detector | `apps/scrapers/src/court/tracking/changeDetector.ts` | Compares snapshots |
| 5.5 | Store case snapshots | `apps/scrapers/src/court/tracking/snapshot.ts` | Snapshots in R2 |
| 5.6 | Create update log | `apps/scrapers/src/court/tracking/updateLog.ts` | Changes logged to DB |
| 5.7 | Handle new rulings | `apps/scrapers/src/court/tracking/handlers.ts` | New ruling triggers alert |
| 5.8 | Handle new filings | `apps/scrapers/src/court/tracking/handlers.ts` | New filing triggers alert |
| 5.9 | Handle calendar changes | `apps/scrapers/src/court/tracking/handlers.ts` | Date changes detected |
| 5.10 | Create tracking API | `apps/scrapers/src/routes/tracking.router.ts` | REST endpoints for tracking |
| 5.11 | Add tracking metrics | `apps/scrapers/src/court/tracking/metrics.ts` | Track success/failure rates |
| 5.12 | Handle rate limits | `apps/scrapers/src/court/tracking/TrackingService.ts` | Respects 1 req/min |
| 5.13 | Create priority queue | `apps/scrapers/src/court/tracking/queue.ts` | High-priority cases first |
| 5.14 | Add retry logic | `apps/scrapers/src/court/tracking/retry.ts` | Failed checks retried |
| 5.15 | Create tracking tests | `apps/scrapers/test/court/tracking.spec.ts` | Workflow tests pass |

---

## Action 6: User Case Management (Confidence: 80%)

**Research Date**: 2025-12-28
**Documentation Validated**: Yes

### Why This Matters
- Users add their cases to track
- Personal dashboard of cases
- Foundation for SaaS model
- Enables user-specific alerts

### Success Criteria
- [ ] Users can add cases by number
- [ ] Cases validated before adding
- [ ] Dashboard shows tracked cases
- [ ] Users can remove cases
- [ ] Case updates visible per user

### Atomic Subtasks

| # | Task | Files (≤5) | Success Criteria |
|---|------|------------|------------------|
| 6.1 | Create user cases table | `packages/database/src/schema.ts` | $userCases with userId, caseId |
| 6.2 | Create add case endpoint | `apps/scrapers/src/routes/userCases.router.ts` | POST /cases works |
| 6.3 | Validate case exists | `apps/scrapers/src/court/validation.ts` | Case verified in court system |
| 6.4 | Create remove case endpoint | `apps/scrapers/src/routes/userCases.router.ts` | DELETE /cases/:id works |
| 6.5 | Create list cases endpoint | `apps/scrapers/src/routes/userCases.router.ts` | GET /cases returns user's cases |
| 6.6 | Create case detail endpoint | `apps/scrapers/src/routes/userCases.router.ts` | GET /cases/:id with full detail |
| 6.7 | Add case to tracking | `apps/scrapers/src/court/userCases.ts` | Auto-adds to tracking workflow |
| 6.8 | Create dashboard page | `apps/frontend/src/pages/cases/index.vue` | Lists user's cases |
| 6.9 | Create case detail page | `apps/frontend/src/pages/cases/[id].vue` | Shows case details |
| 6.10 | Create add case form | `apps/frontend/src/components/AddCaseForm.vue` | Form validates input |
| 6.11 | Show case timeline | `apps/frontend/src/components/CaseTimeline.vue` | Events shown chronologically |
| 6.12 | Add case notes | `packages/database/src/schema.ts` | $caseNotes for user notes |
| 6.13 | Create notes UI | `apps/frontend/src/components/CaseNotes.vue` | Notes CRUD works |
| 6.14 | Add case sharing | `apps/scrapers/src/routes/userCases.router.ts` | Share case with other users |
| 6.15 | Create usage limits | `apps/scrapers/src/court/limits.ts` | Free tier: 5 cases max |

---

## Action 7: Court Document Storage (R2) (Confidence: 90%)

**Research Date**: 2025-12-28
**Documentation Validated**: Yes - [Cloudflare R2](https://developers.cloudflare.com/r2/)

### Why This Matters
- Store court documents permanently
- PDF/image storage
- Versioning for changes
- Fast retrieval

### Success Criteria
- [ ] R2 bucket configured
- [ ] Documents uploaded with metadata
- [ ] Documents retrievable by case
- [ ] Versioning works
- [ ] Cleanup policy enforced

### Atomic Subtasks

| # | Task | Files (≤5) | Success Criteria |
|---|------|------------|------------------|
| 7.1 | Configure R2 bucket | `apps/scrapers/wrangler.toml` | COURT_DOCS bucket bound |
| 7.2 | Create document storage class | `apps/scrapers/src/court/storage/DocumentStorage.ts` | Upload/download works |
| 7.3 | Generate storage keys | `apps/scrapers/src/court/storage/keys.ts` | Consistent key format |
| 7.4 | Store document metadata | `apps/scrapers/src/court/storage/metadata.ts` | Metadata in custom headers |
| 7.5 | Create document download | `apps/scrapers/src/court/storage/DocumentStorage.ts` | `getDocument(id)` works |
| 7.6 | Add versioning | `apps/scrapers/src/court/storage/versioning.ts` | Multiple versions stored |
| 7.7 | Create document listing | `apps/scrapers/src/court/storage/DocumentStorage.ts` | `listDocuments(caseId)` works |
| 7.8 | Add OCR integration | `apps/scrapers/src/court/storage/ocr.ts` | PDF text extracted |
| 7.9 | Create presigned URLs | `apps/scrapers/src/court/storage/presign.ts` | Secure download links |
| 7.10 | Add document API | `apps/scrapers/src/routes/documents.router.ts` | REST endpoints work |
| 7.11 | Create viewer component | `apps/frontend/src/components/DocumentViewer.vue` | PDF viewer works |
| 7.12 | Add lifecycle rules | `apps/scrapers/src/court/storage/lifecycle.ts` | Old versions cleaned up |
| 7.13 | Track storage usage | `apps/scrapers/src/court/storage/usage.ts` | Usage per user tracked |
| 7.14 | Create storage tests | `apps/scrapers/test/court/storage.spec.ts` | Upload/download tests pass |
| 7.15 | Add compression | `apps/scrapers/src/court/storage/compression.ts` | Large docs compressed |

---

## Action 8: Case Update Alert System (Confidence: 78%)

**Research Date**: 2025-12-28
**Documentation Validated**: Yes - Existing alerts infrastructure

### Why This Matters
- Real-time notifications for case changes
- Email, push, webhook support
- Critical for legal professionals
- Differentiator from competitors

### Success Criteria
- [ ] Alerts triggered on case changes
- [ ] Email notifications sent
- [ ] Push notifications work
- [ ] Webhook delivery works
- [ ] Alert preferences configurable

### Atomic Subtasks

| # | Task | Files (≤5) | Success Criteria |
|---|------|------------|------------------|
| 8.1 | Create court alert types | `apps/scrapers/src/court/alerts/types.ts` | Alert types defined |
| 8.2 | Create alert service | `apps/scrapers/src/court/alerts/AlertService.ts` | `sendAlert(caseId, type)` works |
| 8.3 | Integrate with tracking | `apps/scrapers/src/court/tracking/handlers.ts` | Changes trigger alerts |
| 8.4 | Create email templates | `apps/scrapers/src/court/alerts/templates/` | Ruling, filing, hearing templates |
| 8.5 | Send email alerts | `apps/scrapers/src/court/alerts/email.ts` | Emails delivered |
| 8.6 | Send push alerts | `apps/scrapers/src/court/alerts/push.ts` | Push notifications work |
| 8.7 | Send webhook alerts | `apps/scrapers/src/court/alerts/webhook.ts` | Webhooks delivered |
| 8.8 | Create alert preferences | `packages/database/src/schema.ts` | $alertPreferences table |
| 8.9 | Create preferences API | `apps/scrapers/src/routes/alerts.router.ts` | CRUD for preferences |
| 8.10 | Create preferences UI | `apps/frontend/src/pages/settings/alerts.vue` | Preferences configurable |
| 8.11 | Add alert history | `packages/database/src/schema.ts` | $alertHistory table |
| 8.12 | Create history API | `apps/scrapers/src/routes/alerts.router.ts` | GET /alerts/history works |
| 8.13 | Add quiet hours | `apps/scrapers/src/court/alerts/quietHours.ts` | No alerts during quiet hours |
| 8.14 | Create alert batching | `apps/scrapers/src/court/alerts/batching.ts` | Batch multiple alerts |
| 8.15 | Add alert tests | `apps/scrapers/test/court/alerts.spec.ts` | Alert flow tests pass |

---

## Action 9: Court Data Search Infrastructure (Confidence: 85%)

**Research Date**: 2025-12-28
**Documentation Validated**: Yes - PostgreSQL FTS

### Why This Matters
- Search across all court data
- Party name search
- Case number search
- Ruling text search

### Success Criteria
- [ ] Full-text search on rulings
- [ ] Party name search works
- [ ] Case number autocomplete
- [ ] Search results ranked
- [ ] Search UI functional

### Atomic Subtasks

| # | Task | Files (≤5) | Success Criteria |
|---|------|------------|------------------|
| 9.1 | Add tsvector to rulings | `packages/database/src/schema.ts` | searchVector column |
| 9.2 | Add tsvector to parties | `packages/database/src/schema.ts` | searchVector column |
| 9.3 | Create GIN indexes | `packages/database/migrations/` | Indexes created |
| 9.4 | Create search service | `apps/scrapers/src/court/search/SearchService.ts` | Multi-entity search |
| 9.5 | Create ruling search | `apps/scrapers/src/court/search/rulingSearch.ts` | `searchRulings(query)` works |
| 9.6 | Create party search | `apps/scrapers/src/court/search/partySearch.ts` | `searchParties(query)` works |
| 9.7 | Create case search | `apps/scrapers/src/court/search/caseSearch.ts` | `searchCases(query)` works |
| 9.8 | Add search ranking | `apps/scrapers/src/court/search/ranking.ts` | Relevance scoring |
| 9.9 | Create search API | `apps/scrapers/src/routes/search.router.ts` | GET /search works |
| 9.10 | Create search UI | `apps/frontend/src/pages/search.vue` | Search page works |
| 9.11 | Add autocomplete | `apps/frontend/src/components/SearchAutocomplete.vue` | Suggestions shown |
| 9.12 | Add faceted search | `apps/scrapers/src/court/search/facets.ts` | Filter by court, date, type |
| 9.13 | Create search filters | `apps/frontend/src/components/SearchFilters.vue` | Filters work |
| 9.14 | Add search analytics | `apps/scrapers/src/court/search/analytics.ts` | Popular searches tracked |
| 9.15 | Create search tests | `apps/scrapers/test/court/search.spec.ts` | Search tests pass |

---

## Action 10: Public Court Data API (Confidence: 75%)

**Research Date**: 2025-12-28
**Documentation Validated**: Yes - Existing OpenAPI infrastructure

### Why This Matters
- Enables third-party integrations
- Foundation for B2B revenue
- API-first architecture
- Competitor to UniCourt API

### Success Criteria
- [ ] REST API for court data
- [ ] API key authentication
- [ ] Rate limiting per tier
- [ ] OpenAPI documentation
- [ ] SDK/client libraries

### Atomic Subtasks

| # | Task | Files (≤5) | Success Criteria |
|---|------|------------|------------------|
| 10.1 | Create court API router | `apps/scrapers/src/routes/courtApi.router.ts` | Base router configured |
| 10.2 | Add case lookup endpoint | `apps/scrapers/src/routes/courtApi.router.ts` | GET /api/cases/:id works |
| 10.3 | Add case search endpoint | `apps/scrapers/src/routes/courtApi.router.ts` | GET /api/cases/search works |
| 10.4 | Add rulings endpoint | `apps/scrapers/src/routes/courtApi.router.ts` | GET /api/rulings works |
| 10.5 | Add parties endpoint | `apps/scrapers/src/routes/courtApi.router.ts` | GET /api/parties works |
| 10.6 | Add documents endpoint | `apps/scrapers/src/routes/courtApi.router.ts` | GET /api/documents works |
| 10.7 | Create API key system | `apps/scrapers/src/court/api/apiKeys.ts` | Keys generated/validated |
| 10.8 | Add API key table | `packages/database/src/schema.ts` | $apiKeys table |
| 10.9 | Create key management UI | `apps/frontend/src/pages/settings/api-keys.vue` | Keys manageable |
| 10.10 | Add rate limiting | `apps/scrapers/src/court/api/rateLimit.ts` | Per-key limits |
| 10.11 | Create usage tracking | `apps/scrapers/src/court/api/usage.ts` | Usage per key tracked |
| 10.12 | Update OpenAPI spec | `apps/scrapers/src/lib/openapi.ts` | Court endpoints documented |
| 10.13 | Create JS SDK | `packages/court-sdk/src/index.ts` | TypeScript SDK works |
| 10.14 | Add SDK to npm | `packages/court-sdk/package.json` | Ready to publish |
| 10.15 | Create API tests | `apps/scrapers/test/court/api.spec.ts` | API tests pass |
| 10.16 | Add webhook for updates | `apps/scrapers/src/court/api/webhooks.ts` | Webhook subscriptions work |

---

## Cognitive Empathy Analysis

### Legal Professional Perspective
- **Wants**: Real-time case alerts, tentative rulings before 3pm, document access
- **Pain Points**: Manual court website checking, missing deadlines, Cloudflare blocks
- **Priorities**: Action 2 (Scraper), Action 4 (Rulings), Action 8 (Alerts)

### Developer/Integrator Perspective
- **Wants**: Clean API, SDKs, webhook integrations
- **Pain Points**: No court APIs exist, data is locked in websites
- **Priorities**: Action 10 (Public API), Action 9 (Search)

### Operations Perspective
- **Wants**: Reliable scraping, monitoring, scaling
- **Pain Points**: Cloudflare blocks, rate limiting, data freshness
- **Priorities**: Action 1 (Crawlee), Action 5 (Tracking), Action 7 (Storage)

---

## Sources (Verified December 28, 2025)

- [Crawlee 3.15.3](https://www.npmjs.com/package/crawlee) - Web scraping framework
- [Camoufox-js](https://www.npmjs.com/package/camoufox-js) - Stealth Firefox for Cloudflare bypass
- [Apify Client](https://docs.apify.com/api/client/js) - Apify API integration
- [SF Courts Online Services](https://sf.courts.ca.gov/online-services) - Target website
- [SF Court Tentative Rulings](https://sf.courts.ca.gov/online-services/tentative-rulings) - Rulings page
- [SF Court Case Information](https://sf.courts.ca.gov/online-services/case-information) - Case lookup
- [Cloudflare Bypass Guide](https://blog.apify.com/bypass-cloudflare/) - Bypass techniques
- [Drizzle ORM](https://orm.drizzle.team/) - Database ORM
- [Cloudflare R2](https://developers.cloudflare.com/r2/) - Object storage
- [PlaywrightCrawler API](https://crawlee.dev/js/api/next/playwright-crawler/class/PlaywrightCrawler) - Crawler docs
