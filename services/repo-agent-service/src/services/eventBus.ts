import { EventBus, IEventBus } from '@chasenocap/event-system';
import { createLogger, ILogger } from '@chasenocap/logger';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { MetaGothicEvent } from '../../../shared/event-types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Create a logger specifically for events
const eventLogger = createLogger('repo-agent-events', {}, {
  logDir: join(__dirname, '../../../../logs/events')
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
    } else if (event.type.includes('.started') || event.type.includes('.queried')) {
      eventLogger.info('Event emitted', {
        event: {
          type: event.type,
          payload: event.payload,
          timestamp: event.timestamp
        }
      });
    } else if (event.type.includes('.completed') || event.type.includes('.created')) {
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

// Subscribe to git operation events for monitoring
eventBus.on('repo.commit.created', (event) => {
  const { path, commitHash, message } = event.payload as any;
  eventLogger.info('Commit created', {
    path,
    commitHash,
    messagePreview: message?.substring(0, 50)
  });
});

eventBus.on('repo.push.completed', (event) => {
  const { path, branch, remote } = event.payload as any;
  eventLogger.info('Push completed', { path, branch, remote });
});

// Export typed event bus
export const typedEventBus: IEventBus = eventBus;