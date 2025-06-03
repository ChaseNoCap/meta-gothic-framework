# ADR-015: Use GitHub API Hybrid Strategy (REST + GraphQL)

**Date**: 2025-01-27  
**Status**: Superseded by ADR-020  
**Decision Makers**: metaGOTHIC Framework Team  
**Superseded Date**: 2025-01-06  

> **Note**: This ADR has been superseded by ADR-020 (OpenAPI to GraphQL Transformation Pattern). 
> The hybrid approach of allowing direct REST calls from UI components is no longer accepted. 
> All REST APIs must now be exposed through the GraphQL federation gateway using GraphQL Mesh's OpenAPI handler.  

## Context

The repo-agent-service needs to interact efficiently with GitHub APIs to provide repository data, manage pull requests, handle webhooks, and perform various GitHub operations. GitHub provides both REST and GraphQL APIs with different capabilities and performance characteristics.

### Current State
- No existing GitHub API integration in metaGOTHIC
- H1B project uses basic Octokit REST operations
- Need comprehensive GitHub integration for repository analysis
- Performance and rate limiting are critical concerns

### Problem Statement
We need a GitHub API integration strategy that:
1. Optimizes for different types of operations
2. Stays within GitHub API rate limits efficiently
3. Provides best performance for each use case
4. Handles both simple and complex data requirements
5. Supports real-time webhook processing
6. Maintains consistency with GraphQL federation architecture

### Requirements
- **Efficiency**: Minimize API calls while maximizing data retrieval
- **Performance**: Optimal response times for different query types
- **Rate Limiting**: Stay within GitHub's rate limits (5,000/hour authenticated)
- **Flexibility**: Support both simple CRUD and complex relationship queries
- **Real-time**: Handle webhook events efficiently
- **Consistency**: Align with overall GraphQL-first architecture

## Decision

Implement a **Hybrid Strategy** using both GitHub REST and GraphQL APIs based on operation characteristics.

### Chosen Solution

#### Strategy Decision Matrix

| Operation Type | GitHub API Choice | Rationale |
|----------------|-------------------|-----------|
| Complex relationship queries | GraphQL | Reduce over-fetching, single request |
| Repository context (PRs + reviews + files) | GraphQL | Multiple related entities |
| User/organization data with relationships | GraphQL | Efficient nested data fetching |
| Creating/updating resources | REST | Better CRUD support, more endpoints |
| File operations (upload/download) | REST | File handling not in GraphQL |
| Webhook event processing | REST | Webhooks are REST-based |
| Simple single-resource queries | REST | Simpler for basic operations |
| Bulk operations | GraphQL | Better batching capabilities |

#### Implementation Architecture

```typescript
class GitHubAPIService {
  private octokit: Octokit;
  private graphqlClient: typeof octokit.graphql;
  
  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
    this.graphqlClient = this.octokit.graphql;
  }
  
  // GraphQL for complex relationship queries
  async getRepositoryContext(owner: string, repo: string): Promise<RepositoryContext> {
    return this.graphqlClient(`
      query RepositoryContext($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          id
          name
          description
          stargazerCount
          defaultBranchRef {
            name
            target {
              ... on Commit {
                history(first: 10) {
                  nodes {
                    message
                    author { name date }
                    additions
                    deletions
                  }
                }
              }
            }
          }
          pullRequests(last: 10, states: [OPEN, MERGED]) {
            nodes {
              number
              title
              state
              author { login }
              reviews(last: 5) {
                nodes {
                  state
                  author { login }
                  comments { totalCount }
                }
              }
              files(first: 10) {
                nodes {
                  path
                  additions
                  deletions
                }
              }
            }
          }
          issues(last: 10, states: [OPEN]) {
            nodes {
              number
              title
              labels(first: 5) {
                nodes { name color }
              }
            }
          }
          workflows(first: 10) {
            nodes {
              name
              state
              runs(first: 5) {
                nodes {
                  status
                  conclusion
                  createdAt
                }
              }
            }
          }
        }
      }
    `, { owner, repo });
  }
  
  // REST for simple operations
  async createPullRequest(data: CreatePullRequestData): Promise<PullRequest> {
    return this.octokit.rest.pulls.create({
      owner: data.owner,
      repo: data.repo,
      title: data.title,
      head: data.head,
      base: data.base,
      body: data.body
    });
  }
  
  // REST for file operations
  async uploadFile(data: UploadFileData): Promise<FileUploadResult> {
    return this.octokit.rest.repos.createOrUpdateFileContents({
      owner: data.owner,
      repo: data.repo,
      path: data.path,
      message: data.message,
      content: Buffer.from(data.content).toString('base64'),
      sha: data.sha // For updates
    });
  }
  
  // GraphQL for user relationship queries
  async getUserContributions(username: string, year: number): Promise<ContributionData> {
    return this.graphqlClient(`
      query UserContributions($username: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $username) {
          contributionsCollection(from: $from, to: $to) {
            totalCommitContributions
            totalPullRequestContributions
            totalIssueContributions
            contributionCalendar {
              weeks {
                contributionDays {
                  date
                  contributionCount
                }
              }
            }
          }
          repositories(first: 10, orderBy: {field: UPDATED_AT, direction: DESC}) {
            nodes {
              name
              description
              stargazerCount
              primaryLanguage { name }
            }
          }
        }
      }
    `, { 
      username, 
      from: `${year}-01-01T00:00:00Z`,
      to: `${year}-12-31T23:59:59Z`
    });
  }
  
  // Intelligent routing based on operation characteristics
  async getRepository(owner: string, name: string, includeContext = false): Promise<Repository> {
    if (includeContext) {
      // Use GraphQL for rich context
      return this.getRepositoryContext(owner, name);
    } else {
      // Use REST for simple repository data
      return this.octokit.rest.repos.get({ owner, repo: name });
    }
  }
}
```

