/**
 * PWA Configuration for Meridian
 * Mobile-optimized Progressive Web App settings
 */

import type { ModuleOptions } from '@vite-pwa/nuxt';

/**
 * PWA module configuration
 */
export const pwaConfig: Partial<ModuleOptions> = {
  registerType: 'autoUpdate',
  scope: '/',
  base: '/',

  manifest: {
    name: 'Meridian Intelligence',
    short_name: 'Meridian',
    description: 'AI-powered news intelligence briefings',
    theme_color: '#667eea',
    background_color: '#ffffff',
    display: 'standalone',
    orientation: 'portrait-primary',
    start_url: '/',
    scope: '/',
    lang: 'en',

    icons: [
      {
        src: '/icons/icon-72x72.png',
        sizes: '72x72',
        type: 'image/png',
        purpose: 'maskable any',
      },
      {
        src: '/icons/icon-96x96.png',
        sizes: '96x96',
        type: 'image/png',
        purpose: 'maskable any',
      },
      {
        src: '/icons/icon-128x128.png',
        sizes: '128x128',
        type: 'image/png',
        purpose: 'maskable any',
      },
      {
        src: '/icons/icon-144x144.png',
        sizes: '144x144',
        type: 'image/png',
        purpose: 'maskable any',
      },
      {
        src: '/icons/icon-152x152.png',
        sizes: '152x152',
        type: 'image/png',
        purpose: 'maskable any',
      },
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable any',
      },
      {
        src: '/icons/icon-384x384.png',
        sizes: '384x384',
        type: 'image/png',
        purpose: 'maskable any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable any',
      },
    ],

    screenshots: [
      {
        src: '/screenshots/desktop-home.png',
        sizes: '1920x1080',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Meridian Dashboard',
      },
      {
        src: '/screenshots/mobile-home.png',
        sizes: '750x1334',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Meridian Mobile',
      },
    ],

    shortcuts: [
      {
        name: 'Latest Brief',
        short_name: 'Brief',
        description: 'View the latest intelligence brief',
        url: '/briefs/latest',
        icons: [{ src: '/icons/shortcut-brief.png', sizes: '96x96' }],
      },
      {
        name: 'Search',
        short_name: 'Search',
        description: 'Search articles',
        url: '/search',
        icons: [{ src: '/icons/shortcut-search.png', sizes: '96x96' }],
      },
    ],

    categories: ['news', 'productivity', 'business'],

    share_target: {
      action: '/share',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
      },
    },
  },

  workbox: {
    navigateFallback: '/',
    globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],

    runtimeCaching: [
      {
        urlPattern: /^https:\/\/meridian-production\.alceos\.workers\.dev\/api\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24, // 24 hours
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
          networkTimeoutSeconds: 10,
        },
      },
      {
        urlPattern: /^https:\/\/meridian-production\.alceos\.workers\.dev\/reports\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'reports-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'images-cache',
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          },
        },
      },
      {
        urlPattern: /\.(?:woff|woff2|ttf|eot)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'fonts-cache',
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
          },
        },
      },
    ],

    cleanupOutdatedCaches: true,
    skipWaiting: true,
    clientsClaim: true,
  },

  client: {
    installPrompt: true,
    periodicSyncForUpdates: 60 * 60, // Check every hour
  },

  devOptions: {
    enabled: true,
    type: 'module',
    navigateFallback: '/',
  },
};

/**
 * Offline page configuration
 */
export const offlineConfig = {
  offlinePage: '/offline',
  offlineAssets: ['/offline', '/icons/icon-192x192.png', '/fonts/inter-var.woff2'],
};

/**
 * Push notification configuration
 */
export const pushConfig = {
  vapidPublicKey: process.env.NUXT_VAPID_PUBLIC_KEY || '',
  topics: [
    { id: 'daily-brief', name: 'Daily Brief', description: 'Get notified when new briefs are published' },
    { id: 'breaking-news', name: 'Breaking News', description: 'Urgent news alerts' },
    { id: 'weekly-digest', name: 'Weekly Digest', description: 'Weekly summary of top stories' },
  ],
};

/**
 * App install prompt configuration
 */
export const installPromptConfig = {
  // Show prompt after user has visited X pages
  pageViewThreshold: 3,
  // Don't show prompt again for X days after dismissal
  dismissalCooldownDays: 7,
  // Custom prompt text
  promptTitle: 'Install Meridian',
  promptDescription: 'Get intelligence briefs on your home screen for quick access',
  promptAcceptText: 'Install',
  promptDismissText: 'Not now',
};

/**
 * Background sync configuration
 */
export const backgroundSyncConfig = {
  // Sync read articles
  readArticlesSync: {
    name: 'read-articles-sync',
    maxRetentionTime: 60 * 60 * 24, // 24 hours
  },
  // Sync preferences
  preferencesSync: {
    name: 'preferences-sync',
    maxRetentionTime: 60 * 60 * 24 * 7, // 7 days
  },
};

/**
 * Share target handler
 */
export function handleShareTarget(data: { title?: string; text?: string; url?: string }): string {
  const params = new URLSearchParams();
  if (data.title) params.set('title', data.title);
  if (data.text) params.set('text', data.text);
  if (data.url) params.set('url', data.url);
  return `/share?${params.toString()}`;
}
