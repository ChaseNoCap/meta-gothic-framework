# ADR-GraphQL: API Architecture and Implementation

**Status**: Accepted and Implemented  
**Date**: Consolidated 2025-01-06  
**Combines**: ADR-005, ADR-012, ADR-014, ADR-019, ADR-021

## Executive Summary

The metaGOTHIC framework uses GraphQL as its primary API paradigm, implemented with Fastify + GraphQL Yoga + GraphQL Mesh. Services are federated into a unified API, with GitHub's REST API wrapped directly in GraphQL resolvers for simplicity.

## Context

Modern applications require efficient data fetching, real-time updates, and seamless integration of multiple services. REST APIs lead to over-fetching and multiple round trips. We needed a unified API layer that could aggregate services, integrate external APIs, and provide excellent developer experience.

## Decision

### 1. GraphQL-First Architecture

**Primary API**: GraphQL for all service communication
**Strategic REST**: Health checks, webhooks, and legacy compatibility only

```graphql
# Unified schema across all services
type Query {
  # From repo-agent-service
  gitStatus(path: String!): GitStatus
  scanAllRepositories: [Repository!]!
  
  # From claude-service  
  sessions: [ClaudeSession!]!
  agentRuns(status: RunStatus): AgentRunsResult!
  
  # From GitHub integration
  githubUser: GitHubUser
  githubRepositories: [GitHubRepository!]!
}
```

### 2. Technology Stack

**Web Framework**: Fastify
- 2.5x faster than Express
- Native TypeScript support
- Rich plugin ecosystem
- Excellent GraphQL integration

**GraphQL Server**: GraphQL Yoga
- Production-ready with minimal setup
- Excellent performance (2.32ms avg latency)
- Built-in subscription support
- Compatible with GraphQL Mesh

**Federation**: GraphQL Mesh
- Automatic service discovery
- Schema stitching with transforms
- Response caching
- Multi-source federation

### 3. Service Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Client (React)  │────▶│  Gateway :3000  │────▶│ Services        │
│ Apollo Client   │     │ GraphQL Mesh    │     ├─────────────────┤
└─────────────────┘     │ + GitHub API    │     │ Claude :3002    │
                        └─────────────────┘     │ Repo :3004      │
                                                └─────────────────┘
```

### 4. Migration from Mercurius

**Why Migrate**: 
- Mercurius incompatible with GraphQL Mesh
- Limited ecosystem compared to Yoga
- Performance improvements with Yoga

**Migration Approach**:
1. Service by service migration
2. Maintain federation compatibility
3. Zero downtime deployment
4. Performance validation at each step

**Results**:
- ✅ 96 fewer dependencies
- ✅ Better performance (2.32ms avg)
- ✅ Full Mesh compatibility
- ✅ Simplified codebase

### 5. GitHub API Integration

**Direct REST Wrapping** (not OpenAPI transformation):

```typescript
// Direct resolver implementation
const resolvers = {
  Query: {
    githubUser: async (_, __, { dataSources }) => {
      const response = await fetch('https://api.github.com/user', {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
      });
      return response.json();
    },
    githubRepositories: async (_, { per_page = 30 }) => {
      const response = await fetch(
        `https://api.github.com/user/repos?per_page=${per_page}`,
        { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
      );
      return response.json();
    }
  }
};
```

**Benefits**:
- Simple and maintainable
- No complex transformation layer
- Direct control over error handling
- Easy to extend with new endpoints

## Implementation

### Service Setup (GraphQL Yoga)

```typescript
import { createYoga } from 'graphql-yoga';
import { createServer } from 'http';

const yoga = createYoga({
  schema,
  context: async ({ request }) => ({
    // Context setup
  }),
  plugins: [
    useResponseCache(),
    useGraphQLJIT(),
    useDataLoader()
  ]
});

const server = createServer(yoga);
server.listen(3002);
```

### Gateway Configuration (GraphQL Mesh)

```yaml
sources:
  - name: claude
    handler:
      graphql:
        endpoint: http://localhost:3002/graphql
  - name: repo-agent
    handler:
      graphql:
        endpoint: http://localhost:3004/graphql

transforms:
  - prefix:
      value: Claude_
      includeTypes: false
  - cache:
      - field: Query.gitStatus
        cacheKey: path
        ttl: 60000

serve:
  endpoint: /graphql
  port: 3000
```

### Client Integration (Apollo)

```typescript
const client = new ApolloClient({
  uri: 'http://localhost:3000/graphql',
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network' }
  }
});
```

## Performance Optimizations

1. **JIT Compilation**: ~10x faster query execution
2. **Response Caching**: Field-level TTL configuration  
3. **DataLoader**: Automatic request batching
4. **Query Complexity**: Limits prevent abuse
5. **Subscription Efficiency**: WebSocket connection pooling

## Consequences

### Positive
- **Unified API**: Single endpoint for all data
- **Type Safety**: Generated TypeScript types
- **Performance**: Sub-3ms average latency
- **Developer Experience**: GraphiQL, introspection
- **Flexibility**: Easy to add new services

### Negative
- **Learning Curve**: GraphQL concepts
- **Caching Complexity**: More nuanced than REST
- **Error Handling**: Different patterns than REST

### Mitigations
- Comprehensive documentation
- Generated type definitions
- Error boundary patterns
- Cache invalidation strategies

## Future Enhancements

1. **Persisted Queries**: Reduce bandwidth
2. **Federation v2**: When ecosystem supports it
3. **Edge Caching**: CDN integration
4. **Rate Limiting**: Per-operation limits

## Status

Fully implemented:
- All services migrated to GraphQL Yoga
- Gateway operational with GitHub integration  
- UI components use GraphQL exclusively
- Performance exceeds targets

## References

- [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server)
- [GraphQL Mesh](https://the-guild.dev/graphql/mesh)
- [Fastify](https://www.fastify.io/)
- [Apollo Client](https://www.apollographql.com/docs/react/)