#### Rate Limiting Strategy

```typescript
class RateLimitManager {
  private octokit: Octokit;
  private limits: Map<string, RateLimitInfo> = new Map();
  
  async executeWithRateLimit<T>(
    operation: () => Promise<T>,
    endpoint: string
  ): Promise<T> {
    // Check current rate limit status
    await this.checkRateLimit(endpoint);
    
    try {
      const result = await operation();
      
      // Update rate limit info from response headers
      this.updateRateLimits(endpoint, result);
      
      return result;
    } catch (error) {
      if (this.isRateLimitError(error)) {
        // Wait and retry
        await this.handleRateLimit(error);
        return this.executeWithRateLimit(operation, endpoint);
      }
      throw error;
    }
  }
  
  private async checkRateLimit(endpoint: string): Promise<void> {
    const limit = this.limits.get(endpoint);
    
    if (limit && limit.remaining < 100) {
      const waitTime = limit.resetTime - Date.now();
      if (waitTime > 0) {
        await this.wait(Math.min(waitTime, 60000)); // Max 1 minute wait
      }
    }
  }
  
  // GraphQL has different rate limiting (5000 points/hour)
  private calculateGraphQLCost(query: string): number {
    // Simplified cost calculation
    const nodeCount = (query.match(/\{/g) || []).length;
    const connectionCount = (query.match(/\(first:|last:/g) || []).length;
    
    return Math.max(1, nodeCount + connectionCount * 2);
  }
}
```

#### Caching Strategy

```typescript
class GitHubCacheStrategy {
  // Different TTLs for different data types
  private readonly cacheTTLs = {
    // Frequently changing data
    'pull-request-status': 30,     // 30 seconds
    'workflow-runs': 60,           // 1 minute
    'issue-status': 300,           // 5 minutes
    
    // Moderately stable data
    'repository-metadata': 1800,   // 30 minutes
    'user-profile': 3600,          // 1 hour
    'branch-list': 900,            // 15 minutes
    
    // Stable data
    'repository-topics': 21600,    // 6 hours
    'license-info': 86400,         // 24 hours
    'contributor-stats': 3600      // 1 hour
  };
  
  async cacheGitHubResponse<T>(
    key: string,
    dataType: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const ttl = this.cacheTTLs[dataType] || 300; // Default 5 minutes
    
    return this.cache.getOrSet(key, fetcher, ttl);
  }
}
```

#### Webhook Processing

