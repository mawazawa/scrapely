<script setup lang="ts">
/**
 * Source performance chart component
 * Shows top sources by article count and success rate
 */

import { Bar } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface SourceData {
  source_name: string;
  total_articles: number;
  relevant_articles: number;
  success_rate: number;
}

interface Props {
  data: SourceData[];
  height?: number;
  limit?: number;
}

const props = withDefaults(defineProps<Props>(), {
  height: 300,
  limit: 10,
});

const limitedData = computed(() => props.data.slice(0, props.limit));

const chartData = computed(() => ({
  labels: limitedData.value.map((d) => truncate(d.source_name, 20)),
  datasets: [
    {
      label: 'Total Articles',
      data: limitedData.value.map((d) => d.total_articles),
      backgroundColor: 'rgba(59, 130, 246, 0.8)',
      borderColor: 'rgb(59, 130, 246)',
      borderWidth: 1,
    },
    {
      label: 'Relevant Articles',
      data: limitedData.value.map((d) => d.relevant_articles),
      backgroundColor: 'rgba(16, 185, 129, 0.8)',
      borderColor: 'rgb(16, 185, 129)',
      borderWidth: 1,
    },
  ],
}));

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y' as const,
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
      callbacks: {
        afterBody: (context: unknown[]) => {
          const index = (context[0] as { dataIndex: number }).dataIndex;
          const source = limitedData.value[index];
          return `Success Rate: ${source.success_rate}%`;
        },
      },
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

function truncate(str: string, maxLength: number): string {
  return str.length > maxLength ? str.slice(0, maxLength) + '...' : str;
}
</script>

<template>
  <div :style="{ height: `${height}px` }">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>
