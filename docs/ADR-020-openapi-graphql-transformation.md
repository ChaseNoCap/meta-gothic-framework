# ADR-020: OpenAPI to GraphQL Transformation Pattern

## Status
Accepted

## Context
The metaGOTHIC framework requires integration with various external APIs, particularly GitHub's REST API for operations not available in their GraphQL API. Our UI components currently make direct REST API calls, violating our principle of having a single, unified GraphQL API surface.

GitHub operations only available via REST include:
- Workflow dispatch and management
- Artifact upload/download
- Release creation and management
- File operations (create/update/delete)
- Webhook configuration
- Secrets management
- Deployment environments
- GitHub Pages operations

## Decision
We will use GraphQL Mesh's OpenAPI handler to transform all REST API endpoints into GraphQL operations. This ensures:
1. All API calls from the UI go through our GraphQL federation gateway
2. No direct REST API calls from frontend components
3. Consistent authentication, caching, and error handling
4. Single API endpoint for all operations

### Implementation Pattern
```yaml
# .meshrc.yaml
sources:
  - name: GitHubREST
    handler:
      openapi:
        source: https://api.github.com/openapi.json
        operationHeaders:
          Authorization: Bearer {env.GITHUB_TOKEN}
    transforms:
      - namingConvention:
          typeNames: pascalCase
          fieldNames: camelCase
```

## Consequences

### Positive
- **Unified API Surface**: All operations available through GraphQL
- **Consistent Patterns**: Same error handling, caching, auth for all operations
- **Type Safety**: Generated TypeScript types for all REST operations
- **No Frontend Changes**: When REST APIs change, only gateway configuration updates needed
- **Performance**: GraphQL Mesh handles efficient REST call batching
- **Monitoring**: Single point for API monitoring and rate limiting

### Negative
- **Additional Complexity**: Another transformation layer in the stack
- **Learning Curve**: Developers need to understand OpenAPI transformation
- **Debugging**: Extra layer can complicate troubleshooting
- **Schema Size**: Generated schema can be large with full OpenAPI specs

## Implementation Guidelines

1. **All REST APIs must be exposed through GraphQL Mesh**
   - No direct fetch() or axios calls in UI components
   - Configure OpenAPI sources in mesh configuration

2. **Naming Conventions**
   - Apply consistent naming transforms
   - Prefix operations by source (e.g., `githubCreateRelease`)

3. **Authentication**
   - Handle all auth at the gateway level
   - Use environment variables for sensitive tokens

4. **Error Handling**
   - Transform REST errors to GraphQL errors
   - Maintain error context and codes

5. **Caching**
   - Configure appropriate cache hints
   - Respect REST API cache headers

## References
- ADR-018: GraphQL Mesh Federation Architecture
- ADR-015: GitHub API Hybrid Strategy (superseded)
- GraphQL Mesh OpenAPI Handler: https://www.graphql-mesh.com/docs/handlers/openapi