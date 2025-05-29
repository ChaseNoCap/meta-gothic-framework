# ADR-013: Choose Mercurius Over Apollo Server for GraphQL

**Date**: 2025-01-27  
**Status**: Accepted  
**Decision Makers**: metaGOTHIC Framework Team  

## Context

The metaGOTHIC platform requires a GraphQL server implementation that supports federation architecture across three services. Performance, developer experience, and Fastify integration are critical factors.

### Current State
- Decided to use Fastify as web framework (ADR-012)
- Need GraphQL federation across three services
- Performance is critical for GitHub API operations and AI processing
- No existing GraphQL implementation

### Problem Statement
We need a GraphQL server that:
1. Provides excellent performance for federation
2. Integrates natively with Fastify
3. Supports Apollo Federation v1 specification
4. Offers built-in optimization features
5. Provides good developer experience
6. Enables real-time subscriptions

### Requirements
- **Performance**: High throughput, low latency GraphQL execution
- **Federation**: Full Apollo Federation v1 compatibility
- **Integration**: Native Fastify plugin support
- **Features**: Caching, JIT compilation, DataLoader integration
- **DX**: TypeScript support, introspection, playground
- **Real-time**: WebSocket subscriptions support

## Decision

Adopt **Mercurius** as the GraphQL server for all metaGOTHIC services.

### Chosen Solution

#### Performance Benefits
```typescript
// Mercurius performance advantages
- 5x faster than Apollo Gateway for small payloads
- 2x faster than Apollo Router for federation queries
- Native Fastify performance (no context switching)
- Built-in JIT compilation for resolvers
- Efficient subscription handling
```

#### Native Fastify Integration
```typescript
import Fastify from 'fastify';
import mercurius from 'mercurius';

const app = Fastify({ logger: true });

// Zero-overhead Fastify integration
await app.register(mercurius, {
  schema: buildFederationSchema(typeDefs),
  resolvers,
  subscription: true,
  graphiql: true,
  jit: 1, // Enable JIT compilation
  cache: {
    ttl: 300,
    storage: 'redis'
  }
});
```

#### Federation Architecture
```typescript
// Gateway service (meta-gothic-app)
import gateway from '@mercuriusjs/gateway';

await app.register(gateway, {
  gateway: {
    services: [
      { 
        name: 'repo-agent', 
        url: 'http://localhost:3001/graphql',
        wsUrl: 'ws://localhost:3001/graphql',
        mandatory: true
      },
      { 
        name: 'claude', 
        url: 'http://localhost:3002/graphql',
        wsUrl: 'ws://localhost:3002/graphql',
        mandatory: true  
      }
    ]
  },
  subscription: true,
  graphiql: true
});

// Subgraph service (repo-agent-service)
import federation from '@mercuriusjs/federation';

await app.register(federation, {
  schema: buildFederationSchema(typeDefs)
});
```

#### Advanced Features
```typescript
// Built-in performance optimizations
await app.register(mercurius, {
  schema,
  resolvers,
  
  // JIT compilation for resolvers
  jit: 1,
  
  // Response caching
  cache: {
    ttl: 300,
    storage: 'redis',
    policy: {
      Query: {
        repository: { ttl: 600 }
      }
    }
  },
  
  // Query complexity limiting
  queryDepth: 12,
  
  // Custom error handling
  errorHandler: (error, request, reply) => {
    // Federation-aware error handling
  }
});

// Performance monitoring
await app.register(require('mercurius-explain'), {
  enabled: process.env.NODE_ENV !== 'production'
});
```

#### Real-time Subscriptions
```typescript
// Native subscription support
const typeDefs = `
  type Subscription {
    repositoryUpdated(owner: String!, name: String!): Repository!
    aiAnalysisProgress(analysisId: ID!): AIProgress!
  }
`;

const resolvers = {
  Subscription: {
    repositoryUpdated: {
      subscribe: async (root, args, context) => {
        return context.pubsub.subscribe(`repo:${args.owner}:${args.name}`);
      }
    }
  }
};
```

### Federation Schema Design

