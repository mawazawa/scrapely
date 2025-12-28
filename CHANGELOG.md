# Meridian Changelog

All notable changes to the Meridian project are documented here with ISO 8601 timestamps.

---

## [2025-12-28T18:00:00Z] Court Data Platform - Phase 2 Complete (All 10 Actions)

### Changes Made
- **Court Document Storage (R2)**: Full document storage with versioning, OCR, compression, presigned URLs
- **Case Update Alert System**: Multi-channel alerts (email, push, webhook) with batching and quiet hours
- **Court Data Search**: PostgreSQL full-text search across cases, rulings, parties, documents
- **Public Court Data API**: RESTful API with API key auth, rate limiting, tier-based permissions

### Files Created

**Document Storage:**
- `apps/scrapers/src/court/storage/DocumentStorage.ts` - Main storage service
- `apps/scrapers/src/court/storage/keys.ts` - Storage key generation
- `apps/scrapers/src/court/storage/metadata.ts` - Document metadata handling
- `apps/scrapers/src/court/storage/versioning.ts` - Version management
- `apps/scrapers/src/court/storage/compression.ts` - Gzip compression
- `apps/scrapers/src/court/storage/ocr.ts` - OCR integration
- `apps/scrapers/src/court/storage/presign.ts` - Presigned URL generation
- `apps/scrapers/src/court/storage/lifecycle.ts` - Lifecycle rules
- `apps/scrapers/src/court/storage/usage.ts` - Usage tracking
- `apps/scrapers/src/routes/documents.router.ts` - Document REST API

**Alert System:**
- `apps/scrapers/src/court/alerts/AlertService.ts` - Main alert service
- `apps/scrapers/src/court/alerts/types.ts` - Alert type definitions
- `apps/scrapers/src/court/alerts/quietHours.ts` - Quiet hours management
- `apps/scrapers/src/court/alerts/batching.ts` - Alert batching/digest
- `apps/scrapers/src/court/alerts/email.ts` - Email delivery
- `apps/scrapers/src/court/alerts/push.ts` - Push notifications
- `apps/scrapers/src/court/alerts/webhook.ts` - Webhook delivery
- `apps/scrapers/src/court/alerts/templates/email.ts` - Email templates
- `apps/scrapers/src/routes/alerts.router.ts` - Alerts REST API

**Search Infrastructure:**
- `apps/scrapers/src/court/search/SearchService.ts` - Unified search service
- `apps/scrapers/src/routes/search.router.ts` - Search REST API

**Public API:**
- `apps/scrapers/src/court/api/apiKeys.ts` - API key management
- `apps/scrapers/src/court/api/rateLimit.ts` - Rate limiting
- `apps/scrapers/src/routes/courtApi.router.ts` - Public API endpoints

**Frontend:**
- `apps/frontend/src/components/DocumentViewer.vue` - PDF viewer with OCR

### Files Modified
- `apps/scrapers/wrangler.toml` - Added R2 bucket and KV namespace bindings
- `apps/scrapers/src/court/index.ts` - Added storage, alerts, search, api exports

### Confidence Scores
- Document Storage: 90%
- Alert System: 78%
- Search Infrastructure: 85%
- Public API: 75%

---

## [2025-12-28T12:00:00Z] Court Data Platform - Phase 1 Implementation

### Changes Made
- **Apify + Crawlee Integration**: Full Crawlee 3.15.3 integration with Camoufox for Cloudflare bypass
- **SF Court Scraper**: Complete scraper for SF Superior Court with case lookup, tentative rulings, calendar
- **Court Data Schema**: 12 new database tables for courts, cases, parties, attorneys, rulings, documents
- **Session Management**: Persistent session handling with KV storage for Cloudflare cookies
- **Rate Limiting**: Court-specific rate limiting (1 req/min for SF Court)
- **Health Monitoring**: Comprehensive health checks for scraper status

