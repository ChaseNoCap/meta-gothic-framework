# ADR-018: Adopt GraphQL Mesh for Federation Implementation

**Date**: 2025-06-03  
**Status**: Accepted  
**Supersedes**: ADR-014 (GraphQL Federation Architecture)  
**Decision Makers**: metaGOTHIC Framework Team  

## Context

After implementing federation with Mercurius and attempting a hybrid approach with Apollo Router, we discovered compatibility issues that prevent effective federation. We need a federation solution that works with our existing Mercurius/Fastify investment.

### Current State
- Two GraphQL services implemented with Mercurius + Fastify
- Services expose Federation v2.10 schemas with entity resolvers
- Simple gateway works but lacks federation features
- Apollo Router incompatible with Mercurius federation implementation

### Problem Statement
We need a federation gateway that:
1. Works with existing Mercurius subgraph services
2. Supports full Federation v2.x features
3. Integrates natively with Fastify
4. Provides automatic schema detection and composition
5. Maintains high performance characteristics
6. Offers good developer experience

### Discovery Findings
- Apollo Router requires pre-composed supergraph schemas
- Mercurius federation implementation differs from Apollo expectations
- Market shift: Apollo GraphOS dropped from 57% to 27% adoption
- WunderGraph Cosmo leads with 87% adoption
- GraphQL Mesh provides best compatibility with heterogeneous stacks

## Decision

Adopt **GraphQL Mesh** as our federation gateway solution, replacing the planned Apollo/Mercurius gateway approach.

### Chosen Solution

#### Architecture with GraphQL Mesh
```
┌─────────────────────────────────────────────────────────────┐
│                meta-gothic-app (Port 3000)                  │
│                GraphQL Mesh Gateway                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           @graphql-mesh/cli                         │   │
│  │  • Automatic federation detection                   │   │
│  │  • Runtime schema composition                       │   │
│  │  • Native Fastify integration                       │   │
│  │  • Multi-source federation                          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
           │                           │
           ▼                           ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│  repo-agent-service     │  │    claude-service       │
│     (Port 3004)         │  │     (Port 3002)         │
│                         │  │                         │
│ ┌─────────────────────┐ │  │ ┌─────────────────────┐ │
│ │ Mercurius + Fastify  │ │  │ │ Mercurius + Fastify  │ │
│ │ Federation v2.10     │ │  │ │ Federation v2.10     │ │
│ │ • Repository @key    │ │  │ │ • ClaudeSession @key │ │
│ │ • Git Operations     │ │  │ │ • AgentRun @key      │ │
│ │ • Entity Resolvers   │ │  │ │ • AI Operations      │ │
│ └─────────────────────┘ │  │ └─────────────────────┘ │
└─────────────────────────┘  └─────────────────────────┘
```

#### Key Features of GraphQL Mesh

1. **Automatic Federation Detection**
   - Detects Federation v2.x schemas automatically
   - No manual supergraph composition required
   - Works with existing Mercurius federation implementation

2. **Native Fastify Integration**
   ```typescript
   // Runs as Fastify plugin
   import meshPlugin from '@graphql-mesh/plugin-fastify'
   
   fastify.register(meshPlugin, {
     ...meshConfig
   })
   ```

3. **Full Federation v2 Support**
   - All v2.x directives (@key, @shareable, @authenticated, etc.)
   - Entity resolution with caching
   - Optimized query planning
   - Cross-service subscriptions

4. **Multi-Source Capabilities**
   - Can federate GraphQL + REST + gRPC
   - Transform non-GraphQL sources to GraphQL
   - **OpenAPI Handler**: Transform REST APIs to GraphQL automatically
   - Useful for GitHub REST API integration (see ADR-020)

#### Implementation Configuration