#### Repo Agent Service Schema
```graphql
type Repository @key(fields: "id") {
  id: ID!
  owner: String!
  name: String!
  description: String
  stars: Int!
  healthScore: Float
  pullRequests(first: Int, after: String): PullRequestConnection!
  workflows: [Workflow!]!
}

type PullRequest @key(fields: "id") {
  id: ID!
  number: Int!
  title: String!
  state: PullRequestState!
  repository: Repository!
}

extend type Query {
  repository(owner: String!, name: String!): Repository
  repositories(owner: String!): [Repository!]!
}

extend type Subscription {
  repositoryUpdated(owner: String!, name: String!): Repository!
}
```

#### Claude Service Schema
```graphql
type AIAnalysis @key(fields: "id") {
  id: ID!
  repositoryId: String!
  type: AnalysisType!
  prompt: String!
  response: String!
  tokenCount: Int!
  status: AnalysisStatus!
}

extend type Repository @key(fields: "id") {
  id: ID! @external
  analyses: [AIAnalysis!]!
  generateAnalysis(prompt: String!): AIAnalysis!
}

extend type Mutation {
  analyzeRepository(input: AnalysisInput!): AIAnalysis!
}

extend type Subscription {
  analysisProgress(analysisId: ID!): AIProgress!
}
```

## Alternatives Considered

### Option 1: Apollo Server
- **Pros**: Industry standard, rich ecosystem, mature federation
- **Cons**: Slower performance, additional abstraction layer, not Fastify-native
- **Reason for rejection**: Performance requirements and Fastify integration

### Option 2: GraphQL Yoga
- **Pros**: Modern, batteries-included, good performance
- **Cons**: No federation support, different ecosystem than Fastify
- **Reason for rejection**: Lacks federation capabilities

### Option 3: express-graphql
- **Pros**: Minimal, simple, direct GraphQL execution
- **Cons**: No federation, no advanced features, Express-focused
- **Reason for rejection**: Insufficient features for federation architecture

### Option 4: Envelop + GraphQL Tools
- **Pros**: Modular, plugin-based, framework agnostic
- **Cons**: Complex setup, federation requires additional work
- **Reason for rejection**: Too much configuration overhead

## Consequences

### Positive
- ✅ **Superior Performance**: 5x faster than Apollo Gateway
- ✅ **Native Integration**: Zero overhead with Fastify
- ✅ **Federation Support**: Full Apollo Federation v1 compatibility
- ✅ **Built-in Optimizations**: JIT compilation, caching, DataLoader
- ✅ **Real-time Features**: Efficient subscription handling
- ✅ **Developer Experience**: TypeScript support, GraphiQL, monitoring

### Negative
- ⚠️ **Limited v2 Federation**: Apollo Federation v2 features limited
- ⚠️ **Smaller Ecosystem**: Fewer third-party tools than Apollo
- ⚠️ **Learning Curve**: Different from Apollo Server patterns

### Risks & Mitigations
- **Risk**: Federation v2 features needed in future
  - **Mitigation**: v1 sufficient for current needs, v2 support improving
  
- **Risk**: Limited tooling ecosystem
  - **Mitigation**: Core functionality complete, growing ecosystem
  
- **Risk**: Performance claims unproven in production
  - **Mitigation**: Benchmark testing, gradual rollout, monitoring

## Validation

### Success Criteria
- [ ] Gateway response time <50ms for simple queries
- [ ] Federation queries <200ms for complex cross-service operations
- [ ] Support 1000+ concurrent GraphQL operations
- [ ] Real-time subscriptions with <100ms latency
- [ ] Memory usage <512MB per service

### Testing Approach
- Federation query performance benchmarking
- Load testing with realistic query patterns
- Subscription latency measurement
- Memory usage profiling
- Cross-service query optimization testing

## References

- [Mercurius Performance Benchmarks](https://mercurius.dev/#/docs/benchmarks)
- [Mercurius Federation Documentation](https://mercurius.dev/#/docs/federation)
- [Apollo Federation Specification](https://www.apollographql.com/docs/federation/)
- [Fastify Mercurius Plugin](https://github.com/mercurius-js/mercurius)

## Changelog

- **2025-01-27**: Initial decision for Mercurius adoption