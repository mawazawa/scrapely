<script setup lang="ts">
/**
 * Connection status indicator component
 * Shows WebSocket connection state
 */

interface Props {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  showLabel?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showLabel: true,
});

const statusConfig = {
  connecting: {
    color: 'bg-yellow-500',
    pulse: true,
    label: 'Connecting...',
    icon: '⏳',
  },
  connected: {
    color: 'bg-green-500',
    pulse: false,
    label: 'Live',
    icon: '🟢',
  },
  disconnected: {
    color: 'bg-gray-400',
    pulse: false,
    label: 'Offline',
    icon: '⚪',
  },
  error: {
    color: 'bg-red-500',
    pulse: true,
    label: 'Error',
    icon: '🔴',
  },
};

const config = computed(() => statusConfig[props.status]);
</script>

<template>
  <div class="flex items-center gap-2">
    <span
      :class="[
        'inline-block w-2 h-2 rounded-full',
        config.color,
        config.pulse && 'animate-pulse',
      ]"
      :title="config.label"
    />
    <span v-if="showLabel" class="text-sm text-gray-500 dark:text-gray-400">
      {{ config.label }}
    </span>
  </div>
</template>
