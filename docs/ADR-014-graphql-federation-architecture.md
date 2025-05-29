# ADR-014: Implement GraphQL Federation Over Monolithic Schema

**Date**: 2025-01-27  
**Status**: Accepted  
**Decision Makers**: metaGOTHIC Framework Team  

## Context

The metaGOTHIC platform consists of three distinct services handling different domains: GitHub operations, AI processing, and orchestration. We need to design a GraphQL API architecture that maintains service independence while providing a unified interface.

### Current State
- Three services planned: meta-gothic-app, repo-agent-service, claude-service
- Each service has distinct responsibilities and data domains
- Need unified GraphQL API for frontend consumption
- Performance and scalability are critical requirements

### Problem Statement
We need a GraphQL architecture that:
1. Maintains clear service boundaries and responsibilities
2. Enables independent development and deployment
3. Provides unified API for frontend clients
4. Supports type-safe cross-service relationships
5. Scales with service complexity and load
6. Enables real-time features across services

### Requirements
- **Service Independence**: Each service owns its domain schema
- **Unified Interface**: Single GraphQL endpoint for clients
- **Type Safety**: Strongly typed cross-service relationships
- **Performance**: Efficient query resolution across services
- **Real-time**: Subscription support across federation
- **Scalability**: Independent scaling based on service load

## Decision

Implement **GraphQL Federation** using Mercurius federation capabilities.

### Chosen Solution

#### Federation Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                meta-gothic-app (Port 3000)                 │
│                Federation Gateway                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           @mercuriusjs/gateway                      │   │
│  │  • Schema composition                               │   │
│  │  • Query planning                                   │   │
│  │  • Cross-service resolution                         │   │
│  │  • Subscription aggregation                         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
           │                           │
           ▼                           ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│  repo-agent-service     │  │    claude-service       │
│     (Port 3001)         │  │     (Port 3002)         │
│                         │  │                         │
│ ┌─────────────────────┐ │  │ ┌─────────────────────┐ │
│ │@mercuriusjs/federation│ │  │@mercuriusjs/federation│ │
│ │  • Repository       │ │  │  • AIAnalysis       │ │
│ │  • PullRequest      │ │  │  • Repository ext   │ │
│ │  • Workflow         │ │  │  • AI Operations    │ │
│ └─────────────────────┘ │  │ └─────────────────────┘ │
└─────────────────────────┘  └─────────────────────────┘
```

#### Service Domain Boundaries

**repo-agent-service (GitHub Domain)**
```graphql
# Primary entities owned by this service
type Repository @key(fields: "id") {
  id: ID!
  owner: String!
  name: String!
  description: String
  stars: Int!
  healthScore: Float
  pullRequests: [PullRequest!]!
  workflows: [Workflow!]!
  branches: [Branch!]!
}

type PullRequest @key(fields: "id") {
  id: ID!
  number: Int!
  title: String!
  state: PullRequestState!
  repository: Repository!
  author: User!
}

type Workflow @key(fields: "id") {
  id: ID!
  name: String!
  status: WorkflowStatus!
  repository: Repository!
}

extend type Query {
  repository(owner: String!, name: String!): Repository
  repositories(owner: String!): [Repository!]!
  pullRequest(owner: String!, repo: String!, number: Int!): PullRequest
}

extend type Mutation {
  createPullRequest(input: CreatePRInput!): PullRequest!
  mergePullRequest(input: MergePRInput!): PullRequest!
}

extend type Subscription {
  repositoryUpdated(owner: String!, name: String!): Repository!
  pullRequestUpdated(repositoryId: ID!): PullRequest!
}
```

**claude-service (AI Domain)**
```graphql
# AI-specific entities
type AIAnalysis @key(fields: "id") {
  id: ID!
  repositoryId: String!
  type: AnalysisType!
  prompt: String!
  response: String!
  tokenCount: Int!
  cost: Float!
  status: AnalysisStatus!
  createdAt: DateTime!
  completedAt: DateTime
}

type AISession @key(fields: "id") {
  id: ID!
  repositoryId: String!
  analyses: [AIAnalysis!]!
  totalCost: Float!
}

# Extend Repository with AI capabilities
extend type Repository @key(fields: "id") {
  id: ID! @external
  owner: String! @external
  name: String! @external
  
  # AI-related fields
  analyses: [AIAnalysis!]!
  latestAnalysis: AIAnalysis
  aiSession: AISession!
  
  # AI operations
  generateCodeReview(pullRequestId: ID!): AIAnalysis!
  generateDocumentation: AIAnalysis!
  analyzeSecurityVulnerabilities: AIAnalysis!
}

extend type Mutation {
  generateAnalysis(input: GenerateAnalysisInput!): AIAnalysis!
  cancelAnalysis(id: ID!): Boolean!
  createAISession(repositoryId: ID!): AISession!
}

extend type Subscription {
  analysisProgress(analysisId: ID!): AIAnalysisProgress!
  repositoryAnalysisUpdated(repositoryId: ID!): AIAnalysis!
}
```

#### Federation Gateway Configuration
```typescript
// meta-gothic-app federation gateway setup
import Fastify from 'fastify';
import gateway from '@mercuriusjs/gateway';

const app = Fastify({ logger: true });

