<script setup lang="ts">
/**
 * Article volume chart component
 * Shows articles over time with stacked bars for relevance
 */

import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TimeSeriesData {
  date: string;
  total: number;
  relevant: number;
  irrelevant: number;
}

interface Props {
  data: TimeSeriesData[];
  height?: number;
}

const props = withDefaults(defineProps<Props>(), {
  height: 300,
});

const chartData = computed(() => ({
  labels: props.data.map((d) => formatDate(d.date)),
  datasets: [
    {
      label: 'Total Articles',
      data: props.data.map((d) => d.total),
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
      tension: 0.4,
    },
    {
      label: 'Relevant',
      data: props.data.map((d) => d.relevant),
      borderColor: 'rgb(16, 185, 129)',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      fill: true,
      tension: 0.4,
    },
  ],
}));

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index' as const,
    intersect: false,
  },
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        color: 'rgb(148, 163, 184)',
        usePointStyle: true,
        padding: 20,
      },
    },
    tooltip: {
      backgroundColor: 'rgb(30, 41, 59)',
      titleColor: 'rgb(248, 250, 252)',
      bodyColor: 'rgb(203, 213, 225)',
      borderColor: 'rgb(51, 65, 85)',
      borderWidth: 1,
      padding: 12,
    },
  },
  scales: {
    x: {
      grid: {
        color: 'rgba(51, 65, 85, 0.5)',
      },
      ticks: {
        color: 'rgb(148, 163, 184)',
      },
    },
    y: {
      grid: {
        color: 'rgba(51, 65, 85, 0.5)',
      },
      ticks: {
        color: 'rgb(148, 163, 184)',
      },
    },
  },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
</script>

<template>
  <div :style="{ height: `${height}px` }">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>
