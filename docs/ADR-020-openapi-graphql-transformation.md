# ADR-020: OpenAPI to GraphQL Transformation Pattern

## Status
Proposed (Future Use)

## Update Note
This ADR was originally created for GitHub REST API integration, but ADR-021 (Direct GitHub REST Wrapping) was implemented instead due to complexity concerns with the OpenAPI approach. This pattern remains valid and recommended for future REST API integrations where OpenAPI specifications are available and well-maintained.

## Context
The metaGOTHIC framework will require integration with various external REST APIs. Our UI components should not make direct REST API calls, instead following our principle of having a single, unified GraphQL API surface.

Examples of REST APIs that could benefit from this pattern:
- npm Registry API for package information
- Docker Hub API for container management
- Cloud provider APIs (AWS, GCP, Azure)
- Third-party service APIs with OpenAPI specs
- Internal microservices with REST interfaces

## Decision
We will use GraphQL Mesh's OpenAPI handler to transform all REST API endpoints into GraphQL operations. This ensures:
1. All API calls from the UI go through our GraphQL federation gateway
2. No direct REST API calls from frontend components
3. Consistent authentication, caching, and error handling
4. Single API endpoint for all operations

### Implementation Pattern
```yaml
# .meshrc.yaml example for future REST API integration
sources:
  - name: NPMRegistry
    handler:
      openapi:
        source: https://registry.npmjs.org/openapi.json  # hypothetical
        operationHeaders:
          Authorization: Bearer {env.NPM_TOKEN}
    transforms:
      - namingConvention:
          typeNames: pascalCase
          fieldNames: camelCase
      - prefix:
          value: NPM_
          includeRootOperations: true
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

## Current Status
While this pattern was not used for GitHub integration (see ADR-021), it remains the recommended approach for future REST API integrations where:
1. A well-maintained OpenAPI specification exists
2. The API surface is large and would be tedious to wrap manually
3. Automatic type generation is desired
4. The REST API changes frequently

## References
- ADR-019: GraphQL Yoga Migration (current architecture)
- ADR-021: Direct GitHub REST Wrapping (alternative approach used)
- GraphQL Mesh OpenAPI Handler: https://www.graphql-mesh.com/docs/handlers/openapi