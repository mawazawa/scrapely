<script setup lang="ts">
/**
 * Error Boundary Component
 * Catches and displays errors gracefully, reports to Sentry
 */

import { ref, onErrorCaptured } from 'vue';

interface Props {
  fallbackTitle?: string;
  fallbackMessage?: string;
  showRetry?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  fallbackTitle: 'Something went wrong',
  fallbackMessage: 'An unexpected error occurred. Please try again.',
  showRetry: true,
});

const emit = defineEmits<{
  (e: 'error', error: Error): void;
  (e: 'retry'): void;
}>();

const hasError = ref(false);
const errorMessage = ref('');
const errorStack = ref('');

const { $sentry } = useNuxtApp();

onErrorCaptured((error: Error, instance, info) => {
  hasError.value = true;
  errorMessage.value = error.message;
  errorStack.value = error.stack || '';

  // Report to Sentry
  if ($sentry) {
    $sentry.captureException(error, {
      componentName: instance?.$options?.name,
      lifecycleHook: info,
    });
  }

  // Emit error event
  emit('error', error);

  // Return false to prevent the error from propagating
  return false;
});

function handleRetry() {
  hasError.value = false;
  errorMessage.value = '';
  errorStack.value = '';
  emit('retry');
}

function handleReload() {
  window.location.reload();
}
</script>

<template>
  <div v-if="hasError" class="error-boundary">
    <div class="error-content">
      <div class="error-icon">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-16 h-16 text-red-500"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>

      <h2 class="error-title">{{ fallbackTitle }}</h2>
      <p class="error-message">{{ fallbackMessage }}</p>

      <div v-if="process.dev && errorMessage" class="error-details">
        <details>
          <summary class="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
            Error details
          </summary>
          <pre class="error-stack">{{ errorMessage }}

{{ errorStack }}</pre>
        </details>
      </div>

      <div class="error-actions">
        <button
          v-if="showRetry"
          @click="handleRetry"
          class="retry-button"
        >
          Try again
        </button>
        <button
          @click="handleReload"
          class="reload-button"
        >
          Reload page
        </button>
      </div>
    </div>
  </div>

  <slot v-else />
</template>

<style scoped>
.error-boundary {
  @apply flex items-center justify-center min-h-[300px] p-8;
}

.error-content {
  @apply text-center max-w-md;
}

.error-icon {
  @apply flex justify-center mb-4;
}

.error-title {
  @apply text-xl font-semibold text-gray-900 mb-2;
}

.error-message {
  @apply text-gray-600 mb-4;
}

.error-details {
  @apply mb-4 text-left;
}

.error-stack {
  @apply mt-2 p-3 bg-gray-100 rounded text-xs text-gray-700 overflow-x-auto max-h-40;
}

.error-actions {
  @apply flex gap-3 justify-center;
}

.retry-button {
  @apply px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors;
}

.reload-button {
  @apply px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors;
}
</style>
