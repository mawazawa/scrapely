/**
 * Durable Object for real-time WebSocket updates
 * Broadcasts processing stats and workflow progress to connected clients
 *
 * @see https://developers.cloudflare.com/durable-objects/
 */

import { DurableObject } from 'cloudflare:workers';

/**
 * Message types for WebSocket communication
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
  processingRate: number; // articles per minute
  startedAt: number;
}

export interface WorkflowPayload {
  workflowId: string;
  workflowType: 'rss' | 'articles' | 'newsletter';
  step: string;
  status: 'started' | 'completed' | 'failed';
  progress?: number; // 0-100
  message?: string;
}

export interface ArticlePayload {
  articleId: number;
  title: string;
  url: string;
  status: 'processing' | 'completed' | 'failed';
  relevance?: 'RELEVANT' | 'IRRELEVANT' | 'SOMEWHAT_RELEVANT';
}

/**
 * StatsRoom Durable Object
 * Manages WebSocket connections for real-time updates
 */
export class StatsRoom extends DurableObject {
  private sessions: Set<WebSocket>;
  private lastStats: StatsPayload | null;

  constructor(state: DurableObjectState, env: unknown) {
    super(state, env);
    this.sessions = new Set();
    this.lastStats = null;
  }

  /**
   * Handle incoming HTTP requests (WebSocket upgrade)
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Accept the WebSocket and add to sessions
      this.ctx.acceptWebSocket(server);
      this.sessions.add(server);

      // Send current stats immediately if available
      if (this.lastStats) {
        this.send(server, { type: 'stats', payload: this.lastStats, timestamp: Date.now() });
      }

      return new Response(null, { status: 101, webSocket: client });
    }

    // Handle HTTP endpoints for pushing updates from workers
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      try {
        const message = (await request.json()) as WsMessage;
        this.broadcast(message);
        return new Response(JSON.stringify({ success: true, connections: this.sessions.size }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Invalid message' }), { status: 400 });
      }
    }

    if (url.pathname === '/stats') {
      return new Response(
        JSON.stringify({
          connections: this.sessions.size,
          lastStats: this.lastStats,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('Not found', { status: 404 });
  }

  /**
   * Handle WebSocket messages from clients
   */
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    try {
      const data = JSON.parse(message.toString()) as WsMessage;

      switch (data.type) {
        case 'ping':
          this.send(ws, { type: 'pong', payload: null, timestamp: Date.now() });
          break;
        default:
          // Log unknown message types but don't error
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      this.send(ws, { type: 'error', payload: 'Invalid message format', timestamp: Date.now() });
    }
  }

  /**
   * Handle WebSocket close
   */
  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): void {
    this.sessions.delete(ws);
    console.log(`WebSocket closed: code=${code}, reason=${reason}, clean=${wasClean}`);
  }

  /**
   * Handle WebSocket error
   */
  webSocketError(ws: WebSocket, error: unknown): void {
    console.error('WebSocket error:', error);
    this.sessions.delete(ws);
  }

  /**
   * Send a message to a specific WebSocket
   */
  private send(ws: WebSocket, message: WsMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send message:', error);
      this.sessions.delete(ws);
    }
  }

  /**
   * Broadcast a message to all connected clients
   */
  private broadcast(message: WsMessage): void {
    // Store stats for new connections
    if (message.type === 'stats') {
      this.lastStats = message.payload as StatsPayload;
    }

    const deadSessions: WebSocket[] = [];

    for (const ws of this.sessions) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        deadSessions.push(ws);
      }
    }

    // Clean up dead sessions
    for (const ws of deadSessions) {
      this.sessions.delete(ws);
    }
  }

  /**
   * Broadcast stats update
   */
  broadcastStats(stats: StatsPayload): void {
    this.broadcast({ type: 'stats', payload: stats, timestamp: Date.now() });
  }

  /**
   * Broadcast workflow update
   */
  broadcastWorkflow(workflow: WorkflowPayload): void {
    this.broadcast({ type: 'workflow', payload: workflow, timestamp: Date.now() });
  }

  /**
   * Broadcast article update
   */
  broadcastArticle(article: ArticlePayload): void {
    this.broadcast({ type: 'article', payload: article, timestamp: Date.now() });
  }
}
