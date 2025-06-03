# Migration Guide: Mercurius to GraphQL Yoga

This guide provides step-by-step instructions for migrating services from Mercurius to GraphQL Yoga to enable full GraphQL Mesh capabilities.

## Overview

We're migrating from Mercurius to GraphQL Yoga to gain:
- Automatic federation with GraphQL Mesh
- Multi-source federation capabilities
- Advanced caching and transformation features
- Better tooling ecosystem compatibility

## Migration Steps

### Step 1: Install Dependencies

```bash
npm install graphql-yoga @graphql-yoga/plugin-response-cache @graphql-yoga/plugin-dataloader @graphql-yoga/plugin-jit
```

### Step 2: Update Server Setup

#### Before (Mercurius):
```typescript
import Fastify from 'fastify';
import mercurius from 'mercurius';

const app = Fastify({ logger: true });

await app.register(mercurius, {
  schema,
  resolvers,
  subscription: true,
  graphiql: true,
  jit: 1,
  cache: {
    ttl: 300,
    storage: 'memory'
  }
});

await app.listen({ port: 3004, host: '0.0.0.0' });
```

#### After (GraphQL Yoga):
```typescript
import Fastify from 'fastify';
import { createYoga } from 'graphql-yoga';
import { useResponseCache } from '@graphql-yoga/plugin-response-cache';
import { useDataLoader } from '@graphql-yoga/plugin-dataloader';
import { useJIT } from '@graphql-yoga/plugin-jit';

const app = Fastify({ logger: true });

const yoga = createYoga({
  schema,
  logging: app.log,
  maskedErrors: process.env.NODE_ENV === 'production',
  plugins: [
    useJIT(),
    useResponseCache({
      session: () => null,
      ttl: 300_000, // 5 minutes in milliseconds
      invalidateViaMutation: true
    }),
    useDataLoader()
  ]
});

// Route registration
app.route({
  url: '/graphql',
  method: ['GET', 'POST', 'OPTIONS'],
  handler: async (req, reply) => {
    const response = await yoga.handle(req, reply);
    return response;
  }
});

// GraphiQL route
app.route({
  url: '/graphiql',
  method: ['GET'],
  handler: async (req, reply) => {
    reply.type('text/html');
    return yoga.renderGraphiQL();
  }
});

await app.listen({ port: 3004, host: '0.0.0.0' });
```

### Step 3: Update Context Pattern

#### Before (Mercurius):
```typescript
const context = async (request: FastifyRequest) => {
  return {
    request,
    sessionManager,
    performanceTracker
  };
};

await app.register(mercurius, {
  schema,
  resolvers,
  context
});
```

#### After (GraphQL Yoga):
```typescript
const yoga = createYoga({
  schema,
  context: async ({ request }) => {
    return {
      request,
      sessionManager,
      performanceTracker
    };
  }
});
```

### Step 4: Update Resolver Signatures

#### Before (Mercurius):
```typescript
const resolvers = {
  Query: {
    health: async (parent, args, context, info) => {
      // Mercurius passes 4 parameters
      return { status: 'healthy' };
    }
  }
};
```

#### After (GraphQL Yoga):
```typescript
const resolvers = {
  Query: {
    health: async (parent, args, context, info) => {
      // Same signature, works as-is!
      return { status: 'healthy' };
    }
  }
};
```

### Step 5: Update Subscriptions

#### Before (Mercurius):
```typescript
import { withFilter } from 'mercurius';

const resolvers = {
  Subscription: {
    commandOutput: {
      subscribe: withFilter(
        (root, args, { pubsub }) => pubsub.subscribe(`session:${args.sessionId}`),
        (payload, args) => payload.sessionId === args.sessionId
      )
    }
  }
};
```

#### After (GraphQL Yoga):
```typescript
import { createPubSub } from 'graphql-yoga';

const pubsub = createPubSub();

const resolvers = {
  Subscription: {
    commandOutput: {
      subscribe: (root, args) => {
        return pubsub.subscribe(`session:${args.sessionId}`);
      },
      resolve: (payload) => payload
    }
  }
};
```

### Step 6: Update Error Handling

#### Before (Mercurius):
```typescript
app.register(mercurius, {
  errorHandler: (error, request, reply) => {
    app.log.error(error);
    return {
      statusCode: 500,
      error: 'Internal Server Error'
    };
  }
});
```

#### After (GraphQL Yoga):
```typescript
import { useErrorHandler } from '@graphql-yoga/plugin-error-handler';

const yoga = createYoga({
  plugins: [
    useErrorHandler({
      onError: ({ error, context }) => {
        context.request.log.error(error);
      }
    })
  ]
});
```

### Step 7: Federation Schema Updates

No changes needed! Federation directives remain the same:

```graphql
extend schema @link(
  url: "https://specs.apollo.dev/federation/v2.10",
  import: ["@key", "@shareable", "@external"]
)

type Repository @key(fields: "id") {
  id: ID!
  name: String!
  # ... rest of type
}
```

### Step 8: Performance Testing

Run benchmarks before and after migration:

```bash
# Before migration
npm run benchmark:mercurius

# After migration  
npm run benchmark:yoga
```

Expected results:
- Simple queries: ~25-30ms p99 (from ~10ms)
- Federated queries: ~150-200ms p99 (from ~75ms)
- Memory usage: ~1.5-2x increase

### Step 9: Update Tests

Most tests should work without changes. Update any that rely on Mercurius-specific features:

```typescript
// If using mercurius test helpers
import { createMercuriusTestClient } from 'mercurius-test-utils';

// Replace with standard GraphQL test approach
const response = await request(app.server)
  .post('/graphql')
  .send({
    query: `{ health { status } }`
  });
```

## Service-Specific Notes

### repo-agent-service
- Pay attention to git operation error handling
- Ensure file watchers continue working
- Test concurrent git operations

### claude-service  
- Carefully migrate subscription streams
- Test real-time command output
- Verify session management works
- Check WebSocket connections

### meta-gothic-app
- This will become the GraphQL Mesh gateway
- Remove all manual federation code
- Let Mesh handle schema composition

## Rollback Plan

If issues arise:
1. Git branches preserve Mercurius implementation
2. Can run both stacks in parallel on different ports
3. Use feature flags to switch between implementations
4. Keep Mercurius dependencies until fully validated

## Validation Checklist

- [ ] All queries return correct data
- [ ] All mutations work properly
- [ ] Subscriptions stream data correctly
- [ ] Federation queries work across services
- [ ] Performance is within acceptable range
- [ ] Error handling works properly
- [ ] Logs are properly formatted
- [ ] Health checks pass
- [ ] GraphiQL loads and works
- [ ] Authentication/authorization maintained

## Common Issues and Solutions

### Issue: Subscription not working
**Solution**: Ensure WebSocket handling is set up correctly with Yoga's subscription approach

### Issue: Context not available
**Solution**: Update context creation to Yoga's pattern

### Issue: Performance regression too high
**Solution**: 
1. Ensure all performance plugins are enabled
2. Check DataLoader is working
3. Verify response caching is active
4. Consider increasing cache TTLs

### Issue: Federation not detected by Mesh
**Solution**: Ensure introspection is enabled and federation directives are present

## References

- [GraphQL Yoga Documentation](https://the-guild.dev/graphql/yoga-server)
- [Migration from Apollo Server](https://the-guild.dev/graphql/yoga-server/docs/migration/migration-from-apollo-server)
- [Yoga Performance Guide](https://the-guild.dev/graphql/yoga-server/docs/features/performance)
- [Fastify Integration](https://the-guild.dev/graphql/yoga-server/docs/integrations/integration-with-fastify)