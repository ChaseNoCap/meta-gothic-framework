import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { IEventBus, BaseEvent } from '@chasenocap/event-system';
import { createLogger } from '@chasenocap/logger';
import { NodeFileSystem } from '@chasenocap/file-system';
import { fileURLToPath } from 'url';
import type { MetaGothicEvent } from '@meta-gothic/shared-types/event-types';

// Create file system instance
const fileSystem = new NodeFileSystem();

const __dirname = fileSystem.dirname(fileURLToPath(import.meta.url));

const logger = createLogger('websocket-broadcaster', {}, {
  logDir: fileSystem.join(__dirname, '../../../logs/websocket')
});

export interface WebSocketClient {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  correlationId?: string;
}

export class EventBroadcaster {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocketClient> = new Map();
  private eventBus?: IEventBus;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/events'
    });

    this.setupWebSocketServer();
    logger.info('WebSocket event broadcaster initialized', {
      path: '/ws/events'
    });
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      const correlationId = req.headers['x-correlation-id'] as string;
      
      const client: WebSocketClient = {
        id: clientId,
        ws,
        subscriptions: new Set(['*']), // Subscribe to all events by default
        correlationId
      };

      this.clients.set(clientId, client);
      
      logger.info('WebSocket client connected', {
        clientId,
        correlationId,
        totalClients: this.clients.size
      });

      // Send welcome message
      this.sendToClient(client, {
        type: 'websocket.connected',
        timestamp: Date.now(),
        payload: {
          clientId,
          correlationId
        }
      });

      // Handle messages from client
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(client, message);
        } catch (error) {
          logger.error('Invalid WebSocket message', error as Error, { clientId });
          this.sendToClient(client, {
            type: 'websocket.error',
            timestamp: Date.now(),
            payload: {
              error: 'Invalid message format'
            }
          });
        }
      });

      // Handle disconnection
      ws.on('close', () => {
        this.clients.delete(clientId);
        logger.info('WebSocket client disconnected', {
          clientId,
          remainingClients: this.clients.size
        });
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error('WebSocket client error', error, { clientId });
        this.clients.delete(clientId);
      });
    });
  }

  private handleClientMessage(client: WebSocketClient, message: any) {
    const { type, payload } = message;

    switch (type) {
      case 'subscribe':
        this.handleSubscribe(client, payload);
        break;
      case 'unsubscribe':
        this.handleUnsubscribe(client, payload);
        break;
      case 'ping':
        this.sendToClient(client, {
          type: 'pong',
          timestamp: Date.now(),
          payload: { echo: payload }
        });
        break;
      default:
        logger.warn('Unknown message type', { 
          clientId: client.id, 
          type 
        });
    }
  }

  private handleSubscribe(client: WebSocketClient, payload: any) {
    const { eventTypes = [], correlationId } = payload;
    
    // Update correlation ID if provided
    if (correlationId) {
      client.correlationId = correlationId;
    }

    // Add event type subscriptions
    eventTypes.forEach((eventType: string) => {
      client.subscriptions.add(eventType);
    });

    logger.debug('Client subscribed to events', {
      clientId: client.id,
      eventTypes,
      totalSubscriptions: client.subscriptions.size
    });

    this.sendToClient(client, {
      type: 'websocket.subscribed',
      timestamp: Date.now(),
      payload: {
        eventTypes,
        subscriptions: Array.from(client.subscriptions)
      }
    });
  }

  private handleUnsubscribe(client: WebSocketClient, payload: any) {
    const { eventTypes = [] } = payload;
    
    eventTypes.forEach((eventType: string) => {
      client.subscriptions.delete(eventType);
    });

    logger.debug('Client unsubscribed from events', {
      clientId: client.id,
      eventTypes,
      remainingSubscriptions: client.subscriptions.size
    });

    this.sendToClient(client, {
      type: 'websocket.unsubscribed',
      timestamp: Date.now(),
      payload: {
        eventTypes,
        subscriptions: Array.from(client.subscriptions)
      }
    });
  }

  public setEventBus(eventBus: IEventBus) {
    this.eventBus = eventBus;
    
    // Subscribe to all events
    this.eventBus.on('*', (event) => {
      this.broadcastEvent(event as MetaGothicEvent);
    });

    logger.info('Event bus connected to WebSocket broadcaster');
  }

  private broadcastEvent(event: MetaGothicEvent) {
    const eventLogger = logger.child({ 
      eventType: event.type,
      correlationId: event.payload?.correlationId 
    });

    let broadcastCount = 0;

    this.clients.forEach((client) => {
      // Check if client should receive this event
      if (this.shouldSendToClient(client, event)) {
        this.sendToClient(client, event);
        broadcastCount++;
      }
    });

    if (broadcastCount > 0) {
      eventLogger.debug('Event broadcasted to clients', {
        clientCount: broadcastCount,
        totalClients: this.clients.size
      });
    }
  }

  private shouldSendToClient(client: WebSocketClient, event: MetaGothicEvent): boolean {
    // Check if client subscribed to all events
    if (client.subscriptions.has('*')) {
      return true;
    }

    // Check if client subscribed to this specific event type
    if (client.subscriptions.has(event.type)) {
      return true;
    }

    // Check if client subscribed to event category
    const eventCategory = event.type.split('.')[0];
    if (client.subscriptions.has(`${eventCategory}.*`)) {
      return true;
    }

    // Check correlation ID match
    if (client.correlationId && event.payload?.correlationId === client.correlationId) {
      return true;
    }

    return false;
  }

  private sendToClient(client: WebSocketClient, data: BaseEvent) {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(data));
      } catch (error) {
        logger.error('Failed to send to client', error as Error, {
          clientId: client.id
        });
        // Remove client on send error
        this.clients.delete(client.id);
      }
    }
  }

  private generateClientId(): string {
    return `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public getClientCount(): number {
    return this.clients.size;
  }

  public getClientInfo(): Array<{ id: string; subscriptions: string[]; correlationId?: string }> {
    return Array.from(this.clients.values()).map(client => ({
      id: client.id,
      subscriptions: Array.from(client.subscriptions),
      ...(client.correlationId ? { correlationId: client.correlationId } : {})
    }));
  }
}