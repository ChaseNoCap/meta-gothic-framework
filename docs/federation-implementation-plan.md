# GraphQL Federation Implementation Plan

## Overview

This document outlines the plan to convert the Meta-Gothic Framework from schema stitching to Apollo Federation v2, including all services and the GitHub API integration.

## Current Architecture

- **Gateway**: Uses schema stitching to combine schemas
- **Claude Service**: Standalone GraphQL service
- **Repo Agent Service**: Standalone GraphQL service  
- **GitHub API**: Direct integration in gateway

## Target Architecture

- **Apollo Router**: Federation v2 gateway
- **Claude Subgraph**: Federated service with entities
- **Repo Agent Subgraph**: Federated service with entities
- **GitHub Subgraph**: Dedicated service wrapping GitHub API
- **Supergraph**: Composed schema from all subgraphs

## Implementation Steps

### Phase 1: Service Federation (Current)

#### 1.1 Claude Service ✅
- Created federated schema with proper directives
- Added entity definitions (`ClaudeSession` as entity)
- Implemented reference resolvers
- Extended `Repository` type from Repo Agent

#### 1.2 Repo Agent Service (Next)
- Convert schema to federation format
- Define `Repository` as key entity
- Add reference resolvers
- Implement field resolvers for extended types

#### 1.3 GitHub Service (New)
- Create new service for GitHub API
- Implement federated schema
- Define entities: `GitHubUser`, `GitHubRepository`, `Workflow`
- Handle authentication and rate limiting

### Phase 2: Gateway Migration

#### 2.1 Apollo Router Setup
- Install Apollo Router
- Configure supergraph composition
- Set up health checks and monitoring
- Configure CORS and authentication

#### 2.2 Schema Composition
- Use rover CLI for schema composition
- Create CI/CD pipeline for schema updates
- Implement schema validation

### Phase 3: Entity Relationships

#### Key Entities and Relationships

```graphql
# Repository Entity (owned by Repo Agent)
type Repository @key(fields: "path") {
  path: String!
  name: String!
  # Extended by other services
}

# ClaudeSession Entity (owned by Claude)
type ClaudeSession @key(fields: "id") {
  id: ID!
  repository: Repository # Reference to Repo Agent
}

# GitHubRepository Entity (owned by GitHub)
type GitHubRepository @key(fields: "owner { login } name") {
  owner: GitHubUser!
  name: String!
  repository: Repository # Links to local repo
}
```

### Phase 4: Migration Strategy

1. **Parallel Running**: Run both stitched and federated versions
2. **Gradual Migration**: Move queries one by one
3. **Testing**: Comprehensive testing of all queries
4. **Cutover**: Switch UI to use federated endpoint

## Benefits of Federation

1. **Service Independence**: Each service owns its schema
2. **Better Performance**: Query planning and optimization
3. **Type Safety**: Automatic type generation with rover
4. **Scalability**: Services can scale independently
5. **Developer Experience**: Better tooling and debugging

## Technical Requirements

### Dependencies
```json
{
  "@apollo/server": "^4.x",
  "@apollo/subgraph": "^2.x",
  "@apollo/gateway": "^2.x",
  "graphql": "^16.x"
}
```

### Infrastructure
- Apollo Router for gateway
- Schema registry (optional)
- Monitoring and tracing

## Migration Checklist

- [ ] Claude Service Federation
  - [x] Create federated schema
  - [ ] Update service implementation
  - [ ] Test reference resolvers
  - [ ] Deploy federated version

- [ ] Repo Agent Federation
  - [ ] Create federated schema
  - [ ] Define Repository entity
  - [ ] Implement resolvers
  - [ ] Test entity references

- [ ] GitHub Service Creation
  - [ ] Design schema
  - [ ] Implement service
  - [ ] Handle authentication
  - [ ] Test API integration

- [ ] Gateway Migration
  - [ ] Install Apollo Router
  - [ ] Configure supergraph
  - [ ] Test all queries
  - [ ] Update monitoring

- [ ] UI Updates
  - [ ] Update queries for federation
  - [ ] Test all features
  - [ ] Performance testing

## Rollback Plan

1. Keep stitched gateway running
2. Use feature flags for federation
3. Quick switch back if issues
4. Maintain both versions temporarily

## Success Metrics

- [ ] All queries working correctly
- [ ] Performance improvement (target: 20% faster)
- [ ] Zero downtime migration
- [ ] Improved developer experience

## Next Steps

1. Complete Repo Agent federation
2. Create GitHub subgraph service
3. Set up Apollo Router
4. Begin testing and migration