### Files Created
**Court Infrastructure:**
- `apps/scrapers/src/court/types.ts` - Type definitions for court data
- `apps/scrapers/src/court/errors.ts` - Custom error classes with codes
- `apps/scrapers/src/court/crawlee.config.ts` - Crawlee configuration
- `apps/scrapers/src/court/camoufox.ts` - Stealth Firefox browser launcher
- `apps/scrapers/src/court/cloudflare.ts` - Cloudflare challenge handler
- `apps/scrapers/src/court/apifyClient.ts` - Apify API wrapper
- `apps/scrapers/src/court/proxy.ts` - Residential proxy management
- `apps/scrapers/src/court/rateLimit.ts` - Court-specific rate limiting
- `apps/scrapers/src/court/BaseCrawler.ts` - Abstract base crawler class
- `apps/scrapers/src/court/CrawlerFactory.ts` - Crawler factory pattern
- `apps/scrapers/src/court/index.ts` - Module exports

**SF Court Scraper:**
- `apps/scrapers/src/court/sfCourt/SFCourtScraper.ts` - Main SF Court scraper
- `apps/scrapers/src/court/sfCourt/urls.ts` - SF Court URL endpoints
- `apps/scrapers/src/court/sfCourt/selectors.ts` - CSS selectors for parsing
- `apps/scrapers/src/court/sfCourt/caseNumber.ts` - Case number validation
- `apps/scrapers/src/court/sfCourt/tentativeRulings.ts` - Ruling parser
- `apps/scrapers/src/court/sfCourt/session.ts` - Session management
- `apps/scrapers/src/court/sfCourt/health.ts` - Health checks
- `apps/scrapers/src/court/sfCourt/index.ts` - SF Court exports

**Database:**
- `packages/database/src/queries/court.ts` - Court data query helpers

**Tests:**
- `apps/scrapers/test/court/cloudflare.spec.ts` - Cloudflare bypass tests

**Configuration:**
- `apps/scrapers/.dev.vars.example` - Environment variable documentation

### Files Modified
- `apps/scrapers/package.json` - Added Crawlee, Camoufox, Apify dependencies
- `packages/database/src/schema.ts` - Added 12 court data tables

### Database Tables Added
- `courts` - Registry of supported courts
- `cases` - Court case records
- `case_parties` - Plaintiffs, defendants, etc.
- `attorneys` - Attorney records
- `case_attorneys` - Case-attorney relationships
- `rulings` - Tentative and final rulings
- `case_documents` - Filed documents
- `case_events` - Calendar events and hearings
- `case_tracking` - User case tracking
- `case_snapshots` - Change detection snapshots
- `case_notes` - User annotations
- `court_alert_history` - Alert delivery history
- `court_api_keys` - API key management

### Confidence Scores
- Apify + Crawlee Integration: 92%
- SF Court Scraper: 88%
- Court Data Schema: 95%
- Cloudflare Bypass: 85%
- Session Management: 90%
- Rate Limiting: 94%

---

## [2025-12-27T20:00:00Z] Fifth Roadmap Implementation - Enterprise Features

### Changes Made
- **GraphQL API**: Full GraphQL API layer with schema, resolvers, and Yoga server
- **Article Clustering**: HDBSCAN-based clustering for brief generation (Python)
- **Source Quality**: Multi-factor quality scoring system for sources
- **R2 Caching**: Cloudflare R2 caching layer with compression and TTL
- **Sentiment Analysis**: AI-powered sentiment analysis with trends and comparisons
- **Breaking Alerts**: Real-time breaking news alert system with multi-channel delivery
- **Multi-tenant**: Full multi-tenant support with plans, limits, and isolation
- **Article Archive**: R2-based long-term article archive with tiered storage
- **Report Builder**: Custom report builder with templates and sections
- **Webhooks**: Outgoing webhook integrations with retry and signatures

