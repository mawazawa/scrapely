/**
 * WebSocket composable for real-time updates
 * Connects to the Meridian stats room for live processing updates
 */

import { ref, onMounted, onUnmounted, computed } from 'vue';

/**
 * Message types from the server
 */
export interface WsMessage {
  type: 'stats' | 'workflow' | 'article' | 'ping' | 'pong' | 'error';
  payload: unknown;
  timestamp: number;
}

export interface StatsPayload {
  articlesProcessed: number;
  articlesTotal: number;
  currentSource?: string;
  processingRate: number;
  startedAt: number;
}

export interface WorkflowPayload {
  workflowId: string;
  workflowType: 'rss' | 'articles' | 'newsletter';
  step: string;
  status: 'started' | 'completed' | 'failed';
  progress?: number;
  message?: string;
}

export interface ArticlePayload {
  articleId: number;
  title: string;
  url: string;
  status: 'processing' | 'completed' | 'failed';
  relevance?: 'RELEVANT' | 'IRRELEVANT' | 'SOMEWHAT_RELEVANT';
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseWebSocketOptions {
  /** WebSocket URL (defaults to production) */
  url?: string;
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect delay in ms */
  reconnectDelay?: number;
  /** Maximum reconnect attempts */
  maxReconnectAttempts?: number;
  /** Ping interval in ms */
  pingInterval?: number;
}

/**
 * WebSocket composable for real-time updates
 */
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = getWebSocketUrl(),
    autoReconnect = true,
    reconnectDelay = 3000,
    maxReconnectAttempts = 5,
    pingInterval = 30000,
  } = options;

  // Reactive state
  const status = ref<ConnectionStatus>('disconnected');
  const stats = ref<StatsPayload | null>(null);
  const workflows = ref<Map<string, WorkflowPayload>>(new Map());
  const recentArticles = ref<ArticlePayload[]>([]);
  const error = ref<string | null>(null);

  // Internal state
  let socket: WebSocket | null = null;
  let reconnectAttempts = 0;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let pingIntervalId: ReturnType<typeof setInterval> | null = null;

  /**
   * Get the WebSocket URL based on environment
   */
  function getWebSocketUrl(): string {
    if (process.server) return '';
    const isProduction = window.location.hostname !== 'localhost';
    const wsProtocol = isProduction ? 'wss' : 'ws';
    const wsHost = isProduction
      ? 'meridian-production.alceos.workers.dev'
      : 'localhost:8787';
    return `${wsProtocol}://${wsHost}/ws/stats`;
  }

  /**
   * Connect to WebSocket
   */
  function connect(): void {
    if (process.server || !url) return;

    if (socket?.readyState === WebSocket.OPEN) {
      return;
    }

    status.value = 'connecting';
    error.value = null;

    try {
      socket = new WebSocket(url);

      socket.onopen = () => {
        status.value = 'connected';
        reconnectAttempts = 0;
        startPingInterval();
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WsMessage;
          handleMessage(message);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      socket.onclose = (event) => {
        status.value = 'disconnected';
        stopPingInterval();

        if (autoReconnect && reconnectAttempts < maxReconnectAttempts) {
          scheduleReconnect();
        }
      };

      socket.onerror = (event) => {
        status.value = 'error';
        error.value = 'WebSocket connection error';
        console.error('WebSocket error:', event);
      };
    } catch (e) {
      status.value = 'error';
      error.value = e instanceof Error ? e.message : 'Failed to connect';
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  function handleMessage(message: WsMessage): void {
    switch (message.type) {
      case 'stats':
        stats.value = message.payload as StatsPayload;
        break;

      case 'workflow':
        const workflow = message.payload as WorkflowPayload;
        workflows.value.set(workflow.workflowId, workflow);
        // Clean up completed workflows after a delay
        if (workflow.status === 'completed' || workflow.status === 'failed') {
          setTimeout(() => {
            workflows.value.delete(workflow.workflowId);
          }, 10000);
        }
        break;

      case 'article':
        const article = message.payload as ArticlePayload;
        // Keep only last 10 articles
        recentArticles.value = [article, ...recentArticles.value.slice(0, 9)];
        break;

      case 'pong':
        // Received pong, connection is alive
        break;

      case 'error':
        error.value = message.payload as string;
        break;
    }
  }

  /**
   * Schedule reconnection
   */
  function scheduleReconnect(): void {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }

    reconnectAttempts++;
    const delay = reconnectDelay * Math.pow(2, reconnectAttempts - 1); // Exponential backoff

    reconnectTimeout = setTimeout(() => {
      connect();
    }, delay);
  }

  /**
   * Start ping interval to keep connection alive
   */
  function startPingInterval(): void {
    if (pingIntervalId) {
      clearInterval(pingIntervalId);
    }

    pingIntervalId = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping', payload: null, timestamp: Date.now() }));
      }
    }, pingInterval);
  }

  /**
   * Stop ping interval
   */
  function stopPingInterval(): void {
    if (pingIntervalId) {
      clearInterval(pingIntervalId);
      pingIntervalId = null;
    }
  }

  /**
   * Disconnect from WebSocket
   */
  function disconnect(): void {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    stopPingInterval();

    if (socket) {
      socket.close();
      socket = null;
    }

    status.value = 'disconnected';
  }

  /**
   * Send a message through WebSocket
   */
  function send(message: WsMessage): void {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  // Computed properties
  const isConnected = computed(() => status.value === 'connected');
  const isConnecting = computed(() => status.value === 'connecting');
  const hasActiveWorkflows = computed(() => workflows.value.size > 0);

  // Lifecycle hooks
  onMounted(() => {
    connect();
  });

  onUnmounted(() => {
    disconnect();
  });

  return {
    // State
    status,
    stats,
    workflows,
    recentArticles,
    error,

    // Computed
    isConnected,
    isConnecting,
    hasActiveWorkflows,

    // Methods
    connect,
    disconnect,
    send,
  };
}
