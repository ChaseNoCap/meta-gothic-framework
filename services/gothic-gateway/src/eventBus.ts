import { EventBus, IEventBus, BaseEvent } from '@chasenocap/event-system';
import { createLogger, ILogger } from '@chasenocap/logger';
import { NodeFileSystem } from '@chasenocap/file-system';
import { fileURLToPath } from 'url';
import type { MetaGothicEvent } from '../../shared/event-types';

// Create file system instance
const fileSystem = new NodeFileSystem();

const __dirname = fileSystem.dirname(fileURLToPath(import.meta.url));

// Create a logger specifically for events
const eventLogger = createLogger('gateway-events', {}, {
  logDir: fileSystem.join(__dirname, '../../logs/events')
});

// Create event bus with logging middleware
class LoggingEventBus extends EventBus {
  private logger: ILogger;
  private correlationId?: string;
  private wildcardHandlers: Array<(event: BaseEvent) => void> = [];

  constructor(logger: ILogger) {
    super();
    this.logger = logger;
  }
  
  override on(eventType: string, handler: (event: BaseEvent) => void): void {
    if (eventType === '*') {
      this.wildcardHandlers.push(handler);
    } else {
      super.on(eventType, handler);
    }
  }

  setCorrelationId(correlationId: string) {
    this.correlationId = correlationId;
  }

  override emit(event: MetaGothicEvent): void {
    // Log the event
    const eventLogger = this.logger.child({
      correlationId: this.correlationId || event.payload?.correlationId,
      eventType: event.type
    });

    // Log based on event type
    if (event.type.includes('.failed') || event.type.includes('.error')) {
      eventLogger.error('Event emitted', null as any, {
        event: {
          type: event.type,
          payload: event.payload,
          timestamp: event.timestamp
        }
      });
    } else if (event.type.includes('.started')) {
      eventLogger.info('Event emitted', {
        event: {
          type: event.type,
          payload: event.payload,
          timestamp: event.timestamp
        }
      });
    } else if (event.type.includes('.completed')) {
      eventLogger.info('Event emitted', {
        event: {
          type: event.type,
          payload: event.payload,
          timestamp: event.timestamp,
          duration: (event.payload as any)?.duration
        }
      });
    } else if (event.type.startsWith('performance.')) {
      eventLogger.warn('Performance event', {
        event: {
          type: event.type,
          payload: event.payload,
          timestamp: event.timestamp
        }
      });
    } else if (event.type.startsWith('github.')) {
      eventLogger.info('GitHub API event', {
        event: {
          type: event.type,
          payload: event.payload,
          timestamp: event.timestamp
        }
      });
    } else {
      eventLogger.debug('Event emitted', {
        event: {
          type: event.type,
          payload: event.payload,
          timestamp: event.timestamp
        }
      });
    }

    // Call parent emit
    super.emit(event);
    
    // Also emit to wildcard handlers
    this.wildcardHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        this.logger.error('Error in wildcard event handler', error as Error);
      }
    });
  }
}

// Create singleton event bus
export const eventBus = new LoggingEventBus(eventLogger);

// Helper to create request-scoped event bus
export function createRequestEventBus(correlationId: string): LoggingEventBus {
  const bus = new LoggingEventBus(eventLogger);
  bus.setCorrelationId(correlationId);
  
  // Forward all events from request bus to global bus for WebSocket broadcasting
  bus.on('*', (event) => {
    eventBus.emit(event as MetaGothicEvent);
  });
  
  return bus;
}

// Subscribe to performance events
eventBus.on('performance.slowOperation.detected', (event) => {
  const { service, operation, duration, threshold } = event.payload as any;
  eventLogger.warn('Slow operation detected', {
    service,
    operation,
    duration,
    threshold,
    exceededBy: duration - threshold
  });
});

// Subscribe to GitHub API events for rate limit monitoring
eventBus.on('github.api.completed', (event) => {
  const { endpoint, rateLimitRemaining } = event.payload as any;
  
  if (rateLimitRemaining && rateLimitRemaining < 100) {
    eventLogger.warn('GitHub API rate limit low', {
      endpoint,
      rateLimitRemaining
    });
  }
});

// Subscribe to GraphQL federation events
eventBus.on('graphql.query.started', (event) => {
  const { operationName, correlationId } = event.payload as any;
  eventLogger.debug('GraphQL operation started', {
    operationName,
    correlationId
  });
});

// Export typed event bus
export const typedEventBus: IEventBus = eventBus;