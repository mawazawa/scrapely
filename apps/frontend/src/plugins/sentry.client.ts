/**
 * Sentry Vue/Nuxt Plugin
 * Client-side error tracking with @sentry/vue
 */

import * as Sentry from '@sentry/vue';

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();
  const router = useRouter();

  // Get DSN from runtime config
  const dsn = config.public.sentryDsn as string;

  if (!dsn) {
    console.warn('[Sentry] DSN not configured, error tracking disabled');
    return {
      provide: {
        sentry: {
          captureException: (error: unknown) => {
            console.error('[Sentry disabled]', error);
          },
          captureMessage: (message: string) => {
            console.log('[Sentry disabled]', message);
          },
          setUser: () => {},
        },
      },
    };
  }

  // Initialize Sentry
  Sentry.init({
    app: nuxtApp.vueApp,
    dsn,
    environment: config.public.environment as string || 'development',
    release: config.public.sentryRelease as string,

    // Performance monitoring
    tracesSampleRate: 0.1, // 10% of transactions

    // Session replay for debugging (optional)
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Vue-specific integrations
    integrations: [
      Sentry.browserTracingIntegration({
        router,
      }),
      Sentry.replayIntegration(),
    ],

    // Filter out known non-critical errors
    beforeSend(event) {
      // Filter out ResizeObserver errors (browser bug)
      if (event.exception?.values?.[0]?.value?.includes('ResizeObserver')) {
        return null;
      }

      // Filter out network errors for external resources
      if (event.exception?.values?.[0]?.type === 'TypeError' &&
          event.exception?.values?.[0]?.value?.includes('fetch')) {
        return null;
      }

      return event;
    },

    // Track which routes have errors
    beforeSendTransaction(event) {
      // Add route information to all transactions
      return event;
    },
  });

  // Set up Vue error handler
  nuxtApp.vueApp.config.errorHandler = (error, instance, info) => {
    Sentry.captureException(error, {
      extra: {
        componentName: instance?.$options?.name,
        lifecycleHook: info,
      },
    });

    // Also log to console in development
    if (process.dev) {
      console.error('[Vue Error]', error, info);
    }
  };

  // Track route changes
  router.onError((error) => {
    Sentry.captureException(error, {
      tags: {
        type: 'router_error',
      },
    });
  });

  // Provide Sentry utilities to components
  return {
    provide: {
      sentry: {
        /**
         * Capture an exception with optional context
         */
        captureException: (error: unknown, context?: Record<string, unknown>) => {
          return Sentry.captureException(error, { extra: context });
        },

        /**
         * Capture a message
         */
        captureMessage: (
          message: string,
          level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'
        ) => {
          return Sentry.captureMessage(message, level);
        },

        /**
         * Set user context
         */
        setUser: (user: { id?: string; email?: string; username?: string } | null) => {
          Sentry.setUser(user);
        },

        /**
         * Add breadcrumb for debugging
         */
        addBreadcrumb: (breadcrumb: {
          category?: string;
          message: string;
          level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
          data?: Record<string, unknown>;
        }) => {
          Sentry.addBreadcrumb(breadcrumb);
        },

        /**
         * Set a tag
         */
        setTag: (key: string, value: string) => {
          Sentry.setTag(key, value);
        },

        /**
         * Set extra context
         */
        setExtra: (key: string, value: unknown) => {
          Sentry.setExtra(key, value);
        },
      },
    },
  };
});
