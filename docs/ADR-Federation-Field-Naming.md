# ADR: Federation Field Naming Pattern

## Status
Accepted

## Context
We have multiple GraphQL services (Claude, Git, GitHub) that need to expose health check endpoints and other common fields. In our federated architecture, we face the challenge of:
- Services naturally wanting to use the same field names (e.g., `health`)
- The gateway needing to distinguish between different services' fields
- The UI needing a consistent way to query these fields

Currently, we have a mismatch where:
- Services implement: `health`
- Gateway configuration expects: `claudeHealth`, `repoAgentHealth`
- This causes runtime errors and requires workarounds

## Decision
We will follow the **Clean Service Pattern** for federation field naming:

1. **Services expose generic names**: Each service uses clean, generic field names
   ```graphql
   type Query {
     health: ServiceHealthStatus!
   }
   ```

2. **Gateway handles composition**: The federation gateway composes these into a unified schema
3. **UI queries using service context**: The UI can query specific services using federation directives or aliases

## Implementation Pattern

### Service Level
Each service exposes fields with generic names and uses shared types:
```graphql
# Shared type definition
type ServiceHealthStatus @shareable {
  healthy: Boolean!
  service: String!
  version: String!
  timestamp: String!
  details: JSON  # Service-specific data
}

# claude-service/schema/schema-federated.graphql
type Query {
  health: ServiceHealthStatus! @shareable
}

# git-service/schema/schema-federated.graphql  
type Query {
  health: ServiceHealthStatus! @shareable
}
```

### Gateway Level
The gateway configuration maps these to the composed schema. The federation composition process handles:
- Type name conflicts (different return types for `health`)
- Field accessibility
- Service routing

### UI Level
The UI queries can:
1. Use GraphQL aliases to distinguish services:
   ```graphql
   query SystemHealth {
     claudeHealth: health @fromService(name: "claude-service")
     gitHealth: health @fromService(name: "git-service")
   }
   ```

2. Or query through the composed schema if the gateway provides renamed fields

## Consequences

### Positive
- **Clean service APIs**: Each service has a clean, intuitive API
- **No coupling**: Services don't need to know about other services' naming
- **Federation-native**: Leverages federation's built-in capabilities
- **Maintainable**: Adding new services doesn't require coordinating field names
- **Type safety**: Each service can have its own health status type

### Negative
- **Gateway complexity**: The gateway configuration becomes critical
- **Regeneration needed**: Gateway config must be regenerated when services change
- **UI awareness**: UI developers need to understand federation patterns

### Neutral
- **Standard pattern**: This is the recommended approach for GraphQL Federation
- **Tooling dependent**: Requires proper federation tooling (Cosmo Router, wgc)

## Implementation Notes

1. **Service Schema**: Keep field names generic and service-agnostic
2. **Type Names**: Use service-specific type names (ClaudeHealthStatus vs RepoAgentHealth)
3. **Gateway Config**: Must be regenerated from live services using federation composition
4. **UI Queries**: Use aliases or federation directives for clarity

## References
- [Apollo Federation v2 Documentation](https://www.apollographql.com/docs/federation/)
- [Cosmo Router Federation](https://cosmo-docs.wundergraph.com/router/federation)
- GraphQL Federation Specification v2.10