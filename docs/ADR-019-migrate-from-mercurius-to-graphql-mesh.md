# ADR-019: Migrate from Mercurius to Enable Full GraphQL Mesh Capabilities

**Date**: 2025-06-03  
**Status**: Accepted  
**Supersedes**: ADR-013 (Mercurius Over Apollo), ADR-018 (GraphQL Mesh for Federation)  
**Decision Makers**: metaGOTHIC Framework Team  

## Context

After implementing manual federation with Mercurius and attempting GraphQL Mesh integration, we discovered fundamental incompatibilities between Mercurius and GraphQL Mesh's introspection requirements. Since we control all services in our architecture, we have the opportunity to fully embrace GraphQL Mesh by migrating away from Mercurius.

### Current State
- Three GraphQL services implemented with Mercurius + Fastify
- Manual federation working but requires custom resolver code
- GraphQL Mesh introspection fails with Mercurius ("Cannot read properties of undefined (reading '__schema')")
- Performance is excellent with Mercurius (5x faster than Apollo)
- All services are internal to metaGOTHIC framework

### Problem Statement
We need to decide whether to:
1. Keep Mercurius with manual federation (working, fast, but limited)
2. Migrate all services to GraphQL Mesh-compatible servers (Yoga/Apollo) for automatic federation

### Key Insight
Since we control all services, we can standardize on a GraphQL Mesh-compatible stack and gain:
- Automatic federation with no manual resolver code
- Multi-source federation capabilities (REST, gRPC, databases)
- Advanced caching and optimization features
- Future flexibility for non-GraphQL data sources

## Decision

**Migrate all GraphQL services from Mercurius to GraphQL Yoga** to enable full GraphQL Mesh capabilities.

### Migration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                meta-gothic-app (Port 3000)                  │
│                GraphQL Mesh Gateway                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           @graphql-mesh/runtime                     │   │
│  │  • Automatic federation detection                   │   │
│  │  • Multi-source federation                          │   │
│  │  • Advanced caching & optimization                  │   │
│  │  • Plugin ecosystem                                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
           │                           │
           ▼                           ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│  repo-agent-service     │  │    claude-service       │
│     (Port 3004)         │  │     (Port 3002)         │
│                         │  │                         │
│ ┌─────────────────────┐ │  │ ┌─────────────────────┐ │
│ │ GraphQL Yoga         │ │  │ │ GraphQL Yoga         │ │
│ │ + Fastify Plugin     │ │  │ │ + Fastify Plugin     │ │
│ │ + Performance Plugins│ │  │ │ + Performance Plugins│ │
│ │ Federation v2.10     │ │  │ │ Federation v2.10     │ │
│ └─────────────────────┘ │  │ └─────────────────────┘ │
└─────────────────────────┘  └─────────────────────────┘
```

### GraphQL Yoga Configuration

```typescript
// Optimized Yoga setup to minimize performance loss
import { createYoga } from 'graphql-yoga'
import { useResponseCache } from '@graphql-yoga/plugin-response-cache'
import { useDataLoader } from '@graphql-yoga/plugin-dataloader'
import { useJIT } from '@graphql-yoga/plugin-jit'

const yoga = createYoga({
  schema,
  plugins: [
    useJIT(),              // JIT compilation like Mercurius
    useResponseCache({     // Response caching
      ttl: 300,
      invalidateViaMutation: true
    }),
    useDataLoader(),       // N+1 query prevention
    useAPQ(),             // Automatic persisted queries
    useParserCache(),     // Parse caching
    useValidationCache()  // Validation caching
  ]
})

// Fastify integration remains
app.route({
  url: '/graphql',
  method: ['GET', 'POST'],
  handler: async (req, reply) => {
    const response = await yoga.handle(req, reply)
    return response
  }
})
```

## Alternatives Considered

### Option 1: Keep Mercurius with Manual Federation (Status Quo)
- **Pros**: 5x performance, working solution, no refactoring
- **Cons**: Manual federation code, limited features, no automatic optimization
- **Rejected**: Missing out on GraphQL Mesh benefits when we control all services

### Option 2: Custom Mercurius-Mesh Adapter
- **Pros**: Keep Mercurius performance, maybe get Mesh working
- **Cons**: Complex maintenance, uncertain outcome, fighting tools
- **Rejected**: Too much effort for uncertain benefits

### Option 3: Switch to WunderGraph Cosmo
- **Pros**: 10x performance (Go-based), works with any GraphQL server
- **Cons**: Separate process, different ecosystem, less integrated
- **Deferred**: Consider if Yoga performance insufficient

## Implementation Plan

### Phase 1: Service Migration (Week 1-2)

#### 1. Migrate repo-agent-service
```typescript
// FROM: Mercurius
await app.register(mercurius, { schema, resolvers })

// TO: GraphQL Yoga
const yoga = createYoga({ 
  schema,
  plugins: [performancePlugins] 
})
app.route({ url: '/graphql', handler: yoga })
```

**Tasks**:
- [ ] Install GraphQL Yoga and plugins
- [ ] Migrate resolver patterns
- [ ] Update subscription handling
- [ ] Maintain Federation v2.10 directives
- [ ] Test all queries/mutations
- [ ] Benchmark performance impact

#### 2. Migrate claude-service
- [ ] Same migration pattern as repo-agent
- [ ] Special attention to subscription streams
- [ ] Maintain WebSocket compatibility
- [ ] Test real-time features

#### 3. Migrate meta-gothic-app gateway
- [ ] Remove manual federation resolvers
- [ ] Install GraphQL Mesh CLI
- [ ] Configure mesh.config.ts
- [ ] Enable automatic detection
- [ ] Test cross-service queries

### Phase 2: GraphQL Mesh Configuration (Week 2)

```typescript
// mesh.config.ts
import { defineConfig } from '@graphql-mesh/compose-cli'

