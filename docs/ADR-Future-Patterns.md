# ADR-Future-Patterns: Reserved Patterns for Future Use

**Status**: Proposed (Future Use)  
**Date**: Consolidated 2025-01-06  
**Original**: ADR-020

## Executive Summary

This ADR documents patterns that are not currently used but may be valuable for future integrations. Currently contains the OpenAPI to GraphQL transformation pattern, which was considered for GitHub but ultimately rejected in favor of direct wrapping (ADR-021).

## OpenAPI to GraphQL Transformation Pattern

### Context

Many REST APIs provide OpenAPI (Swagger) specifications. These can potentially be transformed into GraphQL schemas automatically, providing a quick way to integrate external services.

### Pattern

```yaml
# GraphQL Mesh configuration for OpenAPI
sources:
  - name: external-api
    handler:
      openapi:
        source: https://api.example.com/openapi.json
        operationHeaders:
          Authorization: Bearer {env.API_TOKEN}

transforms:
  - prefix:
      value: External_
  - namingConvention:
      enumValues: upperCase
      fieldNames: camelCase
```

### When to Use

**Good Candidates**:
- APIs with comprehensive, accurate OpenAPI specs
- Services where you need most/all endpoints
- APIs with stable schemas
- When rapid integration is more important than optimization

**Poor Candidates**:
- APIs with incomplete or inaccurate specs (like GitHub)
- When you only need a few endpoints
- APIs requiring complex authentication flows
- When performance is critical

### Implementation Example

```typescript
// Future npm registry integration
sources:
  - name: npm
    handler:
      openapi:
        source: https://registry.npmjs.org/openapi.json
    transforms:
      - filter:
          - Query.!getPackage
          - Query.!searchPackages
```

### Benefits
- Automatic schema generation
- No manual type definitions
- Updates when API changes
- Comprehensive coverage

### Drawbacks
- Less control over schema
- Potential performance overhead
- Debugging complexity
- Transformation quirks

## Status

Reserved for future use. Currently not implemented in favor of simpler, more direct approaches for our current integrations.

## Future Patterns to Consider

1. **GraphQL Federation v2**: When ecosystem support improves
2. **Schema Registry Pattern**: For managing schema versions
3. **API Gateway Pattern**: For advanced routing and policies
4. **Event Sourcing**: For complete audit trails
5. **CQRS**: For complex read/write separation

## References

- [GraphQL Mesh OpenAPI](https://the-guild.dev/graphql/mesh/docs/handlers/openapi)
- [OpenAPI Specification](https://swagger.io/specification/)