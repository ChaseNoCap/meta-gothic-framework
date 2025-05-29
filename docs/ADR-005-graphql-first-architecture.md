# ADR-005: GraphQL-First Architecture for metaGOTHIC Services

**Date**: 2025-01-27  
**Status**: Proposed  
**Decision Makers**: metaGOTHIC Framework Team  

## Context

The metaGOTHIC framework requires a flexible, performant API architecture that can handle complex queries, real-time updates, and efficient communication between services while integrating with GitHub's APIs.

### Current State
- No existing metaGOTHIC services
- H1B project uses simple function calls and file I/O
- GitHub provides both REST and GraphQL APIs
- Need to support AI streaming and real-time updates

### Problem Statement
We need an API architecture that:
1. Handles complex, nested data requirements efficiently
2. Supports real-time updates and streaming
3. Integrates smoothly with GitHub's dual API offering
4. Provides excellent developer experience
5. Scales with increasing complexity
6. Minimizes network overhead

### Requirements
- **Flexible Queries**: Clients can request exactly what they need
- **Real-time Support**: WebSocket subscriptions for live updates
- **GitHub Integration**: Optimal use of GitHub REST and GraphQL APIs
- **Performance**: Efficient caching and batching strategies
- **Type Safety**: Strong typing across service boundaries
- **Streaming**: Support for AI response streaming

## Decision

Adopt a **GraphQL-first architecture** with strategic REST endpoints for specific use cases.

### Chosen Solution

#### Primary GraphQL API
Each service exposes a GraphQL endpoint as its primary API:

```typescript
// repo-agent-service GraphQL Schema (Layered Approach)
// Layer 1: GitHub Mirror Types
type GitHubRepository {
  id: ID!
  name: String!
  owner: GitHubUser!
  defaultBranch: String!
  createdAt: DateTime!
}

// Layer 2: Business Logic Types
type Repository {
  github: GitHubRepository!
  metrics: RepositoryMetrics!
  analysis: RepositoryAnalysis!
  recommendations: [Recommendation!]!
}

// Layer 3: AI-Enhanced Types
type AIRepositoryInsights {
  repository: Repository!
  aiAnalysis: AIAnalysis!
  suggestedActions: [AIAction!]!
  riskAssessment: RiskProfile!
}

// Subscriptions for Real-time
type Subscription {
  repositoryUpdated(owner: String!, name: String!): Repository!
  aiStreamResponse(sessionId: ID!): AIResponseChunk!
}
```

#### Strategic REST Endpoints
REST APIs for specific needs:
- `POST /webhooks` - GitHub webhook receiver
- `GET /health` - Kubernetes health checks
- `GET /metrics` - Prometheus metrics
- Binary file operations

#### Smart GitHub API Routing
```typescript
class GitHubAPIRouter {
  // Use GraphQL for complex queries
  async getRepositoryWithContext(owner: string, name: string) {
    return this.octokit.graphql(`
      query($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          ...FullRepositoryContext
        }
      }
    `);
  }
  
  // Use REST for simple operations
  async createIssue(owner: string, name: string, issue: IssueData) {
    return this.octokit.rest.issues.create({
      owner,
      repo: name,
      ...issue
    });
  }
}
```

### Implementation Approach

#### 1. Service Architecture
```yaml
Services:
  meta-gothic-app:
    type: GraphQL Gateway
    framework: Apollo Gateway
    features:
      - Schema stitching
      - Unified API
      - React UI integration
      
  repo-agent-service:
    type: GraphQL Service  
    framework: Mercurius + Fastify
    features:
      - GitHub API routing
      - Multi-layer caching
      - Webhook processing
      
  claude-service:
    type: GraphQL Service
    framework: Mercurius + Fastify
    features:
      - Streaming subscriptions
      - Session management
      - Context optimization
```

#### 2. Caching Strategy
```typescript
// Multi-layer caching approach
class CachingStrategy {
  // Layer 1: Request-level (DataLoader)
  private dataLoader = new DataLoader(keys => batchFetch(keys));
  
  // Layer 2: Memory cache (LRU)
  private memoryCache = new LRUCache({ max: 500, ttl: 300000 });
  
  // Layer 3: Redis cache
  private redisCache = new Redis({ keyPrefix: 'gothic:' });
  
  async get(key: string): Promise<any> {
    // Check each layer in order
    return await this.dataLoader.load(key) ||
           await this.memoryCache.get(key) ||
           await this.redisCache.get(key);
  }
}
```

#### 3. Real-time Architecture
```typescript
// GraphQL Subscriptions for AI Streaming
const subscriptions = {
  aiStreamResponse: {
    subscribe: withFilter(
      () => pubsub.asyncIterator(['AI_RESPONSE']),
      (payload, variables) => payload.sessionId === variables.sessionId
    )
  }
};

// WebSocket transport
const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/graphql'
});
```

## Alternatives Considered

### Option 1: REST-Only Architecture
- **Pros**: Simple, well-understood, extensive tooling
- **Cons**: Over/under-fetching, multiple requests, no real-time
- **Reason for rejection**: Inefficient for complex data requirements

### Option 2: gRPC + Protocol Buffers
- **Pros**: High performance, strong typing, bi-directional streaming
- **Cons**: Poor browser support, complex setup, limited ecosystem
- **Reason for rejection**: Web client requirements and developer experience

### Option 3: GraphQL-Only (No REST)
- **Pros**: Single paradigm, consistent patterns
- **Cons**: Webhooks need REST, health checks convention, binary files
- **Reason for rejection**: Some use cases genuinely need REST

## Consequences

### Positive
- ✅ **Flexible Queries**: Clients request exactly what they need
- ✅ **Single Request**: Complex data fetched in one round trip
- ✅ **Type Safety**: Generated types from schema
- ✅ **Real-time**: Native subscription support
- ✅ **Self-documenting**: Schema serves as API documentation
- ✅ **Evolution**: Add fields without versioning

### Negative
- ⚠️ **Complexity**: Learning curve for GraphQL
- ⚠️ **Caching**: More complex than REST caching
- ⚠️ **Security**: Requires query depth/complexity limiting

### Risks & Mitigations
- **Risk**: Query complexity attacks (DoS)
  - **Mitigation**: Depth limiting, query cost analysis, rate limiting
  
- **Risk**: N+1 query problems
  - **Mitigation**: DataLoader for batching, query optimization
  
- **Risk**: Schema evolution breaking changes
  - **Mitigation**: Deprecation strategy, backward compatibility

## Validation

### Success Criteria
- [ ] Sub-100ms response time for typical queries
- [ ] Real-time updates within 50ms
- [ ] 90% reduction in API calls vs REST
- [ ] Type safety across all services
- [ ] Developer satisfaction scores > 4/5

### Testing Approach
- Query performance benchmarking
- Load testing with complex queries
- Real-time latency measurements
- Schema compatibility testing
- Integration test suite

## References

- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)
- [Mercurius Documentation](https://mercurius.dev/)
- [Apollo Federation](https://www.apollographql.com/docs/federation/)
- [GitHub GraphQL API](https://docs.github.com/en/graphql)

## Changelog

- **2025-01-27**: Initial draft for GraphQL-first architecture