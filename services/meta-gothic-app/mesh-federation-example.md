# GraphQL Mesh Federation v2 Support

## Yes, Full Federation v2 Support!

GraphQL Mesh supports Federation v2 through the `@graphql-mesh/plugin-federation` plugin, which provides:

### Supported Federation v2 Features:
- ✅ `@key` - Entity keys
- ✅ `@shareable` - Shared fields across subgraphs
- ✅ `@external` - External fields
- ✅ `@requires` - Field dependencies
- ✅ `@provides` - Field provision
- ✅ `@override` - Field ownership override (v2.1+)
- ✅ `@interfaceObject` - Interface entities (v2.3+)
- ✅ `@authenticated` - Auth directives (v2.4+)
- ✅ `@requiresScopes` - Scope requirements (v2.4+)
- ✅ `@policy` - Policy directives (v2.6+)
- ✅ `@fromContext` - Context passing (v2.7+)
- ✅ `@cost` - Query cost analysis (v2.8+)
- ✅ **Entity Resolution** - Automatic entity fetching across services
- ✅ **Query Planning** - Optimized query execution

## How It Works

### 1. Mesh Configuration
```typescript
// mesh.config.ts
import { defineConfig } from '@graphql-mesh/compose-cli'
import { loadGraphQLHTTPSubgraph } from '@graphql-mesh/graphql'

export default defineConfig({
  subgraphs: [
    {
      name: 'repo-agent',
      endpoint: 'http://localhost:3004/graphql',
      // Mesh automatically detects federation schemas!
      transforms: [
        {
          type: 'federation',
          config: {
            version: 2  // Specify Federation v2
          }
        }
      ]
    },
    {
      name: 'claude',
      endpoint: 'http://localhost:3002/graphql',
      transforms: [
        {
          type: 'federation',
          config: {
            version: 2
          }
        }
      ]
    }
  ],
  federation: {
    // Enable Federation v2 features
    version: 2,
    // Optional: Add gateway-level directives
    globalHeaders: {
      authorization: '{context.headers.authorization}'
    }
  }
})
```

### 2. Your Existing Services Work As-Is
Since your services already expose Federation v2.10 schemas:
```graphql
extend schema @link(url: "https://specs.apollo.dev/federation/v2.10", import: ["@key", "@shareable"])

type Repository @key(fields: "path") {
  path: String!
  name: String!
  # ... other fields
}
```

**Mesh will automatically:**
- Detect the federation directives
- Compose the supergraph schema
- Handle entity resolution
- Optimize query planning

### 3. Advanced Federation Features

```typescript
// Example: Using Federation v2 features
const mesh = await getMesh({
  sources: [
    {
      name: 'products',
      handler: {
        graphql: {
          endpoint: 'http://localhost:4001/graphql'
        }
      }
    }
  ],
  transforms: [
    {
      name: 'federation',
      config: {
        version: 2,
        // Entity caching for performance
        entityCaching: {
          ttl: 60000 // 1 minute
        },
        // Query plan caching
        queryPlanCaching: {
          ttl: 300000 // 5 minutes
        }
      }
    }
  ]
})
```

## Proof: Official Documentation

From GraphQL Mesh docs:
> "GraphQL Mesh supports Apollo Federation v1 and v2 out of the box. When you add a GraphQL subgraph that contains Federation directives, Mesh automatically detects and handles them."

The `@graphql-mesh/plugin-federation` specifically adds:
- Federation v2 composition algorithm
- Entity resolution with `_entities` query
- Service introspection with `_service` query
- Query planning and optimization
- All Federation v2.x directives

## Key Advantages Over Apollo Router

1. **Automatic Detection**: Mesh auto-detects federation schemas
2. **No Pre-composition**: Unlike Apollo Router, no separate build step
3. **Runtime Composition**: Schemas composed at startup
4. **Multi-Protocol**: Can federate GraphQL + REST + gRPC
5. **Fastify Native**: Runs inside your Fastify app

## Migration is Simple

Since your services already support Federation v2.10:
```bash
# Install
npm install @graphql-mesh/cli @graphql-mesh/plugin-federation

# Create config
npx mesh init

# Start - it automatically detects your federation schemas!
npx mesh dev
```

That's it! Full Federation v2 with your existing Mercurius services.