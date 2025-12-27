# CLAUDE.md - Meridian Codebase Guide

## Project Overview

**Meridian** is an AI-powered news intelligence briefing system that scrapes news sources, analyzes articles with LLMs, clusters related stories, and generates personalized daily intelligence briefs.

Think of it as "presidential-level intelligence briefings, built with AI."

## Repository Structure

```
meridian/
├── apps/
│   ├── briefs/           # Python briefing generation (notebooks + utilities)
│   ├── frontend/         # Nuxt 3 web application
│   └── scrapers/         # Cloudflare Workers for RSS scraping & article processing
├── packages/
│   └── database/         # Drizzle ORM schema & migrations (PostgreSQL)
└── package.json          # Root monorepo config (Turborepo + pnpm)
```

## Tech Stack (December 2025)

| Layer | Technology |
|-------|------------|
| Monorepo | Turborepo + pnpm workspaces |
| Infrastructure | Cloudflare Workers, Workflows, Pages |
| Backend | Hono (TypeScript), Cloudflare Workflows |
| Database | PostgreSQL + Drizzle ORM |
| AI/LLM | See AI Models section below |
| ML Pipeline | Python: UMAP, HDBSCAN, multilingual-e5-small embeddings |
| Frontend | Nuxt 3, Vue 3, Tailwind CSS 4 |

## AI Models (Cutting-Edge Dec 2025)

| Component | Model | Purpose |
|-----------|-------|---------|
| Article Analysis | **Gemini 3 Flash** | Fast classification with thinking levels |
| Brief Synthesis | **GPT-5.2 Thinking** | 80% fewer hallucinations, best reasoning |
| Document OCR | **Mistral OCR 3** | PDF processing at $1-2/1K pages |
| Complex Scraping | **Firecrawl Agent** | AI-powered navigation for paywalled sites |
| Fallback | Claude Sonnet 4.5, Mistral Large 3 | Multi-provider resilience |

### Model Configuration

Located in `apps/scrapers/src/lib/models.ts`:

```typescript
const MODELS = {
  triage: { model: 'gemini-3-flash', thinkingLevel: 'minimal' },
  analysis: { model: 'gemini-3-flash', thinkingLevel: 'low' },
  deep: { model: 'gemini-3-pro', thinkingLevel: 'high' },
  synthesis: { model: 'gpt-5.2', reasoningEffort: 'high' },
};
```

## Key Architecture Components

### 1. RSS Scraping (`apps/scrapers/src/workflows/rssFeed.workflow.ts`)

- **Trigger**: Cron job at minute 4 of every hour
- **Process**: Fetches RSS feeds from sources, parses articles, stores metadata
- **Rate limiting**: Domain-aware with configurable cooldowns
- **Tiered scraping**: Sources have frequency tiers (hourly, 4h, 6h, daily)

### 2. Article Processing (`apps/scrapers/src/workflows/processArticles.workflow.ts`)

Multi-method content extraction pipeline:

1. **PDF Detection** → Mistral OCR 3 for document processing
2. **Firecrawl Agent** → AI scraping for difficult domains (Reuters, NYTimes, WSJ)
3. **Light Fetch** → Standard HTTP fetch with Readability
4. **Browser Rendering** → Puppeteer fallback for JS-heavy sites

Analysis uses Gemini 3 Flash with configurable thinking levels.

### 3. Firecrawl Integration (`apps/scrapers/src/lib/firecrawl.ts`)

AI-powered scraping for complex sites:

```typescript
const FIRECRAWL_DOMAINS = {
  'reuters.com': 'agent',    // Uses /agent endpoint
  'nytimes.com': 'agent',
  'wsj.com': 'agent',
  'ft.com': 'scrape',        // Standard scrape
};
```

### 4. Document OCR (`apps/scrapers/src/lib/documentOcr.ts`)

Mistral OCR 3 for PDF processing:
- 88.9% handwriting accuracy
- 96.6% table extraction
- $1-2 per 1,000 pages

### 5. Brief Generation (`apps/briefs/`)

- **Model**: GPT-5.2 Thinking for synthesis
- **Pipeline**:
  1. Fetch processed articles via API
  2. Generate embeddings (multilingual-e5-small)
  3. Cluster with UMAP + HDBSCAN
  4. LLM review of clusters (Gemini 3 Flash)
  5. Deep analysis per cluster
  6. Final brief synthesis with GPT-5.2 Thinking

