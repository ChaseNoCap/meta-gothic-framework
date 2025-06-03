# ADR-022: GitHub REST API Direct Integration

**Status**: Accepted  
**Date**: 2025-01-06  
**Decision**: Use direct REST integration for GitHub API instead of OpenAPI/GraphQL transformation

## Context

After migrating to GraphQL, the health dashboard lost access to GitHub repository and pipeline data. We needed a way to integrate GitHub's REST API into our GraphQL federation gateway.

## Problem

1. The GraphQL migration removed access to GitHub data on the dashboard
2. GitHub's OpenAPI specification is complex and difficult to transform reliably
3. We needed real-time access to repositories, workflows, and user data
4. The solution needed to work within our existing GraphQL federation

## Decision

Implement direct REST-to-GraphQL wrapping for GitHub API endpoints instead of using OpenAPI transformation tools.

## Implementation

### 1. Direct REST Integration
Created custom GraphQL resolvers that directly call GitHub REST endpoints:
- `githubUser` - GET /user
- `githubRepositories` - GET /user/repos
- `githubRepository` - GET /repos/:owner/:repo
- `githubWorkflows` - GET /repos/:owner/:repo/actions/workflows
- `githubWorkflowRuns` - GET /repos/:owner/:repo/actions/runs

### 2. Type Definitions
Manually defined GraphQL types for GitHub entities:
```graphql
type GitHubUser {
  login: String!
  name: String
  avatarUrl: String
  publicRepos: Int
}

type GitHubRepository {
  name: String!
  description: String
  stargazersCount: Int
  defaultBranch: String
  pushedAt: String
}
```

### 3. Authentication
Token passed via environment variables:
- Reads from `GITHUB_TOKEN` or `VITE_GITHUB_TOKEN`
- Passes as Authorization header to GitHub API

### 4. Error Handling
- Graceful fallbacks when GitHub API is unavailable
- Dashboard continues to function with local data
- Clear error messages for authentication issues

## Benefits

1. **Simplicity**: Direct mapping is easier to understand and maintain
2. **Reliability**: No complex transformation layer to fail
3. **Performance**: Minimal overhead, direct API calls
4. **Flexibility**: Easy to add new endpoints as needed
5. **Type Safety**: Manual types ensure accuracy

## Drawbacks

1. **Manual Work**: Each endpoint must be manually wrapped
2. **Maintenance**: GitHub API changes require manual updates
3. **Limited Coverage**: Only wrapped endpoints are available

## Alternatives Considered

### 1. GraphQL Mesh with OpenAPI
- **Rejected**: OpenAPI spec transformation was unreliable
- Complex configuration and debugging
- Performance overhead from transformation layer

### 2. GitHub GraphQL API v4
- **Rejected**: Would require significant refactoring
- Different query patterns from our existing code
- Learning curve for GraphQL-specific syntax

### 3. Separate REST Service
- **Rejected**: Breaks federation pattern
- Requires multiple API calls from frontend
- Inconsistent developer experience

## Consequences

### Positive
- Dashboard has full GitHub integration
- Unified GraphQL API for all data
- Easy to extend with new GitHub endpoints
- Clear, maintainable code

### Negative
- Manual wrapper maintenance required
- Not all GitHub API features available
- Need to update types when GitHub changes API

## Future Considerations

1. Consider code generation for REST wrappers
2. Add caching layer for GitHub responses
3. Implement webhook support for real-time updates
4. Gradually add more GitHub endpoints as needed

## References
- GitHub REST API: https://docs.github.com/en/rest
- Implementation: `/services/meta-gothic-app/src/yoga-mesh-gateway-github.ts`
- Dashboard: `/packages/ui-components/src/components/Dashboard/CombinedHealthDashboard.tsx`