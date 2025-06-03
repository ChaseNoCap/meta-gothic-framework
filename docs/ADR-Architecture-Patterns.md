# ADR-Architecture-Patterns: Core Framework Patterns

**Status**: Proposed (Partially Implemented)  
**Date**: Consolidated 2025-01-06  
**Combines**: ADR-006, ADR-008, ADR-009

## Executive Summary

The metaGOTHIC framework follows the GOTHIC pattern (GitHub Orchestrated Tooling for Hierarchical Intelligent Containers), uses event-driven architecture for service communication, and implements a multi-layer caching strategy for optimal performance.

## Context

Building a modern AI-assisted development framework requires thoughtful architecture patterns that balance flexibility, performance, and developer experience. The framework needs to handle real-time updates, cache efficiently, and integrate seamlessly with AI tools.

## Decision

### 1. GOTHIC Pattern Architecture

**GOTHIC**: GitHub Orchestrated Tooling for Hierarchical Intelligent Containers

**Core Principles**:
- **GitHub-Native**: Built on GitHub's ecosystem (Actions, Packages, API)
- **Orchestrated**: Automated workflows coordinate all activities
- **Hierarchical**: Nested package structure with clear dependencies
- **Intelligent**: AI-first design with Claude integration
- **Containerized**: Each component deployable as container

**Implementation**:
```
metaGOTHIC/
├── packages/          # Hierarchical packages
│   ├── ai/          # Intelligence layer
│   ├── tools/       # Tooling layer
│   └── ui/          # Interface layer
├── services/        # Orchestrated services
└── workflows/       # GitHub automation
```

### 2. Event-Driven Architecture

**Communication Pattern**: Redis Pub/Sub + GraphQL Subscriptions

```typescript
// Event emission
redis.publish('package:updated', {
  package: 'prompt-toolkit',
  version: '1.2.0',
  timestamp: Date.now()
});

// GraphQL subscription bridge
subscription onPackageUpdate {
  packageUpdated {
    package
    version
    changes
  }
}
```

**Event Categories**:
1. **Package Events**: publish, update, deprecate
2. **Build Events**: start, success, failure
3. **Service Events**: health, metrics, errors
4. **User Events**: actions, preferences

**Benefits**:
- Loose coupling between services
- Real-time updates to UI
- Audit trail of all actions
- Easy to add new consumers

### 3. Multi-Layer Caching Strategy

**Three-Layer Architecture**:

```typescript
// Layer 1: Request-level (DataLoader)
const userLoader = new DataLoader(keys => 
  batchGetUsers(keys)
);

// Layer 2: Application memory (LRU)
const cache = new LRU<string, any>({
  max: 500,
  ttl: 1000 * 60 * 5 // 5 minutes
});

// Layer 3: Distributed (Redis)
await redis.setex(
  'github:user:123',
  3600,
  JSON.stringify(userData)
);
```

**Cache Invalidation**:
- Event-driven invalidation
- TTL-based expiration
- Tag-based clearing
- Manual refresh capability

**Cache Hierarchy**:
1. **DataLoader**: Per-request deduplication
2. **LRU Memory**: Frequently accessed data
3. **Redis**: Shared across instances
4. **CDN**: Static assets and responses

## Implementation Examples

### Event System Setup

```typescript
// Event emitter service
class EventService {
  constructor(private redis: Redis) {}
  
  async emit(event: string, data: any) {
    // Local handling
    this.handleLocal(event, data);
    
    // Distributed broadcast
    await this.redis.publish(event, JSON.stringify({
      ...data,
      timestamp: Date.now(),
      source: process.env.SERVICE_NAME
    }));
  }
}
```

### Cache Configuration

```yaml
# GraphQL Mesh cache config
transforms:
  - cache:
    - field: Query.githubRepositories
      ttl: 300000  # 5 minutes
      cacheKey: 'owner,page'
    - field: Query.gitStatus
      ttl: 60000   # 1 minute
      cacheKey: 'path'
```

### GOTHIC Implementation

```typescript
// AI-first API design
const prompt = await generatePrompt({
  template: 'code-review',
  context: await loadContext(),
  constraints: getTokenLimits()
});

// Hierarchical package loading
const packages = await loadPackages({
  root: 'metaGOTHIC',
  depth: 2,
  filter: pkg => pkg.ai.enabled
});
```

## Architecture Benefits

### 1. Scalability
- Horizontal scaling via event distribution
- Cache reduces database load
- Stateless services

### 2. Performance  
- Multi-layer caching minimizes latency
- Event-driven updates prevent polling
- Optimized for AI token limits

### 3. Developer Experience
- Clear patterns and conventions
- Self-documenting architecture
- AI assistance built-in

## Consequences

### Positive
- **Flexibility**: Easy to add new services
- **Performance**: Sub-second response times
- **Reliability**: Graceful degradation
- **Observability**: Event stream provides insights

### Negative
- **Complexity**: Multiple moving parts
- **Cache Consistency**: Potential stale data
- **Learning Curve**: New patterns to learn

### Mitigations
- Comprehensive documentation
- Monitoring and alerting
- Gradual rollout of features
- Training and examples

## Future Enhancements

1. **Event Sourcing**: Full audit trail
2. **CQRS Pattern**: Separate read/write models  
3. **Service Mesh**: Advanced networking
4. **Edge Computing**: Global distribution

## Status

- **GOTHIC Pattern**: Conceptual framework established
- **Event System**: Partially implemented (GraphQL subscriptions working)
- **Caching**: Basic implementation (response cache in gateway)

Next steps focus on full Redis integration and event bridge completion.

## References

- [Event-Driven Architecture](https://martinfowler.com/articles/201701-event-driven.html)
- [Caching Best Practices](https://aws.amazon.com/caching/best-practices/)
- [GraphQL Subscriptions](https://graphql.org/blog/subscriptions-in-graphql-and-relay/)