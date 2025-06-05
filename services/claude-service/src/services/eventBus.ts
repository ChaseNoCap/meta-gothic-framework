import { EventBus, IEventBus } from '@chasenocap/event-system';
import { createLogger, ILogger } from '@chasenocap/logger';
import { NodeFileSystem } from '@chasenocap/file-system';
import { fileURLToPath } from 'url';
import type { MetaGothicEvent } from '@meta-gothic/shared-types/event-types';

// Create file system instance
const fileSystem = new NodeFileSystem();

const __dirname = fileSystem.dirname(fileURLToPath(import.meta.url));

// Create a logger specifically for events
const eventLogger = createLogger('claude-service-events', {}, {
  logDir: fileSystem.join(__dirname, '../../../logs/events')
});

// Create event bus with logging middleware
class LoggingEventBus extends EventBus {
  private logger: ILogger;
  private correlationId?: string;

  constructor(logger: ILogger) {
    super();
    this.logger = logger;
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
      eventLogger.error('Event emitted', {
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
          duration: event.payload?.duration
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
  }
}

// Create singleton event bus
export const eventBus = new LoggingEventBus(eventLogger);

// Helper to create request-scoped event bus
export function createRequestEventBus(correlationId: string): LoggingEventBus {
  const bus = new LoggingEventBus(eventLogger);
  bus.setCorrelationId(correlationId);
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

// Subscribe to error events
eventBus.on('claude.session.failed', (event) => {
  const { sessionId, error } = event.payload as any;
  eventLogger.error('Claude session failed', {
    sessionId,
    error
  });
});


// Export typed event bus
export const typedEventBus: IEventBus = eventBus;