# ADR-009: Multi-Layer Caching Strategy

**Date**: 2025-01-27  
**Status**: Proposed  
**Decision Makers**: metaGOTHIC Framework Team  

## Context

The metaGOTHIC framework needs to optimize performance while managing GitHub API rate limits, expensive AI operations, and complex GraphQL queries. A sophisticated caching strategy is essential for system viability.

### Current State
- H1B project uses simple in-memory caching in cache package
- No distributed caching infrastructure
- GitHub API rate limits: 5,000 requests/hour (authenticated)
- AI operations are expensive and slow
- Complex GraphQL queries can be resource-intensive

### Problem Statement
We need a caching strategy that:
1. Minimizes GitHub API calls to stay within rate limits
2. Reduces latency for frequently accessed data
3. Handles cache invalidation from webhooks and events
4. Supports different TTLs for different data types
5. Works seamlessly with GraphQL DataLoader
6. Maintains data consistency

### Requirements
- **Performance**: Sub-millisecond cache hits
- **Scalability**: Handle thousands of concurrent requests
- **Flexibility**: Different strategies for different data
- **Invalidation**: Real-time updates via webhooks
- **Consistency**: Eventual consistency acceptable
- **Observability**: Cache hit/miss metrics

## Decision

Implement a **Multi-Layer Caching Strategy** with three distinct layers optimized for different access patterns.

### Chosen Solution

#### Layer Architecture

**Layer 1: Request-Level Cache (DataLoader)**
```typescript
// Per-request batching and deduplication
class RequestContext {
  loaders = {
    repository: new DataLoader(keys => this.batchLoadRepos(keys)),
    user: new DataLoader(keys => this.batchLoadUsers(keys)),
    pullRequest: new DataLoader(keys => this.batchLoadPRs(keys))
  };
  
  // Automatically cleared after request
}

// GraphQL resolver usage
const resolvers = {
  Repository: {
    owner: (repo, args, context) => {
      return context.loaders.user.load(repo.ownerId);
    }
  }
};
```

**Layer 2: Application Memory Cache (LRU)**
```typescript
// In-process cache for hot data
class MemoryCache {
  private lru = new LRUCache<string, CachedItem>({
    max: 500,  // Maximum items
    ttl: 1000 * 60 * 5,  // 5 minutes default
    updateAgeOnGet: true,
    updateAgeOnHas: true
  });
  
  async get<T>(key: string, ttl?: number): Promise<T | null> {
    const item = this.lru.get(key);
    if (item && !this.isExpired(item, ttl)) {
      metrics.cacheHit('memory', key);
      return item.value;
    }
    metrics.cacheMiss('memory', key);
    return null;
  }
}
```

**Layer 3: Distributed Cache (Redis)**
```typescript
// Shared cache across all service instances
class RedisCache {
  private client: Redis;
  private defaultTTL = 3600; // 1 hour
  
  async get<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    if (data) {
      metrics.cacheHit('redis', key);
      return JSON.parse(data);
    }
    metrics.cacheMiss('redis', key);
    return null;
  }
  
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    await this.client.setex(
      key,
      ttl || this.defaultTTL,
      serialized
    );
  }
}
```

#### Cache Key Strategy
```typescript
// Hierarchical key structure for easy invalidation
class CacheKeyBuilder {
  // Pattern: service:entity:id:field:version
  
  repository(owner: string, name: string): string {
    return `repo:${owner}:${name}:v1`;
  }
  
  repositoryField(owner: string, name: string, field: string): string {
    return `repo:${owner}:${name}:${field}:v1`;
  }
  
  userContributions(username: string, year: number): string {
    return `user:${username}:contributions:${year}:v1`;
  }
  
  // Wildcard for invalidation
  repositoryPattern(owner: string, name: string): string {
    return `repo:${owner}:${name}:*`;
  }
}
```

#### TTL Strategy
```yaml
TTL Configuration:
  # Frequently changing data
  Repository Metadata: 5 minutes
  Pull Request Status: 30 seconds
  Workflow Runs: 1 minute
  
  # Moderately stable data
  User Profiles: 1 hour
  Repository Stats: 30 minutes
  Issue List: 5 minutes
  
  # Stable data
  License Info: 24 hours
  Repository Topics: 6 hours
  Contribution Graph: 1 hour
  
  # AI/Computed data
  Code Analysis: 6 hours
  AI Suggestions: 30 minutes
  Context Aggregation: 15 minutes
```