### Files Created
- `apps/scrapers/src/graphql/schema.ts` - GraphQL type definitions
- `apps/scrapers/src/graphql/resolvers.ts` - GraphQL resolvers
- `apps/scrapers/src/graphql/server.ts` - GraphQL Yoga server
- `apps/briefs/src/clustering.py` - HDBSCAN article clustering
- `apps/scrapers/src/lib/sourceQuality.ts` - Source quality scoring
- `apps/scrapers/src/lib/r2Cache.ts` - R2 caching layer
- `apps/scrapers/src/lib/sentiment.ts` - Sentiment analysis
- `apps/scrapers/src/lib/alerts.ts` - Breaking news alerts
- `apps/scrapers/src/lib/multiTenant.ts` - Multi-tenant support
- `apps/scrapers/src/lib/archive.ts` - Article archive
- `apps/scrapers/src/lib/reportBuilder.ts` - Custom report builder
- `apps/scrapers/src/lib/webhooks.ts` - Webhook integrations

### Confidence Scores
- GraphQL API: 88%
- Article Clustering: 86%
- Source Quality: 84%
- R2 Caching: 82%
- Sentiment Analysis: 80%
- Breaking Alerts: 78%
- Multi-tenant: 76%
- Article Archive: 74%
- Report Builder: 72%
- Webhooks: 70%

---

## [2025-12-27T18:00:00Z] Fourth Roadmap Implementation - Production Features

### Changes Made
- **OpenAPI**: Created OpenAPI 3.1 specification with Swagger UI for API documentation
- **Rate Limiting**: Implemented sliding window rate limiting with per-user tiers
- **Batch Processing**: Added batch article processing with Cloudflare Queues support
- **Admin API**: Created comprehensive admin router for source management
- **Scheduling**: Implemented brief scheduling composable with cron support
- **Export**: Added PDF/HTML/Markdown/Email export functionality
- **PWA**: Created mobile-optimized Progressive Web App configuration
- **A/B Testing**: Implemented feature flags and experiment framework

### Files Created
- `apps/scrapers/src/lib/openapi.ts` - OpenAPI 3.1 specification
- `apps/scrapers/src/lib/rateLimit.ts` - Sliding window rate limiting
- `apps/scrapers/src/lib/batchProcessor.ts` - Batch article processing
- `apps/scrapers/src/lib/export.ts` - Multi-format export
- `apps/scrapers/src/lib/experiments.ts` - A/B testing framework
- `apps/scrapers/src/routes/admin.router.ts` - Admin API router
- `apps/frontend/src/composables/useScheduler.ts` - Scheduling composable
- `apps/frontend/src/pwa.config.ts` - PWA configuration

### Files Modified
- `packages/database/src/schema.ts` - Added tables for experiments, schedules, versions

### Confidence Scores
- OpenAPI Documentation: 91%
- Rate Limiting: 92%
- Batch Processing: 86%
- Admin API: 85%
- Brief Scheduling: 83%
- Export Functionality: 80%
- PWA Configuration: 78%
- A/B Testing: 75%

---

## [2025-12-27T16:00:00Z] Third Roadmap Implementation - Advanced Features

### Changes Made
- **Agents SDK**: Implemented Cloudflare Agents SDK with ArticleAgent for agentic processing
- **Source Health**: Added source health monitoring with success rate tracking
- **Deduplication**: Implemented SimHash-based article deduplication
- **User Preferences**: Added user preferences with topic/region filtering
- **Content Moderation**: Created AI-powered content moderation pipeline
- **Semantic Search**: Implemented vector-based search with Vectorize support
- **Version History**: Added brief version history with diff tracking
- **Feed Discovery**: Created RSS feed autodiscovery from URLs and topics
- **Push Notifications**: Implemented Web Push notifications with VAPID

