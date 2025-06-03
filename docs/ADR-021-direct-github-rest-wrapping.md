# ADR-021: Direct GitHub REST API Wrapping

## Status
Accepted

## Context

After successfully migrating from Mercurius to GraphQL Yoga (ADR-019), we needed to integrate GitHub data into our GraphQL federation gateway. The UI components were making direct REST API calls to GitHub, which violated our GraphQL-first architecture principle (ADR-005).

We initially planned to use GraphQL Mesh's OpenAPI handler (ADR-020) to automatically transform GitHub's OpenAPI specification into GraphQL. However, during implementation, we discovered several challenges:

1. **Complexity**: The OpenAPI handler required complex configuration and schema transformations
2. **Size**: GitHub's full OpenAPI spec is massive (>100MB) with thousands of endpoints
3. **Performance**: Loading and transforming the entire spec added significant startup time
4. **Maintenance**: Keeping the OpenAPI spec synchronized with GitHub's changes
5. **Flexibility**: Limited control over the resulting GraphQL schema structure

## Decision

We decided to wrap GitHub's REST API directly in custom GraphQL resolvers instead of using the OpenAPI handler approach. This involves:

1. **Custom GraphQL Types**: Define only the GitHub types we actually need
2. **Direct Fetch Calls**: Use native `fetch()` in resolvers to call GitHub REST API
3. **Selective Implementation**: Only implement the endpoints our application uses
4. **Custom Mutations**: Add workflow control mutations (trigger, cancel)
5. **Type Safety**: Maintain full TypeScript type safety throughout

## Implementation Details

The implementation consists of:

### GraphQL Type Definitions
```typescript
type GitHubUser {
  login: String!
  name: String
  avatarUrl: String
  bio: String
  company: String
  location: String
  publicRepos: Int
}

type GitHubRepository {
  id: String!
  name: String!
  fullName: String!
  description: String
  // ... other needed fields
}

type Query {
  githubUser: GitHubUser
  githubRepositories(perPage: Int = 30, page: Int = 1): [GitHubRepository!]!
  githubWorkflows(owner: String!, repo: String!): [GitHubWorkflow!]!
  githubWorkflowRuns(owner: String!, repo: String!, perPage: Int = 10): [GitHubWorkflowRun!]!
}

type Mutation {
  triggerWorkflow(owner: String!, repo: String!, workflowId: String!, ref: String = "main"): Boolean!
  cancelWorkflowRun(owner: String!, repo: String!, runId: Int!): Boolean!
}
```

### Direct REST Wrapping
```typescript
const githubResolvers = {
  Query: {
    githubUser: async () => {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });
      const data = await response.json();
      return {
        login: data.login,
        name: data.name,
        avatarUrl: data.avatar_url,
        // ... map other fields
      };
    },
  },
  Mutation: {
    triggerWorkflow: async (_, { owner, repo, workflowId, ref }) => {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ref }),
        }
      );
      return response.ok;
    },
  },
};
```

## Consequences

### Positive

1. **Simplicity**: Direct implementation is much simpler than OpenAPI transformation
2. **Performance**: No OpenAPI spec parsing overhead; fast startup times
3. **Control**: Full control over GraphQL schema design and field mapping
4. **Maintainability**: Easy to understand and modify individual endpoints
5. **Size**: Only includes code for endpoints we actually use
6. **Flexibility**: Can add custom logic, caching, and error handling per endpoint

### Negative

1. **Manual Work**: Each endpoint must be manually implemented
2. **No Auto-Updates**: Changes to GitHub API require manual updates
3. **Limited Coverage**: Only covers endpoints we explicitly implement
4. **Duplication**: Some field mapping code may be duplicated

### Neutral

1. **Type Safety**: Both approaches can achieve full type safety
2. **Testing**: Both approaches require similar testing strategies
3. **Documentation**: Schema is self-documenting in both cases

## Alternatives Considered

### 1. GraphQL Mesh OpenAPI Handler (ADR-020)
- **Pros**: Automatic transformation, full API coverage, auto-updates
- **Cons**: Complex setup, large bundle, less control, performance overhead

### 2. GitHub GraphQL API
- **Pros**: Native GraphQL, no transformation needed
- **Cons**: Different API surface, rate limiting differences, not all features available

### 3. Hybrid Approach
- **Pros**: Use GitHub GraphQL where possible, REST where needed
- **Cons**: Two different APIs to maintain, complexity in resolver logic

## Related Decisions

- **ADR-005**: GraphQL-First Architecture - This ensures GitHub data is available via GraphQL
- **ADR-015**: GitHub API Hybrid Strategy - Superseded by this decision
- **ADR-019**: GraphQL Yoga Migration - Enabled this flexible approach
- **ADR-020**: OpenAPI Pattern - Remains valid for other REST APIs, just not GitHub

## Implementation Status

✅ Implemented in `yoga-mesh-gateway-github.ts` with:
- User profile query
- Repository listing  
- Workflow management (list, trigger, cancel)
- Workflow run monitoring
- Full integration with UI dashboard

## Future Considerations

1. **Caching Strategy**: Implement Redis caching for GitHub API responses
2. **Rate Limiting**: Add rate limit handling and backoff strategies
3. **Webhook Integration**: Add GitHub webhooks for real-time updates
4. **Extended Coverage**: Add more endpoints as needed by the application
5. **Migration Path**: Consider GraphQL Mesh OpenAPI when it matures further

## References

- [GitHub REST API Documentation](https://docs.github.com/en/rest)
- [GraphQL Yoga Documentation](https://the-guild.dev/graphql/yoga-server)
- [Implementation PR](https://github.com/ChaseNoCap/meta-gothic-framework)