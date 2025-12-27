# Meridian TODO: Next 10 Highest Leverage Actions

> **Last Updated**: 2025-12-27T16:00:00Z
> **Research Validated**: December 27, 2025
> **Previous Actions Completed**: 29 (see CHANGELOG.md)

---

## Recently Completed (This Session)

| # | Action | Confidence | Status |
|---|--------|------------|--------|
| 1 | Implement Cloudflare Agents SDK | 87% | ✅ Completed |
| 2 | Add Source Health Monitoring | 90% | ✅ Completed |
| 3 | Implement Article Deduplication | 88% | ✅ Completed |
| 4 | Implement User Preferences | 82% | ✅ Completed |
| 5 | Add Content Moderation Pipeline | 84% | ✅ Completed |
| 6 | Add Semantic Search | 85% | ✅ Completed |
| 7 | Implement Brief Version History | 83% | ✅ Completed |
| 8 | Add RSS Feed Discovery | 79% | ✅ Completed |
| 9 | Implement Push Notifications | 76% | ✅ Completed |

---

## Next 10 High-Leverage Actions

| # | Action | Confidence | Impact | Effort | Status |
|---|--------|------------|--------|--------|--------|
| 1 | Upgrade to Vitest 4 Browser Mode | 91% | Medium | 1 day | Pending |
| 2 | Add Database Migrations for New Features | 92% | High | 1 day | Pending |
| 3 | Create API Documentation with OpenAPI | 88% | Medium | 1-2 days | Pending |
| 4 | Implement Rate Limiting per User | 90% | High | 1 day | Pending |
| 5 | Add Batch Article Processing | 86% | High | 1-2 days | Pending |
| 6 | Create Admin API for Source Management | 85% | Medium | 1-2 days | Pending |
| 7 | Implement Brief Scheduling UI | 83% | Medium | 2 days | Pending |
| 8 | Add Export Functionality (PDF/Email) | 80% | Medium | 2 days | Pending |
| 9 | Create Mobile-Optimized PWA | 78% | Medium | 2-3 days | Pending |
| 10 | Implement A/B Testing Framework | 75% | Low | 2-3 days | Pending |

---

## Action 1: Upgrade to Vitest 4 Browser Mode (Confidence: 91%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - [Vitest 4.0 Release](https://vitest.dev/)

### Why This Matters
- Browser Mode now stable (was experimental)
- Visual regression testing built-in
- Playwright Traces integration
- 2-5x faster than traditional frameworks

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 1.1 | Upgrade vitest to v4 | `apps/scrapers/package.json` | Update to vitest@^4.0.0 |
| 1.2 | Install browser provider | `apps/scrapers/package.json` | Add @vitest/browser-playwright |
| 1.3 | Configure browser mode | `apps/scrapers/vitest.config.ts` | Enable browser testing |
| 1.4 | Add visual regression test | `apps/scrapers/test/visual/` | Test OG images |
| 1.5 | Configure screenshot baseline | `apps/scrapers/vitest.config.ts` | Snapshot dir |

---

## Action 2: Add Database Migrations for New Features (Confidence: 92%)

**Research Date**: 2025-12-27
**Documentation Validated**: Yes - Drizzle ORM docs

### Why This Matters
- New features require schema changes
- Source health needs tracking columns
- User preferences need storage
- Content moderation needs flags

### Atomic Subtasks

| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 2.1 | Add source health columns | `packages/database/src/schema.ts` | successRate, failureCount |
| 2.2 | Add user preferences table | `packages/database/src/schema.ts` | $userPreferences |
| 2.3 | Add content hash column | `packages/database/src/schema.ts` | For deduplication |
| 2.4 | Add moderation columns | `packages/database/src/schema.ts` | flagged, moderationStatus |
| 2.5 | Generate migrations | `packages/database/migrations/` | drizzle-kit generate |

---

## Cognitive Empathy Analysis

### User Perspective
- **Wants**: Mobile access, offline reading, PDF exports
- **Pain Points**: Desktop-only, no offline, can't share
- **Priorities**: Action 8 (Export), Action 9 (PWA)

### Developer Perspective
- **Wants**: API docs, better testing, type safety
- **Pain Points**: No docs, limited testing
- **Priorities**: Action 1 (Vitest 4), Action 3 (OpenAPI)

### Operations Perspective
- **Wants**: Rate limiting, queue management, monitoring
- **Pain Points**: No quotas, sequential processing
- **Priorities**: Action 4 (Rate Limiting), Action 5 (Queues)

---

## Sources

- [Vitest 4.0](https://vitest.dev/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [OpenAPI 3.1](https://swagger.io/specification/)
- [Cloudflare Queues](https://developers.cloudflare.com/queues/)
- [Nuxt PWA](https://vite-pwa-org.netlify.app/frameworks/nuxt)