#### Cache Invalidation
```typescript
// Event-driven invalidation
class CacheInvalidator {
  constructor(
    private eventBus: EventBus,
    private caches: CacheManager
  ) {
    this.registerHandlers();
  }
  
  private registerHandlers() {
    // GitHub webhook events
    this.eventBus.on('github.push', async (event) => {
      await this.invalidateRepository(event.repository);
    });
    
    this.eventBus.on('github.pr.merged', async (event) => {
      await this.invalidatePullRequest(event.pullRequest);
      await this.invalidateRepository(event.repository);
    });
  }
  
  async invalidateRepository(repo: RepoIdentifier) {
    const pattern = `repo:${repo.owner}:${repo.name}:*`;
    
    // Clear all layers
    await this.caches.memory.invalidatePattern(pattern);
    await this.caches.redis.del(pattern);
    // DataLoader cleared automatically per request
  }
}
```

### Implementation Flow
```
Request Flow:
1. GraphQL query received
2. Check DataLoader (Layer 1)
   - Hit: Return immediately
   - Miss: Continue
3. Check Memory Cache (Layer 2)  
   - Hit: Load into DataLoader, return
   - Miss: Continue
4. Check Redis Cache (Layer 3)
   - Hit: Load into Memory + DataLoader, return
   - Miss: Continue
5. Fetch from GitHub API
6. Store in all cache layers
7. Return result

Invalidation Flow:
1. Webhook/Event received
2. Build invalidation patterns
3. Clear Redis (Layer 3)
4. Clear Memory (Layer 2)
5. DataLoader auto-clears
6. Publish cache.invalidated event
```

## Alternatives Considered

### Option 1: Single-Layer Redis Cache
- **Pros**: Simple, consistent, easy invalidation
- **Cons**: Network latency on every access, no request dedup
- **Reason for rejection**: Performance requirements need memory caching

### Option 2: CDN/Edge Caching
- **Pros**: Global distribution, high performance
- **Cons**: Complex invalidation, not suitable for user-specific data
- **Reason for rejection**: Most data is user/repo specific

### Option 3: Database Query Cache
- **Pros**: Automatic invalidation, consistency
- **Cons**: Only works for DB queries, not API calls
- **Reason for rejection**: Primary data source is GitHub API

## Consequences

### Positive
- ✅ **Performance**: Sub-ms latency for cached data
- ✅ **Efficiency**: Dramatic reduction in GitHub API calls
- ✅ **Scalability**: Redis enables horizontal scaling
- ✅ **Flexibility**: Different TTLs for different data types
- ✅ **Cost**: Reduced AI API calls through caching
- ✅ **Resilience**: Can serve stale data if GitHub is down

### Negative
- ⚠️ **Complexity**: Three layers to manage and debug
- ⚠️ **Consistency**: Potential for stale data
- ⚠️ **Memory**: Higher memory usage

### Risks & Mitigations
- **Risk**: Cache stampede on popular repositories
  - **Mitigation**: Implement cache warming, use locks
  
- **Risk**: Memory exhaustion from large cache
  - **Mitigation**: LRU eviction, monitoring, alerts
  
- **Risk**: Stale data served after updates
  - **Mitigation**: Event-driven invalidation, short TTLs

## Validation

### Success Criteria
- [ ] 95%+ cache hit rate for hot paths
- [ ] <1ms memory cache latency
- [ ] <10ms Redis cache latency  
- [ ] 80% reduction in GitHub API calls
- [ ] Real-time invalidation working

### Testing Approach
- Load testing with cache metrics
- Cache invalidation testing
- TTL verification tests
- Memory usage monitoring
- Hit rate analysis

## References

- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [DataLoader Documentation](https://github.com/graphql/dataloader)
- [LRU Cache Implementation](https://github.com/isaacs/node-lru-cache)
- [Caching Strategies](https://aws.amazon.com/caching/best-practices/)

## Changelog

- **2025-01-27**: Initial draft for multi-layer caching strategy