### Files Created
- `apps/scrapers/src/agents/ArticleAgent.ts` - Article processing agent
- `apps/scrapers/src/agents/state.ts` - Agent state management
- `apps/scrapers/src/agents/approval.ts` - Human-in-loop approval
- `apps/scrapers/src/lib/sourceHealth.ts` - Source health monitoring
- `apps/scrapers/src/lib/dedup.ts` - SimHash deduplication
- `apps/scrapers/src/lib/preferences.ts` - User preferences
- `apps/scrapers/src/lib/moderation.ts` - Content moderation
- `apps/scrapers/src/lib/search.ts` - Semantic search
- `apps/scrapers/src/lib/versionHistory.ts` - Brief versions
- `apps/scrapers/src/lib/feedDiscovery.ts` - RSS discovery
- `apps/scrapers/src/lib/webPush.ts` - Push notifications
- `apps/scrapers/test/lib/dedup.spec.ts` - Deduplication tests
- `apps/scrapers/test/lib/sourceHealth.spec.ts` - Health tests

### Confidence Scores
- Cloudflare Agents SDK: 87%
- Source Health Monitoring: 90%
- Article Deduplication: 88%
- User Preferences: 82%
- Content Moderation: 84%
- Semantic Search: 85%
- Version History: 83%
- Feed Discovery: 79%
- Push Notifications: 76%

---

## [2025-12-27T14:00:00Z] Second Roadmap Implementation - Infrastructure & UX

### Changes Made
- **Tracing**: Added OpenTelemetry tracing utilities for observability
- **Caching**: Implemented KV caching layer with TTL support
- **Newsletter**: Created newsletter workflow for daily brief delivery
- **WebSocket**: Added real-time updates via Durable Objects
- **Analytics**: Created time-series analytics endpoint and chart components
- **E2E Testing**: Added Playwright configuration and test suites
- **i18n**: Implemented multi-language support (EN, ES, FR)

### Files Created
- `apps/scrapers/src/lib/tracing.ts` - OpenTelemetry utilities
- `apps/scrapers/src/lib/cache.ts` - KV caching with TTL
- `apps/scrapers/src/workflows/newsletter.workflow.ts` - Newsletter delivery
- `apps/scrapers/src/durable/StatsRoom.ts` - WebSocket Durable Object
- `apps/scrapers/test/lib/tracing.spec.ts` - Tracing tests
- `apps/scrapers/test/lib/cache.spec.ts` - Cache tests
- `apps/frontend/src/composables/useWebSocket.ts` - WebSocket composable
- `apps/frontend/src/server/api/analytics/timeseries.get.ts` - Analytics API
- `apps/frontend/src/components/charts/ArticleChart.vue` - Article chart
- `apps/frontend/src/components/charts/SourcePerformanceChart.vue` - Source chart
- `apps/frontend/src/components/ConnectionStatus.vue` - Connection indicator
- `apps/frontend/src/components/LanguageSwitcher.vue` - Language selector
- `apps/frontend/playwright.config.ts` - Playwright configuration
- `apps/frontend/e2e/home.spec.ts` - Home page tests
- `apps/frontend/e2e/admin.spec.ts` - Admin dashboard tests
- `apps/frontend/e2e/briefs.spec.ts` - Briefs page tests
- `apps/frontend/src/locales/en.json` - English translations
- `apps/frontend/src/locales/es.json` - Spanish translations
- `apps/frontend/src/locales/fr.json` - French translations

### Files Modified
- `apps/scrapers/wrangler.toml` - Added KV, newsletter workflow, DO bindings
- `apps/scrapers/src/index.ts` - Added CACHE_KV, STATS_ROOM, newsletter cron
- `apps/frontend/package.json` - Added chart.js, i18n, Playwright
- `apps/frontend/nuxt.config.ts` - Added i18n configuration

### Confidence Scores
- OpenTelemetry Tracing: 94%
- KV Caching Layer: 89%
- Newsletter Workflow: 88%
- WebSocket Updates: 85%
- Analytics Dashboard: 86%
- E2E Testing: 93%
- Multi-language Support: 80%

---

## [2025-12-27T12:00:00Z] Initial Roadmap Implementation

### Changes Made
- **Feature**: Implemented 10 high-leverage actions from ROADMAP.md
- **Security**: Added XSS protection, rate limiting, security headers
- **CI/CD**: Enhanced pipeline with quality checks, tests, audit
- **Logging**: Added structured JSON logging with trace IDs
- **Testing**: Created test infrastructure with mocks and fixtures
- **Email**: Added newsletter email utility with Resend integration
- **API Docs**: Created Zod schemas for OpenAPI documentation
- **Continuity**: Added brief continuity tracking for story arcs