### 6. Frontend (`apps/frontend/`)

- **Framework**: Nuxt 3 with SSR/SSG
- **Styling**: Tailwind CSS 4 with typography plugin
- **Admin Dashboard**: `/admin` - Beautiful stats dashboard
- **API**: Server routes for reports and stats

## Database Schema

Located in `packages/database/src/schema.ts`:

```typescript
$sources    // RSS feed sources (url, name, category, scrape_frequency)
$articles   // Scraped articles (content, analysis results, processing status)
$reports    // Generated briefs (title, content, clustering_params, model_author)
$newsletter // Email subscriptions
```

**Convention**: Table objects are prefixed with `$` (e.g., `$articles`) to avoid variable name conflicts.

## Development Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm dev                    # Run all apps in dev mode
pnpm --filter @meridian/scrapers dev   # Scrapers only (Wrangler)
pnpm --filter @meridian/frontend dev   # Frontend only (Nuxt)

# Build
pnpm build                  # Build all packages

# Type checking
pnpm typecheck              # Run TypeScript checks

# Formatting
pnpm format                 # Prettier format all files

# Database
pnpm --filter @meridian/database generate   # Generate migrations
pnpm --filter @meridian/database db:migrate # Run migrations

# Testing
pnpm --filter @meridian/scrapers test       # Run scraper tests (Vitest)
```

## Environment Variables

### Scrapers (`apps/scrapers/.dev.vars`)
```bash
DATABASE_URL=              # PostgreSQL connection string
GOOGLE_API_KEY=            # Google Gemini 3 API key
GOOGLE_BASE_URL=           # Google AI base URL
MERIDIAN_SECRET_KEY=       # API authentication secret
CLOUDFLARE_ACCOUNT_ID=     # For browser rendering

# Optional - Enable advanced features
OPENAI_API_KEY=            # GPT-5.2 for briefs
ANTHROPIC_API_KEY=         # Claude 4.5 fallback
MISTRAL_API_KEY=           # Mistral OCR 3 for PDFs
FIRECRAWL_API_KEY=         # AI scraping for complex sites
```

### Frontend (`apps/frontend/.env`)
```
NUXT_DATABASE_URL=         # PostgreSQL connection string
```

### Briefs (`apps/briefs/.env`)
```
GOOGLE_API_KEY=            # For Gemini 3 calls
OPENAI_API_KEY=            # For GPT-5.2 synthesis
MERIDIAN_SECRET_KEY=       # API authentication
```

## Code Conventions

### TypeScript
- **Strict mode** enabled
- **Zod** for runtime validation (schemas in `*.prompt.ts` files)
- **neverthrow** for type-safe error handling (`Result`, `ResultAsync`)
- **Prettier config**: Single quotes, 2 spaces, 120 char width, trailing commas

### Error Handling Pattern
```typescript
import { err, ok, ResultAsync } from 'neverthrow';

// Return Result types instead of throwing
if (failed) return err(new Error('reason'));
return ok(data);
```

### Workflow Steps
Cloudflare Workflows use step functions for durability:
```typescript
await step.do('step-name', config, async () => {
  // Idempotent operation
});
```

### Database Queries
Use Drizzle query builder with explicit imports:
```typescript
import { $articles, and, eq, isNull } from '@meridian/database';
const db = getDb(env.DATABASE_URL);
await db.select().from($articles).where(and(...));
```

## API Endpoints

### Scrapers Worker (`meridian-production.alceos.workers.dev`)
- `GET /ping` - Health check
- `GET /events?date=YYYY-MM-DD` - Get processed articles (requires auth)
- `GET /reports` - List published reports
- `GET /reports/:slug` - Get specific report
- `GET /openGraph/:slug` - Open Graph image generation

### Frontend (`/api/`)
- `GET /api/stats` - Dashboard statistics
- `GET /api/reports` - List reports
- `POST /api/subscribe` - Newsletter signup

## Deployment

### CI/CD (`.github/workflows/deploy-services.yaml`)
1. Checkout → Install deps (pnpm)
2. Generate & validate DB migrations
3. Run migrations on production DB
4. Deploy scrapers worker (Wrangler)
5. Build frontend (Nuxt)

### Manual Deployment
```bash
# Scrapers
cd apps/scrapers && wrangler deploy --env production

