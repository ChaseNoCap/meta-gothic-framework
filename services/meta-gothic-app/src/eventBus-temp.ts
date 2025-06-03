// Temporary event bus implementation without external dependencies

interface BaseEvent {
  type: string;
  payload?: any;
  timestamp?: Date;
  correlationId?: string;
  serviceName?: string;
}

class SimpleEventBus {
  private handlers: Map<string, Array<(event: BaseEvent) => void>> = new Map();
  private wildcardHandlers: Array<(event: BaseEvent) => void> = [];
  private correlationId?: string;

  on(eventType: string, handler: (event: BaseEvent) => void): void {
    if (eventType === '*') {
      this.wildcardHandlers.push(handler);
    } else {
      const handlers = this.handlers.get(eventType) || [];
      handlers.push(handler);
      this.handlers.set(eventType, handlers);
    }
  }

  off(eventType: string, handler: (event: BaseEvent) => void): void {
    if (eventType === '*') {
      this.wildcardHandlers = this.wildcardHandlers.filter(h => h !== handler);
    } else {
      const handlers = this.handlers.get(eventType) || [];
      this.handlers.set(eventType, handlers.filter(h => h !== handler));
    }
  }

  setCorrelationId(correlationId: string) {
    this.correlationId = correlationId;
  }

  emit(event: BaseEvent): void {
    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = new Date();
    }

    // Add correlation ID if available
    if (this.correlationId && !event.correlationId) {
      event.correlationId = this.correlationId;
    }

    // Emit to specific handlers
    const handlers = this.handlers.get(event.type) || [];
    handlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in event handler:', error);
      }
    });

    // Emit to wildcard handlers
    this.wildcardHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in wildcard event handler:', error);
      }
    });
  }
}

// Create singleton event bus
export const eventBus = new SimpleEventBus();

// Helper to create request-scoped event bus
export function createRequestEventBus(correlationId: string): SimpleEventBus {
  const bus = new SimpleEventBus();
  bus.setCorrelationId(correlationId);
  
  // Forward all events from request bus to global bus
  bus.on('*', (event) => {
    eventBus.emit(event);
  });
  
  return bus;
}

// Export typed event bus (using interface compatible with the real one)
export const typedEventBus = eventBus;