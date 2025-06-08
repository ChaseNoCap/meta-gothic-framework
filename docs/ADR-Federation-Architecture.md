# ADR: Federation Architecture with Cosmo Router

## Status
**Accepted and Implemented** - June 2025

## Context

The Meta GOTHIC Framework requires a robust GraphQL architecture to support multiple services with real-time capabilities. After evaluating various approaches including GraphQL stitching, Apollo Federation, and GraphQL Mesh, we have successfully implemented Federation v2 using Cosmo Router.

## Decision

We have adopted **Cosmo Router with Federation v2** as our GraphQL gateway solution, using **Server-Sent Events (SSE)** for real-time subscriptions.

### Key Architectural Decisions:

1. **Cosmo Router** as the federation gateway
2. **Federation v2** protocol for service composition
3. **SSE** for subscription transport (not WebSockets)
4. **Local-first** development with no cloud dependencies
5. **Shared types** across services for consistency
6. **GraphQL-First** API paradigm (REST only for health/webhooks)

### Technology Stack per Service:

- **GraphQL Server**: GraphQL Yoga (production-ready, minimal setup)
- **Performance**: Sub-3ms average query latency achieved
- **Subscriptions**: Native SSE support
- **Type Safety**: Full TypeScript with generated types

## Rationale

### Why Cosmo Router?

1. **Pure Federation v2 Support**: Native implementation without legacy baggage
2. **Local Development**: Runs entirely locally without cloud services
3. **Performance**: Efficient query planning and execution
4. **SSE Support**: Built-in support for Server-Sent Events
5. **Open Source**: No vendor lock-in, community-driven

### Why Federation over Stitching?

1. **Service Autonomy**: Services own their schemas
2. **Type Safety**: Compile-time schema composition
3. **Performance**: Optimized query execution
4. **Scalability**: Better suited for microservices
5. **Industry Standard**: Wide adoption and tooling support

### Why SSE over WebSockets?

1. **Simplicity**: Standard HTTP, no special protocols
2. **Firewall Friendly**: Works through proxies and firewalls
3. **Auto-reconnect**: Built-in reconnection support
4. **Unidirectional**: Perfect for GraphQL subscriptions
5. **Resource Efficient**: Less overhead than WebSockets

## Implementation

### Current Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   UI Dashboard  │     │   CLI Tools     │     │   External Apps │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                         │
         └───────────────────────┴─────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    Cosmo Router         │
                    │  (localhost:4000)       │
                    │                         │
                    │  • Federation Gateway   │
                    │  • Query Planning       │
                    │  • SSE Subscriptions   │
                    └────┬────────────┬───────┘
                         │            │
        ┌────────────────┴───┐    ┌───┴────────────────┐    ┌─────────────────┐
        │                    │    │                    │    │                 │
        ▼                    ▼    ▼                    ▼    ▼                 ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ Claude Service│   │  Git Service  │   │GitHub Adapter │   │ Future Service│
│ (localhost:   │   │ (localhost:   │   │ (localhost:   │   │               │
│    3002)      │   │    3004)      │   │    3005)      │   │               │
│               │   │               │   │               │   │               │
│ • AI Agents   │   │ • Git Ops     │   │ • GitHub API  │   │               │
│ • Sessions    │   │ • File Watch  │   │ • Webhooks    │   │               │
│ • SSE Stream  │   │ • Commits     │   │ • GraphQL     │   │               │
└───────────────┘   └───────────────┘   └───────────────┘   └───────────────┘
```

### Service Configuration

Each service implements Federation v2 with:

```typescript
// Shared federation setup
import { buildCosmoSubgraphSchema } from '@services/shared/federation';

const schema = buildCosmoSubgraphSchema({
  typeDefs,
  resolvers,
});

// SSE endpoint for subscriptions
app.use('/graphql/stream', sseHandler);

// Standard GraphQL endpoint
app.use('/graphql', createYoga({ schema }));
```

### Shared Types Pattern

Services share common types through federation:

```graphql
# Shared across all services
type ServiceHealthStatus {
  status: String!
  timestamp: String!
  service: String!
  version: String!
  uptime: Float!
  memoryUsage: MemoryUsage
}

# Extended by services
extend type Query {
  health: ServiceHealthStatus!
}
```

### SSE Implementation

Real-time subscriptions use Server-Sent Events:

```typescript
// Client connection
const eventSource = new EventSource('/graphql/stream?query=...');

// Server implementation
response.writeHead(200, {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
});

// Send events
response.write(`event: next\ndata: ${JSON.stringify(data)}\n\n`);
```

### Router Configuration

The Cosmo Router configuration:

```yaml
version: '1'

graph:
  name: 'local-federation'

subgraphs:
  - name: 'claude-service'
    url: 'http://localhost:3002/graphql'
    subscriptions:
      url: 'http://localhost:3002/graphql/stream'
      protocol: 'sse'
  
  - name: 'git-service'
    url: 'http://localhost:3004/graphql'
  
  - name: 'github-adapter'
    url: 'http://localhost:3005/graphql'

engine:
  defaultFlushInterval: 1000
  datasources:
    - kind: 'graphql'
      customScalarTypeFields:
        - entityName: '_Any'
          fieldName: ''
          typeName: 'JSON'
```

## Consequences

### Positive

1. **Unified API**: Single GraphQL endpoint for all services
2. **Service Independence**: Services can evolve independently
3. **Type Safety**: Schema composition catches errors early
4. **Real-time Support**: SSE provides efficient subscriptions
5. **Local Development**: No external dependencies
6. **Performance**: Optimized query execution
7. **Monitoring**: Built-in metrics and tracing

### Negative

1. **Complexity**: Federation adds conceptual overhead
2. **Learning Curve**: Developers need to understand federation
3. **Debugging**: Distributed queries can be harder to debug
4. **Version Management**: Services must coordinate schema changes

### Mitigations

1. **Documentation**: Comprehensive guides and examples
2. **Tooling**: Development tools for schema validation
3. **Monitoring**: Detailed logging and tracing
4. **Testing**: Integration tests for federated queries
5. **Conventions**: Clear patterns for common scenarios

## Best Practices

### Service Development

1. **Own Your Schema**: Services define their complete schema
2. **Use Shared Types**: Leverage federation for common types
3. **Version Carefully**: Plan schema changes across services
4. **Test Federation**: Include federation tests in CI/CD
5. **Monitor Performance**: Track resolver performance

### SSE Implementation

1. **Heartbeat**: Send periodic keepalive messages
2. **Error Handling**: Gracefully handle disconnections
3. **Message IDs**: Support resumption after disconnect
4. **Rate Limiting**: Protect against abuse
5. **Compression**: Use gzip for large payloads

### Router Configuration

1. **Health Checks**: Configure health endpoints
2. **Timeouts**: Set appropriate request timeouts
3. **Retries**: Configure retry policies
4. **Caching**: Use query result caching
5. **Security**: Implement authentication/authorization

## Future Considerations

1. **Schema Registry**: Consider schema versioning system
2. **Distributed Tracing**: Implement full request tracing
3. **Performance Optimization**: Query plan caching
4. **Advanced Features**: Implement @defer and @stream
5. **Multi-Region**: Support for distributed deployments

## References

- [Federation v2 Specification](https://www.apollographql.com/docs/federation/federation-spec/)
- [Cosmo Router Documentation](https://cosmo-docs.wundergraph.com/)
- [SSE Specification](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)

## Decision History

- **2025-01**: Migrated from Apollo Server to Cosmo Router
- **2025-02**: Implemented SSE for subscriptions
- **2025-06**: Completed Federation v2 migration
- **2025-06**: Established shared types pattern