# Frontend (currently via CI)
pnpm --filter @meridian/frontend build
```

## Testing

- **Unit tests**: Vitest in `apps/scrapers/test/`
- **Test fixtures**: XML RSS feed samples for parser testing
- **Run**: `pnpm --filter @meridian/scrapers test`

## Important Files

| File | Purpose |
|------|---------|
| `apps/scrapers/src/lib/models.ts` | AI model configuration |
| `apps/scrapers/src/lib/firecrawl.ts` | Firecrawl AI scraping |
| `apps/scrapers/src/lib/documentOcr.ts` | Mistral OCR 3 integration |
| `apps/scrapers/src/prompts/articleAnalysis.prompt.ts` | LLM prompt for article classification |
| `apps/scrapers/wrangler.toml` | Worker config, cron schedules, workflow bindings |
| `packages/database/src/schema.ts` | Database schema definition |
| `apps/frontend/src/pages/admin/index.vue` | Admin dashboard |
| `apps/briefs/src/llm.py` | Multi-model LLM client |
| `.prettierrc` | Code formatting rules |

## Current Features

- **Multi-provider AI**: Gemini 3, GPT-5.2, Claude 4.5, Mistral
- **PDF Processing**: Mistral OCR 3 for document sources
- **AI Scraping**: Firecrawl Agent for complex sites
- **Beautiful Dashboard**: `/admin` with real-time stats
- **Thinking Levels**: Configurable Gemini 3 reasoning depth

## Tips for AI Assistants

1. **Use cutting-edge models** - Gemini 3 Flash/Pro, GPT-5.2, Mistral OCR 3
2. **Use neverthrow** for error handling in async operations
3. **Follow the `$tableName` convention** for Drizzle table references
4. **Test RSS parsing** with fixtures in `apps/scrapers/test/fixtures/`
5. **Database migrations** must be generated locally and committed
6. **Wrangler secrets** are set via `wrangler secret put KEY_NAME`
7. **Configure thinking levels** for Gemini 3 based on task complexity
8. **Use Firecrawl Agent** for paywalled or complex sites
9. **Enable Mistral OCR** for PDF news sources

---

## MANDATORY: Turn-End Requirements

**At the end of EVERY conversation turn, before finishing, you MUST:**

### 1. Update TODO.md
Update `/TODO.md` with the next 10 highest leverage actions:
- Each action must have a **confidence score** (0-100%)
- Each action must be broken into **10-20 atomic subtasks**
- Each atomic subtask must touch **≤5 files**
- Include **web research** for technology choices
- Validate **documentation recency** as of today's date
- Apply **temporal metacognition** (awareness that documentation ages)

### 2. Update CHANGELOG.md
Update `/CHANGELOG.md` with:
- **ISO 8601 timestamp** for each entry
- Description of changes made
- Files created/modified
- Confidence scores for implementations

### 3. Research Validation
Before recommending technologies:
- **Web search** for latest versions and best practices
- Check documentation is **current as of today** (dynamic date)
- Note when documentation may be outdated
- Provide **alternative approaches** if confidence < 80%

### 4. Cognitive Empathy Analysis
For significant changes, analyze from multiple viewpoints:
- **User perspective**: How does this affect end users?
- **Developer perspective**: Is this maintainable?
- **Operations perspective**: Can this be monitored/debugged?

### Example TODO.md Entry Format
```markdown
## Action 1: [Name] (Confidence: XX%)
**Research Date**: YYYY-MM-DD
**Documentation Validated**: [Yes/Needs Update]

### Why This Matters
[Brief explanation]

### Atomic Subtasks
| # | Task | Files (≤5) | Description |
|---|------|------------|-------------|
| 1.1 | Task name | `file1.ts`, `file2.ts` | Description |
```

### Example CHANGELOG.md Entry Format
```markdown
## [YYYY-MM-DDTHH:MM:SSZ] Session Update

### Changes Made
- Feature: [description]
- Fix: [description]

### Files Modified
- `path/to/file.ts` - [what changed]

### Confidence Scores
- Implementation: XX%
- Testing: XX%
```

---

**This requirement ensures continuous improvement tracking and maintains project momentum across sessions.**