```typescript
// mesh.config.ts
import { defineConfig } from '@graphql-mesh/compose-cli'

export default defineConfig({
  subgraphs: [
    {
      name: 'repo-agent',
      endpoint: 'http://localhost:3004/graphql',
      // Automatic detection - no manual schema needed!
    },
    {
      name: 'claude',
      endpoint: 'http://localhost:3002/graphql',
    }
  ],
  sources: [
    {
      name: 'GitHubREST',
      handler: {
        openapi: {
          source: 'https://api.github.com/openapi.json',
          operationHeaders: {
            Authorization: 'Bearer {env.GITHUB_TOKEN}'
          }
        }
      },
      transforms: [
        {
          namingConvention: {
            typeNames: 'pascalCase',
            fieldNames: 'camelCase'
          }
        }
      ]
    }
  ],
  serve: {
    fastify: true,
    port: 3000,
    graphiql: true
  },
  federation: {
    version: 2,
    // Enable performance optimizations
    entityCaching: {
      ttl: 60000 // 1 minute
    },
    queryPlanCaching: {
      ttl: 300000 // 5 minutes
    }
  }
})
```

## Alternatives Considered

### Option 1: Fix Apollo Router Compatibility
- **Pros**: Industry standard, mature tooling
- **Cons**: Requires significant changes to services, complex setup
- **Rejected**: Too much effort for uncertain outcome

### Option 2: Full Apollo Stack Migration
- **Pros**: Best Apollo compatibility
- **Cons**: Lose Mercurius 5x performance, major refactoring
- **Rejected**: Contradicts ADR-013 performance requirements

### Option 3: WunderGraph Cosmo
- **Pros**: Best performance (Go-based), market leader
- **Cons**: Separate process, more complex deployment
- **Deferred**: Consider for future if Mesh limitations found

### Option 4: Keep Simple Gateway
- **Pros**: Working now, simple
- **Cons**: No federation benefits, manual relationships
- **Rejected**: Lacks required federation features

## Consequences

### Positive
- ✅ **Immediate Compatibility**: Works with existing Mercurius services
- ✅ **Fastify Native**: Maintains framework consistency
- ✅ **Auto-Detection**: No manual schema composition
- ✅ **Performance**: 2x faster than Apollo Gateway
- ✅ **Open Source**: MIT license, no vendor lock-in
- ✅ **Future Flexibility**: Can federate non-GraphQL sources

### Negative
- ⚠️ **Smaller Community**: Less adoption than Apollo
- ⚠️ **Documentation**: More fragmented than Apollo
- ⚠️ **Enterprise Features**: Fewer than Apollo GraphOS

### Risks & Mitigations
- **Risk**: GraphQL Mesh development slows
  - **Mitigation**: Backed by The Guild, active development
  - **Fallback**: WunderGraph Cosmo as alternative

- **Risk**: Performance not as advertised
  - **Mitigation**: Benchmark before production
  - **Fallback**: Cosmo offers 10x performance if needed

## Migration Plan

### Phase 1: Immediate (Week 1)
- [ ] Remove Apollo Router artifacts
- [ ] Install GraphQL Mesh dependencies
- [ ] Create mesh.config.ts with auto-detection
- [ ] Verify federation features work
- [ ] Update development documentation

### Phase 2: Enhancement (Week 2-3)
- [ ] Add entity caching configuration
- [ ] Implement query plan caching
- [ ] Set up performance monitoring
- [ ] Add subscription federation tests
- [ ] Configure production optimizations

### Phase 3: Future Considerations (Month 2+)
- [ ] Evaluate adding REST data sources
- [ ] Consider GraphQL Mesh plugins
- [ ] Monitor for WunderGraph Cosmo migration need
- [ ] Add edge caching if needed

## Validation

### Success Criteria
- [ ] Federation queries work across services
- [ ] Automatic schema detection confirmed
- [ ] Performance ≥ current simple gateway
- [ ] Subscriptions federate correctly
- [ ] No changes required to subgraph services

### Testing Approach
- Unit tests for federation resolvers
- Integration tests for cross-service queries
- Performance benchmarks vs simple gateway
- Subscription federation tests
- Error propagation validation

## References

- [GraphQL Mesh Documentation](https://the-guild.dev/graphql/mesh)
- [GraphQL Mesh Federation Plugin](https://the-guild.dev/graphql/mesh/docs/transforms/federation)
- [State of GraphQL Federation 2024](https://wundergraph.com/state-of-graphql-federation/2024)
- [Mercurius Federation Limitations](https://github.com/mercurius-js/mercurius/issues)

## Changelog

- **2025-06-03**: Initial decision to adopt GraphQL Mesh
- **2025-06-03**: Supersedes ADR-014 federation approach