# ADR-008: Event-Driven Architecture for Service Communication

**Date**: 2025-01-27  
**Status**: Proposed  
**Decision Makers**: metaGOTHIC Framework Team  

## Context

The metaGOTHIC framework consists of multiple services that need to communicate efficiently while maintaining loose coupling. Services must handle GitHub webhooks, AI streaming responses, and cross-service notifications.

### Current State
- H1B project uses direct function calls within single process
- Event-system package provides decorators for testing
- No existing multi-service communication infrastructure
- Need real-time updates across services

### Problem Statement
We need a communication pattern that:
1. Maintains loose coupling between services
2. Supports real-time event propagation
3. Handles both synchronous and asynchronous workflows
4. Provides reliable message delivery
5. Enables event sourcing and replay
6. Integrates with GraphQL subscriptions

### Requirements
- **Decoupling**: Services can evolve independently
- **Reliability**: Guaranteed message delivery options
- **Performance**: Low-latency event propagation
- **Scalability**: Handles high event volumes
- **Observability**: Event tracking and debugging
- **Integration**: Works with GraphQL subscriptions

## Decision

Adopt an **Event-Driven Architecture** using Redis Pub/Sub for real-time events and Redis Streams for persistent events.

### Chosen Solution

#### Event Categories

**1. Real-time Events (Redis Pub/Sub)**
```typescript
// For immediate notifications, UI updates
interface RealtimeEvent {
  type: 'repository.updated' | 'ai.response.chunk' | 'build.status';
  payload: any;
  timestamp: Date;
  correlationId: string;
}

// Publishing
await pubsub.publish('repository.updated', {
  repository: 'ChaseNoCap/logger',
  version: '1.0.9',
  publisher: 'github-webhook'
});

// Subscribing
pubsub.subscribe('repository.*', (event) => {
  // Update UI, invalidate cache, etc.
});
```

**2. Persistent Events (Redis Streams)**
```typescript
// For audit trails, event sourcing, replay
interface PersistentEvent {
  id: string;  // Redis stream ID
  type: 'sdlc.phase.changed' | 'package.published';
  aggregate: { type: string; id: string };
  payload: any;
  metadata: EventMetadata;
}

// Writing to stream
await redis.xadd(
  'events:sdlc',
  '*',
  'type', 'phase.changed',
  'payload', JSON.stringify(eventData)
);

// Reading from stream
const events = await redis.xread(
  'BLOCK', 0,
  'STREAMS', 'events:sdlc', lastEventId
);
```

#### Integration with GraphQL

**1. Subscription Bridge**
```typescript
// Bridge Redis events to GraphQL subscriptions
class EventSubscriptionBridge {
  constructor(
    private pubsub: PubSub,
    private redis: Redis
  ) {
    this.bridgeEvents();
  }
  
  private bridgeEvents() {
    // Redis Pub/Sub → GraphQL subscriptions
    this.redis.subscribe('repository.*', (channel, message) => {
      const event = JSON.parse(message);
      this.pubsub.publish('REPOSITORY_UPDATED', {
        repositoryUpdated: event.payload
      });
    });
  }
}
```

**2. Event-Triggered Queries**
```typescript
// Invalidate GraphQL cache on events
eventBus.on('repository.updated', async (event) => {
  // Clear DataLoader cache
  repositoryLoader.clear(event.repositoryId);
  
  // Clear Redis cache
  await cache.invalidate(`repo:${event.repositoryId}:*`);
  
  // Notify subscribers
  await pubsub.publish('REPOSITORY_UPDATED', event);
});
```

### Implementation Architecture

```yaml
Event Flow:
  1. GitHub Webhook:
     → repo-agent-service
     → Validates & processes
     → Publishes event
     
  2. Event Distribution:
     → Redis Pub/Sub (real-time)
     → Redis Streams (persistent)
     → GraphQL subscriptions
     
  3. Service Reactions:
     → meta-gothic-app: Updates UI
     → claude-service: Invalidates context
     → repo-agent: Updates cache

Event Types:
  System Events:
    - service.started
    - service.health.changed
    - error.occurred
    
  Domain Events:
    - repository.updated
    - package.published
    - sdlc.phase.changed
    
  AI Events:
    - ai.session.started
    - ai.response.chunk
    - ai.context.loaded
```

#### Event Handler Pattern
```typescript
@injectable()
export class RepositoryEventHandler {
  constructor(
    @inject(TYPES.EventBus) private eventBus: IEventBus,
    @inject(TYPES.Logger) private logger: ILogger
  ) {
    this.registerHandlers();
  }
  
  private registerHandlers() {
    this.eventBus.on('github.push', this.handlePush.bind(this));
    this.eventBus.on('github.pr.opened', this.handlePR.bind(this));
  }
  
  @Emits('repository.analyzed')
  private async handlePush(event: GitHubPushEvent) {
    const analysis = await this.analyzeChanges(event);
    return { repository: event.repository, analysis };
  }
}
```

## Alternatives Considered

### Option 1: Direct HTTP/GraphQL Calls
- **Pros**: Simple, synchronous, easy debugging
- **Cons**: Tight coupling, cascade failures, no replay
- **Reason for rejection**: Creates brittle service dependencies

### Option 2: Message Queue (RabbitMQ/Kafka)
- **Pros**: Robust, feature-rich, guaranteed delivery
- **Cons**: Operational complexity, additional infrastructure
- **Reason for rejection**: Overkill for current scale, adds complexity

### Option 3: AWS EventBridge / Google Pub/Sub
- **Pros**: Managed service, scalable, integrated
- **Cons**: Vendor lock-in, costs, latency
- **Reason for rejection**: Want to maintain platform independence

## Consequences

### Positive
- ✅ **Loose Coupling**: Services remain independent
- ✅ **Scalability**: Easy to add new event consumers
- ✅ **Flexibility**: Mix real-time and persistent events
- ✅ **Debugging**: Event stream provides audit trail
- ✅ **Performance**: Redis provides low latency
- ✅ **Integration**: Natural GraphQL subscription bridge

### Negative
- ⚠️ **Complexity**: Asynchronous flows harder to reason about
- ⚠️ **Debugging**: Distributed tracing required
- ⚠️ **Consistency**: Eventual consistency challenges

### Risks & Mitigations
- **Risk**: Event ordering issues
  - **Mitigation**: Use Redis Streams for ordered delivery
  
- **Risk**: Event storms overwhelming services
  - **Mitigation**: Rate limiting, circuit breakers, backpressure
  
- **Risk**: Lost events in Pub/Sub
  - **Mitigation**: Use Streams for critical events, monitoring

## Validation

### Success Criteria
- [ ] <10ms event propagation latency
- [ ] 99.9% event delivery reliability
- [ ] Support 10k events/second
- [ ] Event replay capability working
- [ ] GraphQL subscriptions integrated

### Testing Approach
- Event flow integration tests
- Load testing event throughput
- Failure scenario testing
- Event ordering validation
- Subscription latency measurement

## References

- [Redis Pub/Sub Documentation](https://redis.io/docs/manual/pubsub/)
- [Redis Streams Introduction](https://redis.io/docs/data-types/streams/)
- [Event-Driven Architecture Patterns](https://martinfowler.com/articles/201701-event-driven.html)
- [GraphQL Subscriptions](https://graphql.org/blog/subscriptions-in-graphql-and-relay/)

## Changelog

- **2025-01-27**: Initial draft for event-driven architecture