export default defineConfig({
  subgraphs: [
    {
      name: 'repo-agent',
      endpoint: 'http://localhost:3004/graphql',
      // Automatic introspection - no schema needed!
    },
    {
      name: 'claude',
      endpoint: 'http://localhost:3002/graphql',
    }
  ],
  
  serve: {
    fastify: true,
    port: 3000,
    cors: { origin: true },
    graphiql: true
  },
  
  // Advanced features now available
  transforms: [
    {
      name: 'cache',
      config: {
        field: [
          { type: 'Query', field: 'repository', ttl: 300 },
          { type: 'Query', field: 'sessions', ttl: 60 }
        ]
      }
    },
    {
      name: 'rateLimit',
      config: {
        type: 'Query',
        field: 'generateCommitMessages',
        max: 10,
        window: '1m'
      }
    }
  ],
  
  plugins: [
    {
      name: 'prometheus',
      config: { endpoint: '/metrics' }
    }
  ]
})
```

### Phase 3: Leverage Advanced Features (Week 3)

1. **Multi-Source Federation**
   ```typescript
   sources: [
     { name: 'github-rest', handler: { openapi: { source: './github-api.yaml' } } },
     { name: 'npm-registry', handler: { graphql: { endpoint: 'https://npm.io/graphql' } } }
   ]
   ```

2. **Cross-Source Relationships**
   ```typescript
   additionalTypeDefs: `
     extend type Repository {
       npmPackage: Package @resolveTo(
         sourceName: "npm-registry",
         sourceFieldName: "package",
         keyField: "name",
         keysArg: "names"
       )
     }
   `
   ```

3. **Performance Monitoring**
   - Built-in tracing
   - Query complexity analysis
   - Cache hit rates
   - Response time tracking

## Performance Mitigation

### Expected Performance Impact
- Mercurius: ~10ms p99 latency
- GraphQL Yoga (optimized): ~25-30ms p99 latency
- Acceptable for benefits gained

### Optimization Strategies
1. **JIT Compilation**: Use @graphql-yoga/plugin-jit
2. **Response Caching**: Aggressive caching policies
3. **Query Optimization**: DataLoader patterns
4. **CDN Integration**: Edge caching for queries
5. **Connection Pooling**: Reuse HTTP connections

### Performance Monitoring
```typescript
// Track migration impact
plugins: [
  usePrometheus({
    metrics: {
      graphql_envelop_request_duration: true,
      graphql_envelop_phase_parse: true,
      graphql_envelop_phase_validate: true,
      graphql_envelop_phase_execute: true
    }
  })
]
```

## Consequences

### Positive
- ✅ **Automatic Federation**: No manual resolver code
- ✅ **Multi-Source Capability**: Federate any data source
- ✅ **Advanced Features**: Caching, rate limiting, transforms
- ✅ **Better Tooling**: Full GraphQL Mesh ecosystem
- ✅ **Future Flexibility**: Easy to add new sources
- ✅ **Standardization**: One approach for all federation

### Negative
- ⚠️ **Performance Loss**: ~2-3x slower than Mercurius
- ⚠️ **Migration Effort**: 2-3 weeks of work
- ⚠️ **Risk of Bugs**: Major refactoring
- ⚠️ **Learning Curve**: New patterns for team

### Risks & Mitigations
- **Risk**: Performance regression unacceptable
  - **Mitigation**: Benchmark before/after, have rollback plan
  - **Fallback**: WunderGraph Cosmo if needed

- **Risk**: Migration introduces bugs
  - **Mitigation**: Comprehensive test suite, gradual rollout
  - **Fallback**: Keep Mercurius branches ready

- **Risk**: GraphQL Mesh complexity
  - **Mitigation**: Start simple, add features gradually
  - **Documentation**: Maintain migration guide

## Success Criteria

### Functional
- [ ] All queries/mutations working identically
- [ ] Subscriptions maintain real-time behavior
- [ ] Federation queries work automatically
- [ ] No manual resolver code needed

### Performance
- [ ] p99 latency < 50ms for simple queries
- [ ] p99 latency < 200ms for federated queries
- [ ] Memory usage < 2x current
- [ ] Throughput > 1000 req/s per service

### Developer Experience
- [ ] Auto-generated types working
- [ ] GraphiQL shows federated schema
- [ ] Hot reload in development
- [ ] Clear error messages

## Migration Validation

### Test Plan
1. **Unit Tests**: All resolver logic
2. **Integration Tests**: Cross-service queries
3. **Performance Tests**: Load testing comparison
4. **Subscription Tests**: Real-time features
5. **Error Tests**: Failure scenarios

### Rollback Plan
- Git branches preserve Mercurius implementation
- Feature flags for gradual migration
- Can run both stacks in parallel initially

## References

- [GraphQL Yoga Documentation](https://the-guild.dev/graphql/yoga-server)
- [GraphQL Yoga Performance Guide](https://the-guild.dev/graphql/yoga-server/docs/features/performance)
- [GraphQL Mesh with Yoga](https://the-guild.dev/graphql/mesh/docs/getting-started/your-first-mesh-with-yoga)
- [Migration from Apollo/Mercurius](https://the-guild.dev/graphql/yoga-server/docs/migration/migration-from-apollo-server)
- [GraphQL Yoga Fastify Integration](https://the-guild.dev/graphql/yoga-server/docs/integrations/integration-with-fastify)

## Changelog

- **2025-06-03**: Initial decision to migrate from Mercurius to GraphQL Yoga for full Mesh capabilities