### Files Created
- `apps/scrapers/src/lib/security.ts` - Security utilities
- `apps/scrapers/src/lib/errors.ts` - Typed error handling
- `apps/scrapers/src/lib/logger.ts` - Structured logging
- `apps/scrapers/src/lib/email.ts` - Email integration
- `apps/scrapers/src/schemas/api.schema.ts` - API schemas
- `apps/scrapers/test/setup.ts` - Test setup
- `apps/scrapers/test/lib/security.spec.ts` - Security tests
- `apps/scrapers/test/lib/errors.spec.ts` - Error tests
- `packages/database/test/setup.ts` - DB test setup
- `apps/briefs/src/continuity.py` - Brief continuity
- `docs/SECURITY.md` - Security documentation

### Files Modified
- `.github/workflows/deploy-services.yaml` - Enhanced CI/CD
- `apps/scrapers/src/app.ts` - Security middleware
- `apps/scrapers/src/routers/openGraph.router.ts` - XSS fix
- `apps/scrapers/src/index.ts` - New env vars
- `apps/frontend/nuxt.config.ts` - Security headers
- `apps/frontend/src/server/api/subscribe.post.ts` - Email validation
- `apps/frontend/src/server/api/stats.get.ts` - Parameterized SQL

### Confidence Scores
- Security Implementation: 96%
- CI/CD Enhancement: 94%
- Error Handling: 92%
- Logging: 90%
- Testing Infrastructure: 88%
- API Documentation: 93%
- Newsletter: 85%
- Continuity Tracking: 82%

---

## [2025-12-27T11:00:00Z] Dependency Updates & Documentation

### Changes Made
- **Deps**: Updated all dependencies to December 2025 latest
- **Docs**: Created comprehensive ROADMAP.md with 100 atomic tasks
- **AI**: Added Gemini 3 PDF processing as Mistral OCR fallback

### Files Created
- `ROADMAP.md` - 10 high-leverage actions with subtasks

### Files Modified
- `package.json` - Turborepo 2.7.2, Prettier 3.7.4
- `apps/scrapers/package.json` - AI SDK 6.0.3, Hono 4.11.3
- `apps/frontend/package.json` - Nuxt 4.2.2, Vue 3.5.18
- `packages/database/package.json` - Drizzle ORM 0.45.1
- `apps/scrapers/src/lib/documentOcr.ts` - Gemini 3 support
- `apps/scrapers/src/workflows/processArticles.workflow.ts` - Multi-provider OCR

### Confidence Scores
- Dependency Updates: 92%
- Gemini 3 PDF Support: 95%
- Roadmap Accuracy: 90%

---

## [2025-12-27T10:00:00Z] AI Model Upgrades

### Changes Made
- **AI Models**: Upgraded to December 2025 cutting-edge models
- **Frontend**: Created beautiful admin dashboard at /admin
- **Stats API**: Added dashboard statistics endpoint

### Files Created
- `apps/scrapers/src/lib/models.ts` - AI model configuration
- `apps/scrapers/src/lib/firecrawl.ts` - Firecrawl Agent integration
- `apps/scrapers/src/lib/documentOcr.ts` - Document OCR
- `apps/frontend/src/pages/admin/index.vue` - Admin dashboard
- `apps/frontend/src/server/api/stats.get.ts` - Stats API

### Confidence Scores
- Model Configuration: 95%
- Firecrawl Integration: 88%
- Admin Dashboard: 93%

---

## [2025-12-27T09:00:00Z] Initial CLAUDE.md Creation

### Changes Made
- **Docs**: Created comprehensive CLAUDE.md for AI assistant guidance
- **Structure**: Documented repository structure and tech stack

### Files Created
- `CLAUDE.md` - AI assistant guide

### Confidence Scores
- Documentation Accuracy: 95%
