# Apollo Federation v2 Setup Guide

## Overview

The Meta-Gothic Framework now uses a hybrid approach combining Apollo Federation v2 for internal services with GraphQL Mesh for wrapping external APIs like GitHub.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Apollo Gateway (Port 3000)                │
│                  (Federation v2 with Yoga)                   │
└──────────────────────┬────────────────┬─────────────────────┘
                       │                │
         ┌─────────────┴───────┐ ┌─────┴──────────┐ ┌──────────────────┐
         │  Claude Subgraph    │ │ Repo Agent     │ │  GitHub Mesh     │
         │    (Port 3002)      │ │  Subgraph      │ │  (Port 3005)     │
         │  @key: Session.id   │ │ (Port 3004)    │ │ REST → GraphQL   │
         └─────────────────────┘ │@key: Repo.path │ └──────────────────┘
                                 └────────────────┘

```

## Running the Federated Services

### 1. Start All Services with Federation

```bash
# Start all services using PM2
npm run start

# Services will be available at:
# - Gateway: http://localhost:3000/graphql
# - Claude Service: http://localhost:3002/graphql
# - Repo Agent Service: http://localhost:3004/graphql  
# - GitHub Mesh: http://localhost:3005/graphql
# - UI: http://localhost:3001
```

### Manual Start (for development)

```bash
# Terminal 1 - Claude Service (Federation)
cd services/claude-service
npm run dev:federation

# Terminal 2 - Repo Agent Service (Federation)  
cd services/repo-agent-service
npm run dev:federation

# Terminal 3 - GitHub Mesh Service
cd services/github-mesh
npm run serve:federation

# Terminal 4 - Gateway (Federation)
cd services/meta-gothic-app
npm run dev
```

### 2. Verify Services

Check that all services are running:

```bash
# Claude Service
curl http://localhost:3002/graphql

# Repo Agent Service
curl http://localhost:3004/graphql

# GitHub Mesh Service
curl http://localhost:3005/graphql

# Gateway Health Check
curl http://localhost:3000/health
```

## Key Entities and Relationships

### Repository Entity (Owned by Repo Agent)

```graphql
type Repository @key(fields: "path") {
  path: String!        # Unique identifier
  name: String!
  isDirty: Boolean!
  branch: String!
  status: GitStatus!
  # ... other fields
}
```

### ClaudeSession Entity (Owned by Claude Service)

```graphql
type ClaudeSession @key(fields: "id") {
  id: ID!              # Unique identifier
  repository: Repository  # Reference to Repo Agent
  # ... other fields
}
```

### GitHubRepository (From GitHub Mesh)

```graphql
type GitHubRepository @key(fields: "owner { login } name") {
  owner: GitHubUser!
  name: String!
  localRepository: Repository  # Link to Repo Agent
  # ... other fields
}
```

## Example Queries

### 1. Cross-Service Query

```graphql
query GetRepositoryWithGitHub {
  # From Repo Agent
  repositoryDetails(path: "ChaseNoCap/meta-gothic-framework") {
    path
    name
    isDirty
    status {
      files {
        path
        status
      }
    }
  }
  
  # From GitHub Mesh
  githubRepository(owner: "ChaseNoCap", name: "meta-gothic-framework") {
    stargazers_count
    open_issues_count
    # Federation will resolve this
    localRepository {
      isDirty
      uncommittedCount
    }
  }
}
```

### 2. Claude Sessions with Repository Data

```graphql
query GetActiveSessionsWithRepos {
  sessions {
    id
    isActive
    workingDirectory
    # Federation resolves from Repo Agent
    repository {
      name
      isDirty
      status {
        branch
        ahead
        behind
      }
    }
  }
}
```

## Development Workflow

### Adding New Fields

1. **Update Subgraph Schema**: Add fields to the service that owns the data
2. **Deploy Service**: Restart the service with new schema
3. **Gateway Auto-Updates**: With `IntrospectAndCompose`, gateway picks up changes automatically

### Adding New Entities

1. **Define Entity**: Add `@key` directive to make it an entity
2. **Add Reference Resolver**: Implement `__resolveReference` in resolvers
3. **Extend in Other Services**: Use `extend type` to add fields from other services

### Manual Supergraph Composition

For production or when using Apollo Router:

```bash
# Install Rover CLI
curl -sSL https://rover.apollo.dev/nix/latest | sh

# Compose supergraph
cd services/meta-gothic-app
./compose-supergraph.sh
```

## Monitoring and Debugging

### Enable Query Planning

The gateway is configured to show query plans in development:

```graphql
# Add this to any query
{
  _service {
    sdl
  }
}
```

### View Service Health

```bash
curl http://localhost:3000/health
```

### GraphiQL Playgrounds

- Gateway: http://localhost:3000/graphql
- Claude Service: http://localhost:3002/graphql
- Repo Agent: http://localhost:3004/graphql
- GitHub Mesh: http://localhost:3005/graphql

## Troubleshooting

### Service Not Found

If gateway can't find a service:
1. Check service is running on correct port
2. Verify service URL in gateway configuration
3. Check service implements federation spec

### Entity Resolution Errors

If entity references fail:
1. Verify `@key` fields match exactly
2. Check `__resolveReference` implementation
3. Ensure key fields are non-nullable

### Schema Composition Errors

If supergraph composition fails:
1. Check for conflicting type definitions
2. Verify all required fields are present
3. Use `rover subgraph check` for validation

## Benefits of This Hybrid Approach

1. **True Federation**: Internal services use Apollo Federation v2 for optimal performance
2. **External API Integration**: GitHub API wrapped with Mesh for easy consumption
3. **Type Safety**: Full type generation and validation
4. **Flexibility**: Can add more Mesh sources or federated services easily
5. **Performance**: Query planning optimizes cross-service queries
6. **Developer Experience**: Each service has its own GraphiQL, plus unified gateway

## Next Steps

1. **Add Caching**: Configure Redis for query result caching
2. **Add Monitoring**: Integrate Apollo Studio for production monitoring
3. **Add Authentication**: Implement auth at gateway level
4. **Add Subscriptions**: WebSocket support for real-time updates
5. **Production Router**: Replace development gateway with Apollo Router for production