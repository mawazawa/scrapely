<script setup lang="ts">
const config = useRuntimeConfig();

useSEO({
  title: 'Admin Dashboard | Meridian',
  description: 'Meridian intelligence system dashboard',
  ogImage: `${config.public.WORKER_API}/openGraph/default`,
  ogUrl: 'https://news.iliane.xyz/admin',
});

const { data: stats, pending, error, refresh } = await useFetch('/api/stats');

// Auto-refresh every 30 seconds
const refreshInterval = ref<NodeJS.Timeout | null>(null);
onMounted(() => {
  refreshInterval.value = setInterval(() => refresh(), 30000);
});
onUnmounted(() => {
  if (refreshInterval.value) clearInterval(refreshInterval.value);
});

const formatNumber = (n: number) => new Intl.NumberFormat().format(n);
const formatDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
    <!-- Header -->
    <header class="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
      <div class="max-w-7xl mx-auto px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
              <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 class="text-xl font-semibold text-white">Meridian</h1>
              <p class="text-sm text-slate-400">Intelligence Dashboard</p>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <button
              @click="refresh()"
              class="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all duration-200 border border-slate-700"
            >
              <svg class="w-4 h-4" :class="{ 'animate-spin': pending }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <NuxtLink
              to="/briefs/latest"
              class="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-medium transition-all duration-200 shadow-lg shadow-emerald-500/25"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Latest Brief
            </NuxtLink>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-6 py-8">
      <!-- Loading State -->
      <div v-if="pending && !stats" class="flex items-center justify-center py-20">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-20">
        <div class="text-red-400 mb-4">Failed to load dashboard data</div>
        <button @click="refresh()" class="text-emerald-400 hover:text-emerald-300">Try again</button>
      </div>

      <!-- Dashboard Content -->
      <div v-else-if="stats" class="space-y-8">
        <!-- Stats Grid -->
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300">
            <div class="text-slate-400 text-sm font-medium mb-1">Sources</div>
            <div class="text-2xl font-bold text-white">{{ formatNumber(stats.overview.totalSources) }}</div>
          </div>
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300">
            <div class="text-slate-400 text-sm font-medium mb-1">Total Articles</div>
            <div class="text-2xl font-bold text-white">{{ formatNumber(stats.overview.totalArticles) }}</div>
          </div>
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 border border-emerald-500/30 hover:border-emerald-500/50 transition-all duration-300">
            <div class="text-emerald-400 text-sm font-medium mb-1">Scraped (24h)</div>
            <div class="text-2xl font-bold text-emerald-400">{{ formatNumber(stats.overview.articlesLast24h) }}</div>
          </div>
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 border border-cyan-500/30 hover:border-cyan-500/50 transition-all duration-300">
            <div class="text-cyan-400 text-sm font-medium mb-1">Processed (24h)</div>
            <div class="text-2xl font-bold text-cyan-400">{{ formatNumber(stats.overview.processedLast24h) }}</div>
          </div>
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 border border-amber-500/30 hover:border-amber-500/50 transition-all duration-300">
            <div class="text-amber-400 text-sm font-medium mb-1">Pending</div>
            <div class="text-2xl font-bold text-amber-400">{{ formatNumber(stats.overview.pendingArticles) }}</div>
          </div>
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 border border-red-500/30 hover:border-red-500/50 transition-all duration-300">
            <div class="text-red-400 text-sm font-medium mb-1">Failed</div>
            <div class="text-2xl font-bold text-red-400">{{ formatNumber(stats.overview.failedArticles) }}</div>
          </div>
        </div>

        <!-- Two Column Layout -->
        <div class="grid lg:grid-cols-2 gap-6">
          <!-- Recent Reports -->
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-700/50">
              <h2 class="text-lg font-semibold text-white flex items-center gap-2">
                <svg class="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Recent Briefs
              </h2>
            </div>
            <div class="divide-y divide-slate-700/50">
              <NuxtLink
                v-for="report in stats.recentReports"
                :key="report.id"
                :to="`/briefs/${report.id}`"
                class="block px-6 py-4 hover:bg-slate-700/30 transition-colors duration-200"
              >
                <div class="font-medium text-white mb-1">{{ report.title }}</div>
                <div class="flex items-center gap-4 text-sm text-slate-400">
                  <span>{{ formatDate(report.createdAt) }}</span>
                  <span class="flex items-center gap-1">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                    {{ report.totalArticles }} articles
                  </span>
                </div>
              </NuxtLink>
              <div v-if="!stats.recentReports?.length" class="px-6 py-8 text-center text-slate-400">
                No reports yet
              </div>
            </div>
          </div>

          <!-- AI Models -->
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-700/50">
              <h2 class="text-lg font-semibold text-white flex items-center gap-2">
                <svg class="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                AI Models (Dec 2025)
              </h2>
            </div>
            <div class="p-6 space-y-4">
              <div class="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl">
                <div>
                  <div class="font-medium text-white">Article Analysis</div>
                  <div class="text-sm text-slate-400">Classification & summarization</div>
                </div>
                <div class="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium">
                  {{ stats.models.analysis }}
                </div>
              </div>
              <div class="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl">
                <div>
                  <div class="font-medium text-white">Brief Synthesis</div>
                  <div class="text-sm text-slate-400">Intelligence report generation</div>
                </div>
                <div class="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm font-medium">
                  {{ stats.models.synthesis }}
                </div>
              </div>
              <div class="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl">
                <div>
                  <div class="font-medium text-white">Document OCR</div>
                  <div class="text-sm text-slate-400">PDF & document processing</div>
                </div>
                <div class="px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-medium">
                  {{ stats.models.ocr }}
                </div>
              </div>
              <div class="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl">
                <div>
                  <div class="font-medium text-white">AI Scraping</div>
                  <div class="text-sm text-slate-400">Complex site extraction</div>
                </div>
                <div class="px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-sm font-medium">
                  {{ stats.models.scraping }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Source Breakdown -->
        <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-700/50">
            <h2 class="text-lg font-semibold text-white flex items-center gap-2">
              <svg class="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
              Top Sources (7 days)
            </h2>
          </div>
          <div class="p-6">
            <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div
                v-for="(source, i) in stats.sourceBreakdown"
                :key="source.sourceName"
                class="bg-slate-700/30 rounded-xl p-4 text-center hover:bg-slate-700/50 transition-colors duration-200"
              >
                <div class="text-2xl font-bold text-white mb-1">{{ formatNumber(source.count) }}</div>
                <div class="text-sm text-slate-400 truncate">{{ source.sourceName }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Relevance Breakdown -->
        <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-700/50">
            <h2 class="text-lg font-semibold text-white flex items-center gap-2">
              <svg class="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Content Analysis (7 days)
            </h2>
          </div>
          <div class="p-6">
            <div class="flex flex-wrap gap-4">
              <div
                v-for="item in stats.relevanceBreakdown"
                :key="item.relevance"
                class="flex items-center gap-3 px-4 py-3 bg-slate-700/30 rounded-xl"
              >
                <div
                  class="w-3 h-3 rounded-full"
                  :class="{
                    'bg-emerald-400': item.relevance === 'RELEVANT',
                    'bg-slate-400': item.relevance === 'NOT_RELEVANT',
                    'bg-amber-400': !item.relevance,
                  }"
                ></div>
                <div>
                  <span class="font-medium text-white">{{ formatNumber(item.count) }}</span>
                  <span class="text-slate-400 ml-2">{{ item.relevance || 'Pending' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="border-t border-slate-700/50 mt-12">
      <div class="max-w-7xl mx-auto px-6 py-6">
        <div class="flex items-center justify-between text-sm text-slate-400">
          <div>Meridian Intelligence System</div>
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            System Operational
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>
