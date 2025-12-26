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

## Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | Turborepo + pnpm workspaces |
| Infrastructure | Cloudflare Workers, Workflows, Pages |
| Backend | Hono (TypeScript), Cloudflare Workflows |
| Database | PostgreSQL + Drizzle ORM |
| AI/LLM | Google Gemini (2.0 Flash primary, 2.5 Pro for analysis) |
| ML Pipeline | Python: UMAP, HDBSCAN, multilingual-e5-small embeddings |
| Frontend | Nuxt 3, Vue 3, Tailwind CSS 4 |

## Key Architecture Components

### 1. RSS Scraping (`apps/scrapers/src/workflows/rssFeed.workflow.ts`)

- **Trigger**: Cron job at minute 4 of every hour
- **Process**: Fetches RSS feeds from sources, parses articles, stores metadata
- **Rate limiting**: Domain-aware with configurable cooldowns
- **Tiered scraping**: Sources have frequency tiers (hourly, 4h, 6h, daily)

### 2. Article Processing (`apps/scrapers/src/workflows/processArticles.workflow.ts`)

- **Content extraction**: Direct fetch first, falls back to browser rendering for paywalled sites
- **LLM Analysis**: Uses Gemini 2.0 Flash for article classification
- **Output schema**: Language, location, completeness, relevance, structured summary
- **Self-healing**: Re-triggers workflow if unprocessed articles remain

### 3. Brief Generation (`apps/briefs/`)

- **Currently manual**: Jupyter notebook-based workflow
- **Pipeline**:
  1. Fetch processed articles via API
  2. Generate embeddings (multilingual-e5-small)
  3. Cluster with UMAP + HDBSCAN
  4. LLM review of clusters
  5. Deep analysis per cluster
  6. Final brief synthesis with previous day's TLDR for continuity

### 4. Frontend (`apps/frontend/`)

- **Framework**: Nuxt 3 with SSR/SSG
- **Styling**: Tailwind CSS 4 with typography plugin
- **Rendering**: Markdown briefs with KaTeX support
- **API**: Server routes connect to PostgreSQL for reports

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
```
DATABASE_URL=              # PostgreSQL connection string
GOOGLE_API_KEY=            # Google AI API key
GOOGLE_BASE_URL=           # Google AI base URL
MERIDIAN_SECRET_KEY=       # API authentication secret
CLOUDFLARE_ACCOUNT_ID=     # For browser rendering
```

### Frontend (`apps/frontend/.env`)
```
NUXT_DATABASE_URL=         # PostgreSQL connection string
```

### Briefs (`apps/briefs/.env`)
```
GOOGLE_API_KEY=            # For LLM calls
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
| `apps/scrapers/wrangler.toml` | Worker config, cron schedules, workflow bindings |
| `apps/scrapers/src/prompts/articleAnalysis.prompt.ts` | LLM prompt for article classification |
| `packages/database/src/schema.ts` | Database schema definition |
| `apps/frontend/nuxt.config.ts` | Nuxt configuration |
| `.prettierrc` | Code formatting rules |

## Current Limitations & TODOs

1. **Brief generation is manual** - Python notebook needs automation
2. **No newsletter distribution** - Email form exists but no send logic
3. **Limited monitoring** - Need better scraping robustness tracking
4. **Tricky domains** - Some sites (Reuters, NYTimes) require browser rendering

## AI Model Usage

| Component | Model | Purpose |
|-----------|-------|---------|
| Article Analysis | Gemini 2.0 Flash | Fast, cheap classification & summarization |
| Cluster Review | Gemini 2.5 Pro | Long-context cluster analysis |
| Brief Synthesis | Gemini 2.5 Pro | Final briefing generation with analytical tone |

## Tips for AI Assistants

1. **Always check existing patterns** before adding new code
2. **Use neverthrow** for error handling in async operations
3. **Follow the `$tableName` convention** for Drizzle table references
4. **Test RSS parsing** with fixtures in `apps/scrapers/test/fixtures/`
5. **Database migrations** must be generated locally and committed
6. **Wrangler secrets** are set via `wrangler secret put KEY_NAME`
7. **The Python briefs code** uses OpenAI SDK pointed at Gemini's OpenAI-compatible endpoint