await app.register(gateway, {
  gateway: {
    services: [
      { 
        name: 'repo-agent', 
        url: 'http://repo-agent-service:3001/graphql',
        wsUrl: 'ws://repo-agent-service:3001/graphql',
        mandatory: true,
        rewriteHeaders: (headers) => {
          // Forward authentication headers
          return {
            authorization: headers.authorization
          };
        }
      },
      { 
        name: 'claude', 
        url: 'http://claude-service:3002/graphql',
        wsUrl: 'ws://claude-service:3002/graphql',
        mandatory: true,
        rewriteHeaders: (headers) => {
          return {
            authorization: headers.authorization
          };
        }
      }
    ],
    pollingInterval: 10000, // Schema polling
    retryServicesCount: 3,
    retryServicesInterval: 5000
  },
  subscription: true,
  graphiql: true,
  
  // Performance optimizations
  queryDepth: 12,
  jit: 1,
  
  // Federation-specific error handling
  errorHandler: (error, request, reply) => {
    // Log federation errors
    request.log.error(error, 'Federation error');
    
    // Return user-friendly error
    reply.code(500).send({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});
```

#### Cross-Service Query Resolution
```graphql
# Example federated query
query RepositoryWithAIAnalysis($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    # Fields from repo-agent-service
    id
    name
    owner
    stars
    healthScore
    
    pullRequests(first: 5) {
      number
      title
      state
    }
    
    # Fields from claude-service (via federation)
    analyses(last: 3) {
      type
      status
      tokenCount
      cost
    }
    
    latestAnalysis {
      response
      createdAt
    }
  }
}
```

#### Real-time Federation
```typescript
// Cross-service subscription handling
const resolvers = {
  Subscription: {
    repositoryWithAIUpdates: {
      subscribe: async (root, args, context) => {
        // Subscribe to both services
        const repoUpdates = context.pubsub.subscribe(`repo:${args.repositoryId}`);
        const aiUpdates = context.pubsub.subscribe(`ai:${args.repositoryId}`);
        
        // Merge subscription streams
        return mergeSubscriptions([repoUpdates, aiUpdates]);
      }
    }
  }
};
```

### Implementation Standards

#### Entity Resolution
```typescript
// Reference resolver pattern for federation
const resolvers = {
  Repository: {
    __resolveReference: async (reference: { id: string }, context) => {
      // Resolve repository by ID for federation
      return await context.dataSources.github.getRepository(reference.id);
    }
  }
};
```

#### Error Propagation
```typescript
// Federation-aware error handling
class FederationError extends Error {
  constructor(
    message: string,
    public service: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'FederationError';
  }
}

// Error formatting for federation
const formatError = (error: GraphQLError) => {
  if (error.originalError instanceof FederationError) {
    return {
      message: error.message,
      service: error.originalError.service,
      path: error.path,
      extensions: {
        code: 'FEDERATION_ERROR',
        service: error.originalError.service
      }
    };
  }
  return error;
};
```

## Alternatives Considered

### Option 1: Monolithic GraphQL Schema
- **Pros**: Simple setup, single service, easier debugging
- **Cons**: Tight coupling, single point of failure, scaling issues
- **Reason for rejection**: Violates service independence principles

### Option 2: Schema Stitching
- **Pros**: Flexible schema combination, custom resolution logic
- **Cons**: Manual schema management, complex error handling, performance overhead
- **Reason for rejection**: Federation provides better tooling and standards

### Option 3: REST APIs with GraphQL Gateway
- **Pros**: Service independence, familiar REST patterns
- **Cons**: Data fetching inefficiency, complex aggregation, no type safety
- **Reason for rejection**: Loses GraphQL benefits, poor frontend DX

### Option 4: Multiple GraphQL Endpoints
- **Pros**: Complete service independence, simple implementation
- **Cons**: Frontend complexity, no unified schema, duplicate queries
- **Reason for rejection**: Poor frontend developer experience

## Consequences

### Positive
- ✅ **Service Independence**: Clear boundaries, independent development
- ✅ **Unified Interface**: Single GraphQL endpoint for frontend
- ✅ **Type Safety**: Strongly typed cross-service relationships
- ✅ **Performance**: Efficient query planning and execution
- ✅ **Scalability**: Independent service scaling based on load
- ✅ **Real-time**: Federation-aware subscription handling

### Negative
- ⚠️ **Complexity**: Federation adds architectural complexity
- ⚠️ **Debugging**: Errors can span multiple services
- ⚠️ **Network**: Additional network calls for cross-service queries

### Risks & Mitigations
- **Risk**: Service dependency failures
  - **Mitigation**: Circuit breakers, fallback responses, service redundancy
  
- **Risk**: Schema evolution conflicts
  - **Mitigation**: Schema governance, breaking change policies, versioning
  
- **Risk**: Performance degradation
  - **Mitigation**: Query optimization, caching, monitoring

## Validation

### Success Criteria
- [ ] Unified GraphQL schema accessible from single endpoint
- [ ] Cross-service queries resolve correctly
- [ ] Real-time subscriptions work across services
- [ ] Independent service deployment without downtime
- [ ] Query performance meets <200ms target for complex operations

### Testing Approach
- Federation integration tests
- Cross-service query performance testing
- Service failure scenario testing
- Schema evolution compatibility testing
- End-to-end user workflow testing

## References

- [Apollo Federation Specification](https://www.apollographql.com/docs/federation/)
- [Mercurius Federation Documentation](https://mercurius.dev/#/docs/federation)
- [GraphQL Federation Best Practices](https://www.apollographql.com/docs/federation/federation-spec/)
- [Schema Design for Federation](https://www.apollographql.com/docs/federation/entities/)

## Changelog

- **2025-01-27**: Initial federation architecture decision