```typescript
// REST-based webhook handling
class GitHubWebhookHandler {
  async handleWebhook(event: GitHubWebhookEvent): Promise<void> {
    // Validate webhook signature
    if (!this.validateSignature(event)) {
      throw new UnauthorizedError('Invalid webhook signature');
    }
    
    // Process different event types
    switch (event.action) {
      case 'opened':
      case 'synchronize':
        await this.handlePullRequestEvent(event);
        break;
        
      case 'push':
        await this.handlePushEvent(event);
        break;
        
      case 'completed':
        await this.handleWorkflowEvent(event);
        break;
    }
    
    // Invalidate relevant caches
    await this.invalidateCache(event);
    
    // Emit federation events
    await this.emitFederationEvent(event);
  }
  
  private async handlePullRequestEvent(event: PullRequestEvent): Promise<void> {
    // Use REST API to get additional PR data if needed
    const prData = await this.githubService.octokit.rest.pulls.get({
      owner: event.repository.owner.login,
      repo: event.repository.name,
      pull_number: event.pull_request.number
    });
    
    // Emit event for federation subscribers
    await this.pubsub.publish('pull_request_updated', {
      pullRequestUpdated: this.transformPRData(prData)
    });
  }
}
```

### GraphQL Federation Integration

```graphql
# Repo agent service schema incorporating both APIs
type Repository @key(fields: "id") {
  id: ID!
  owner: String!
  name: String!
  
  # Simple fields (can use either API)
  description: String
  stars: Int!
  
  # Complex fields (prefer GraphQL)
  pullRequests(first: Int, after: String): PullRequestConnection!
  contributionGraph: ContributionGraph!
  
  # Real-time fields (webhook-driven)
  healthScore: Float! # Calculated from webhook events
  lastActivity: DateTime!
}

# Federation resolvers
const resolvers = {
  Repository: {
    // Use GraphQL for complex nested data
    pullRequests: async (parent, args, context) => {
      return context.dataSources.github.getRepositoryPullRequests(
        parent.owner,
        parent.name,
        args
      );
    },
    
    // Use cached webhook data for real-time fields
    healthScore: async (parent, args, context) => {
      return context.cache.get(`health:${parent.id}`) || 0.5;
    }
  }
};
```

## Alternatives Considered

### Option 1: GraphQL Only
- **Pros**: Consistent API paradigm, efficient data fetching
- **Cons**: Limited endpoint coverage, no file operations, webhook complexity
- **Reason for rejection**: Missing critical functionality

### Option 2: REST Only
- **Pros**: Complete API coverage, familiar patterns, webhook support
- **Cons**: Over-fetching, multiple requests for complex data, poor performance
- **Reason for rejection**: Inefficient for complex relationship queries

### Option 3: REST with Manual Optimization
- **Pros**: Full control, predictable performance
- **Cons**: Complex implementation, manual relationship management
- **Reason for rejection**: Reinventing GraphQL benefits

## Consequences

### Positive
- ✅ **Optimal Performance**: Best API choice for each operation type
- ✅ **Rate Limit Efficiency**: Reduced API calls through smart routing
- ✅ **Complete Coverage**: Access to all GitHub API capabilities
- ✅ **Real-time Support**: Efficient webhook processing
- ✅ **Flexibility**: Can adapt strategy based on specific needs

### Negative
- ⚠️ **Complexity**: Two API patterns to maintain and understand
- ⚠️ **Consistency**: Different error handling and response formats
- ⚠️ **Testing**: Need to test both API interaction patterns

### Risks & Mitigations
- **Risk**: API inconsistencies causing bugs
  - **Mitigation**: Comprehensive integration tests, unified error handling
  
- **Risk**: Performance degradation from poor API choice
  - **Mitigation**: Performance monitoring, A/B testing different strategies
  
- **Risk**: Rate limiting from inefficient usage
  - **Mitigation**: Smart caching, query cost analysis, rate limit monitoring

## Validation

### Success Criteria
- [ ] 50% reduction in GitHub API calls vs REST-only approach
- [ ] <100ms response time for complex repository context queries
- [ ] Stay within 80% of GitHub rate limits under normal load
- [ ] Real-time webhook processing <50ms latency
- [ ] All GitHub operations supported through appropriate API

### Testing Approach
- API call efficiency comparison testing
- Rate limiting behavior under load
- Complex query performance benchmarking
- Webhook processing latency measurement
- Integration testing across both APIs

## References

- [GitHub REST API Documentation](https://docs.github.com/en/rest)
- [GitHub GraphQL API Documentation](https://docs.github.com/en/graphql)
- [Octokit.js Documentation](https://octokit.github.io/rest.js/)
- [GitHub API Rate Limiting](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting)

## Changelog

- **2025-01-27**: Initial hybrid strategy decision