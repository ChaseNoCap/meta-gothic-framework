# GraphQL Schema Stitching vs Federation: Analysis for Meta-Gothic Framework

## Overview

This document analyzes the differences between GraphQL schema stitching and federation, focusing on how they handle schema composition and naming collisions in the meta-gothic-framework.

## Schema Stitching (Currently Used)

### What is Schema Stitching?

Schema stitching is a technique for combining multiple GraphQL schemas into a single unified schema. It works by:

1. **Schema Merging**: Combining type definitions from multiple schemas
2. **Remote Schema Wrapping**: Proxying requests to underlying services
3. **Type Merging**: Resolving conflicts between types with the same name
4. **Field-Level Resolution**: Delegating field resolution to appropriate subschemas

### Current Implementation in Meta-Gothic

```typescript
// From gateway.ts
const gatewaySchema = stitchSchemas({
  subschemas: [
    claudeSubschema, 
    repoAgentSubschema,
    { schema: githubSchema }
  ],
});
```

### Key Characteristics

- **Runtime Composition**: Schemas are combined when the gateway starts
- **Centralized Gateway**: All schema knowledge lives in the gateway
- **Direct Type Access**: Can directly reference types from any subschema
- **Manual Conflict Resolution**: Requires explicit handling of naming conflicts

## GraphQL Federation

### What is Federation?

Federation is Apollo's approach to distributed GraphQL architectures where:

1. **Service Independence**: Each service owns its schema completely
2. **Entity Extension**: Services can extend types defined in other services
3. **Reference Resolution**: Services provide reference resolvers for their entities
4. **Automatic Composition**: Gateway automatically composes schemas

### How Federation Would Work

```graphql
# Claude Service (with Federation)
type Query {
  claudeHealth: HealthStatus! @shareable
  sessions: [ClaudeSession!]!
}

type ClaudeSession @key(fields: "id") {
  id: ID!
  createdAt: String!
  # ... other fields
}

# Repo Agent Service (with Federation)
type Query {
  repoAgentHealth: Health! @shareable
  gitStatus(path: String!): GitStatus!
}

type Repository @key(fields: "path") {
  path: String!
  name: String!
  # ... other fields
}
```

### Key Characteristics

- **Build-Time Composition**: Schemas composed before deployment
- **Service Autonomy**: Each service manages its own schema
- **Entity References**: Services can reference entities from other services
- **Automatic Conflict Resolution**: Through namespacing and directives

## Key Differences

### 1. Architecture Philosophy

| Aspect | Schema Stitching | Federation |
|--------|-----------------|------------|
| **Composition** | Runtime, in gateway | Build-time, distributed |
| **Schema Ownership** | Centralized in gateway | Distributed across services |
| **Service Coupling** | Tightly coupled through gateway | Loosely coupled services |
| **Deployment** | Gateway must know all schemas | Services deploy independently |

### 2. Naming Collision Handling

| Aspect | Schema Stitching | Federation |
|--------|-----------------|------------|
| **Collision Resolution** | Manual transforms required | Automatic through namespacing |
| **Type Prefixing** | Applied at gateway level | Not needed (entity keys) |
| **Field Conflicts** | Must rename or merge | Resolved by @shareable directive |
| **Query Conflicts** | Manual resolution needed | Natural namespacing |

### 3. Performance Implications

| Aspect | Schema Stitching | Federation |
|--------|-----------------|------------|
| **Query Planning** | Runtime resolution | Pre-computed query plans |
| **Network Hops** | Gateway proxies all requests | Optimized request routing |
| **Caching** | Gateway-level only | Service-level + gateway |
| **Latency** | Higher due to proxying | Lower with query planning |

### 4. Development Experience

| Aspect | Schema Stitching | Federation |
|--------|-----------------|------------|
| **Schema Changes** | Update gateway code | Update service only |
| **Testing** | Requires full stack | Service isolation |
| **Debugging** | Complex (gateway layer) | Simpler (service-specific) |
| **Type Safety** | Manual type generation | Automatic with rover |

## Current Health Query Collision

### The Problem

Both services define a `health` query at the root:

```graphql
# Claude Service
type Query {
  health: HealthStatus!  # Returns HealthStatus type
}

# Repo Agent Service  
type Query {
  health: Health!  # Returns Health type
}
```

### Why It Happens

In schema stitching, when multiple schemas define the same field on the same type (Query), a collision occurs. The gateway must decide which implementation to use.

### Current Workaround

The gateway uses type renaming to avoid collisions:

```typescript
transforms: [
  new RenameTypes((name) => {
    if (['Query', 'Mutation', 'Subscription'].includes(name)) return name;
    return `Claude_${name}`;  // Prefix non-root types
  }),
]
```

However, this doesn't solve root Query field collisions.

## Pros and Cons

### Schema Stitching

**Pros:**
- ✅ Simpler initial setup
- ✅ Works with any GraphQL service
- ✅ Full control over composition
- ✅ No vendor lock-in

**Cons:**
- ❌ Manual conflict resolution
- ❌ Performance overhead
- ❌ Centralized complexity
- ❌ Tight coupling

### Federation

**Pros:**
- ✅ Automatic conflict resolution
- ✅ Better performance
- ✅ Service independence
- ✅ Industry standard

**Cons:**
- ❌ Requires Federation support
- ❌ More complex setup
- ❌ Apollo-specific features
- ❌ Learning curve

## Recommendation for Meta-Gothic

Given the current architecture and immediate needs, **continuing with schema stitching** but implementing proper naming conventions is the most pragmatic approach:

1. **Lower Migration Cost**: No need to rewrite services
2. **Immediate Solution**: Can fix naming conflicts quickly
3. **Maintains Flexibility**: Can migrate to Federation later
4. **Simpler Mental Model**: Easier for contributors to understand

The health query collision can be resolved through field renaming at the service level, which is cleaner than complex gateway transforms.