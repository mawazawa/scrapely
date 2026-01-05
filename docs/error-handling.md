# Error Handling Patterns

This document describes the error handling patterns used in the Meridian codebase with Sentry integration.

## Overview

Meridian uses Sentry for error tracking across both the backend (Cloudflare Workers) and frontend (Nuxt/Vue). This provides:

- Real-time error alerting
- Full stack traces with source maps
- Error grouping and deduplication
- Performance monitoring
- User context tracking

## Backend (Cloudflare Workers)

### Configuration

Sentry is configured in `apps/scrapers/src/lib/sentry.ts` and initialized in `apps/scrapers/src/index.ts`.

**Environment Variables:**
```
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_RELEASE=meridian@<commit-sha>
ENVIRONMENT=production|development
```

### Basic Usage

```typescript
import { captureException, captureMessage, addBreadcrumb } from '../lib/sentry';

// Capture an exception
try {
  await riskyOperation();
} catch (error) {
  captureException(error, {
    tags: { module: 'my-module' },
    extra: { userId: '123' }
  });
  throw error;
}

// Capture a message
captureMessage('Important event occurred', 'info', { data: 'value' });

// Add breadcrumbs for debugging
addBreadcrumb({
  category: 'user-action',
  message: 'User clicked button',
  level: 'info',
  data: { buttonId: 'submit' }
});
```

### Scraper Error Tracking

For court scrapers, use the specialized `captureScraperError` function:

```typescript
import { captureScraperError } from '../lib/sentry';

try {
  await scraper.scrapeCase(caseNumber);
} catch (error) {
  captureScraperError(error, {
    courtId: 'sf-superior',
    operation: 'scrapeCase',
    caseNumber: 'CGC-24-123456',
    url: 'https://court.example.com/case/123',
    attempt: 3,
    maxAttempts: 5,
  });
}
```

### Transaction Tracing

For performance monitoring:

```typescript
import { startTransaction } from '../lib/sentry';

async function processArticle(article: Article) {
  const transaction = startTransaction('process-article', 'task');

  try {
    // Do work
    const result = await analyze(article);
    transaction?.end();
    return result;
  } catch (error) {
    transaction?.setStatus({ code: 2, message: String(error) });
    transaction?.end();
    throw error;
  }
}
```

### Hono Middleware

Sentry middleware is automatically included in routes. For custom error handling:

```typescript
import { sentryMiddleware } from '../lib/sentry';

const app = new Hono()
  .use('*', sentryMiddleware())
  .get('/api/data', async (c) => {
    // Errors here are automatically captured
  });
```

## Frontend (Nuxt/Vue)

### Configuration

Sentry is configured in `apps/frontend/src/plugins/sentry.client.ts` and loads from runtime config.

**Environment Variables (nuxt.config.ts):**
```typescript
runtimeConfig: {
  public: {
    sentryDsn: process.env.NUXT_PUBLIC_SENTRY_DSN,
    sentryRelease: process.env.NUXT_PUBLIC_SENTRY_RELEASE,
    environment: process.env.NUXT_PUBLIC_ENVIRONMENT,
  },
}
```

### Using the $sentry Plugin

The Sentry plugin is injected into the Nuxt app:

```vue
<script setup>
const { $sentry } = useNuxtApp();

async function submitForm() {
  try {
    await apiCall();
  } catch (error) {
    $sentry.captureException(error, { formData: data });
    showErrorToast('Failed to submit');
  }
}
</script>
```

### Available Methods

```typescript
// Capture exception
$sentry.captureException(error, context);

// Capture message
$sentry.captureMessage('Event occurred', 'info');

// Set user context (after login)
$sentry.setUser({ id: user.id, email: user.email });

// Clear user context (after logout)
$sentry.setUser(null);

// Add breadcrumb
$sentry.addBreadcrumb({
  category: 'navigation',
  message: 'Navigated to dashboard',
  level: 'info',
});

// Set tags
$sentry.setTag('feature', 'court-tracking');

// Set extra context
$sentry.setExtra('caseCount', 5);
```

### Error Boundary Component

Use the `ErrorBoundary` component to catch and display errors gracefully:

```vue
<template>
  <ErrorBoundary
    fallback-title="Something went wrong"
    fallback-message="Please try again or contact support."
    @error="handleError"
    @retry="handleRetry"
  >
    <MyComponent />
  </ErrorBoundary>
</template>

<script setup>
function handleError(error: Error) {
  console.error('Caught error:', error);
}

function handleRetry() {
  // Retry logic
}
</script>
```

## Error Categories

### Critical Errors (Always Captured)

- Unhandled exceptions
- Database connection failures
- Authentication failures
- Payment processing errors
- Scraper complete failures (after all retries)

### Warning Errors (Sampled)

- Rate limiting hits
- Validation errors
- Temporary network failures
- Cloudflare challenges detected

### Filtered Errors (Not Captured)

- ResizeObserver errors (browser bug)
- Network errors for external resources
- Expected validation failures

## Best Practices

1. **Add Context**: Always include relevant context when capturing errors:
   ```typescript
   captureException(error, {
     tags: { module: 'billing', action: 'charge' },
     extra: { userId, amount, currency }
   });
   ```

2. **Use Breadcrumbs**: Add breadcrumbs before complex operations:
   ```typescript
   addBreadcrumb({ category: 'api', message: 'Starting payment flow' });
   await processPayment();
   ```

3. **Set User Context**: Set user context after authentication:
   ```typescript
   setUser({ id: user.id, email: user.email });
   ```

4. **Don't Over-Capture**: Not every error needs Sentry. Use it for:
   - Unexpected errors
   - Critical business logic failures
   - Infrastructure issues

5. **Use Error Boundaries**: Wrap major UI sections to prevent full-page crashes.

## CI/CD Integration

Sentry releases are created automatically on deployment:

1. Release version: `meridian@<commit-sha>`
2. Source maps are uploaded for readable stack traces
3. Deployment is marked in Sentry timeline

### Required GitHub Secrets

```
SENTRY_DSN               # Backend DSN
SENTRY_DSN_FRONTEND      # Frontend DSN
SENTRY_AUTH_TOKEN        # For release creation
SENTRY_ORG               # Your Sentry organization
```

## Monitoring and Alerts

Configure alerts in Sentry dashboard for:

1. **Critical**: New issues in production (immediate Slack/email)
2. **High**: Error spike > 10x baseline (within 5 min)
3. **Medium**: Performance degradation > 2x (daily digest)

## Troubleshooting

### Errors Not Appearing in Sentry

1. Check DSN is configured correctly
2. Verify network connectivity to Sentry
3. Check sample rate isn't filtering
4. Look for `beforeSend` filtering

### Source Maps Not Working

1. Verify source maps are uploaded in CI
2. Check release version matches
3. Ensure artifact paths are correct

### Too Many Errors

1. Increase sample rate filtering
2. Add more specific `beforeSend` filters
3. Fix the underlying issues (preferred)
