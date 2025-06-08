# Federation Implementation Guide

This guide provides practical instructions for working with the Meta GOTHIC Framework's federated GraphQL architecture.

## Quick Start

```bash
# Start all services
npm start

# Access the federated GraphQL endpoint
open http://localhost:4000/graphql

# Services run at:
# - Claude Service: http://localhost:3002/graphql
# - Git Service: http://localhost:3004/graphql  
# - GitHub Adapter: http://localhost:3005/graphql
```

## Architecture Overview

The framework uses Cosmo Router to federate multiple GraphQL services:

- **Cosmo Router**: Federation gateway that composes subgraph schemas
- **Subgraphs**: Individual services with their own GraphQL schemas
- **SSE**: Server-Sent Events for real-time subscriptions
- **Shared Types**: Common types federated across services

## Creating a New Federated Service

### 1. Service Setup

```typescript
// src/index.ts
import express from 'express';
import { createYoga } from 'graphql-yoga';
import { buildCosmoSubgraphSchema } from '@services/shared/federation';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { createContext } from './context';

const app = express();

// Build federated schema
const schema = buildCosmoSubgraphSchema({
  typeDefs,
  resolvers,
});

// Create GraphQL server
const yoga = createYoga({
  schema,
  context: createContext,
  graphiql: {
    title: 'My Service',
  },
});

// Mount GraphQL endpoint
app.use('/graphql', yoga);

// Add SSE endpoint if needed
app.use('/graphql/stream', sseHandler);

app.listen(3004, () => {
  console.log('Service running at http://localhost:3004/graphql');
});
```

### 2. Define Schema with Federation

```graphql
# schema/schema-federated.graphql
extend schema
  @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable"])

# Extend shared types
extend type Query {
  myQuery: MyResponse!
}

extend type Mutation {
  myMutation(input: MyInput!): MyResult!
}

# Define service-specific types
type MyResponse {
  id: ID!
  data: String!
  status: ServiceHealthStatus! # Shared type
}

# Use @key for entities
type MyEntity @key(fields: "id") {
  id: ID!
  name: String!
}
```

### 3. Implement Resolvers

```typescript
// resolvers/index.ts
export const resolvers = {
  Query: {
    myQuery: async (parent, args, context) => {
      const { logger, dataSources } = context;
      
      logger.info('Processing query', { args });
      
      return {
        id: '123',
        data: 'Hello from federated service',
        status: {
          status: 'ok',
          timestamp: new Date().toISOString(),
          service: 'my-service',
          version: '1.0.0',
          uptime: process.uptime(),
        },
      };
    },
  },
  
  MyEntity: {
    __resolveReference: async (reference, context) => {
      // Resolve entity by reference
      return dataSources.myAPI.getEntity(reference.id);
    },
  },
};
```

### 4. Add to Router Configuration

Update `services/gothic-gateway/router.yaml`:

```yaml
subgraphs:
  # ... existing subgraphs ...
  
  - name: 'my-service'
    routing_url: 'http://localhost:3004/graphql'
    subscription_url: 'http://localhost:3004/graphql/stream'
    subscription_protocol: 'SSE'
```

### 5. Regenerate Router Configuration

```bash
cd services/gothic-gateway
./generate-complete-config.sh
```

## Working with Shared Types

### Using ServiceHealthStatus

All services share the `ServiceHealthStatus` type:

```typescript
// In any service resolver
health: async (parent, args, context) => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: context.serviceName,
    version: context.serviceVersion,
    uptime: process.uptime(),
    memoryUsage: {
      heapUsed: process.memoryUsage().heapUsed,
      heapTotal: process.memoryUsage().heapTotal,
      external: process.memoryUsage().external,
      rss: process.memoryUsage().rss,
    },
  };
};
```

### Extending Shared Types

```graphql
# Extend shared types in your service
extend type ServiceHealthStatus {
  customMetric: Float
}
```

## Implementing SSE Subscriptions

### Server-Side Implementation

```typescript
// sse-handler.ts
export async function sseHandler(req: Request, res: Response) {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Parse query from URL
  const { query, variables, operationName } = parseQuery(req.url);

  // Execute subscription
  const result = await execute({
    schema,
    document: parse(query),
    variableValues: variables,
    operationName,
    contextValue: createContext(req, res),
  });

  // Stream results
  if (isAsyncIterable(result)) {
    for await (const value of result) {
      res.write(`event: next\n`);
      res.write(`data: ${JSON.stringify(value)}\n\n`);
    }
  }

  res.end();
}
```

### Client-Side Usage

```typescript
// Using EventSource
const eventSource = new EventSource(
  'http://localhost:4000/graphql/stream?' + 
  new URLSearchParams({
    query: `
      subscription WatchCommands($sessionId: ID!) {
        commandOutput(sessionId: $sessionId) {
          output
          isError
        }
      }
    `,
    variables: JSON.stringify({ sessionId: '123' }),
  })
);

eventSource.addEventListener('next', (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
});
```

## Testing Federation

### Query Through Gateway

```graphql
# Test federated query
query GetSystemStatus {
  claudeHealth: claude {
    health {
      status
      uptime
    }
  }
  
  gitHealth: git {
    health {
      status
      uptime
    }
  }
  
  githubHealth: github {
    health {
      status
      uptime
    }
  }
}
```

### Test Service Directly

```bash
# Test individual service
curl http://localhost:3002/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ health { status } }"}'
```

### Validate Federation

```bash
# Check subgraph schema
cd services/gothic-gateway
./wgc subgraph check claude-service \
  --schema ../claude-service/schema/schema-federated.graphql
```

## Common Patterns

### Error Handling

```typescript
// Consistent error format
class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
  }
}

// In resolvers
try {
  return await someOperation();
} catch (error) {
  logger.error('Operation failed', { error });
  throw new ServiceError(
    'Operation failed',
    'OPERATION_FAILED',
    500
  );
}
```

### Authentication

```typescript
// Context with auth
export async function createContext(req: Request) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = token ? await validateToken(token) : null;
  
  return {
    user,
    isAuthenticated: !!user,
    logger: createLogger('my-service'),
  };
}

// Protected resolver
myProtectedQuery: async (parent, args, context) => {
  if (!context.isAuthenticated) {
    throw new ServiceError('Unauthorized', 'UNAUTHORIZED', 401);
  }
  
  return protectedData;
}
```

### DataLoader Pattern

```typescript
// Batch loading
import DataLoader from 'dataloader';

const userLoader = new DataLoader(async (userIds) => {
  const users = await db.users.findMany({
    where: { id: { in: userIds } },
  });
  
  return userIds.map(id => 
    users.find(user => user.id === id)
  );
});

// In context
export function createContext() {
  return {
    dataSources: {
      userLoader: userLoader,
    },
  };
}
```

## Troubleshooting

### Service Not Appearing in Gateway

1. Check service is running: `curl http://localhost:3002/graphql`
2. Verify router configuration includes service
3. Regenerate router config: `./generate-complete-config.sh`
4. Check router logs: `pm2 logs gothic-gateway`

### Federation Errors

```bash
# Validate subgraph schema
wgc subgraph validate --schema schema-federated.graphql

# Check composition
wgc federated-graph composition --output composed.graphql
```

### SSE Connection Issues

1. Check CORS headers are set correctly
2. Verify `X-Accel-Buffering: no` for Nginx
3. Test with curl: `curl -N http://localhost:3002/graphql/stream?query=...`
4. Check for proxy buffering issues

### Performance Issues

1. Enable query complexity analysis
2. Implement DataLoader for N+1 queries
3. Add resolver timing logs
4. Use query result caching

## Best Practices

1. **Schema Design**
   - Keep schemas focused and cohesive
   - Use shared types for consistency
   - Version schemas carefully

2. **Error Handling**
   - Use consistent error codes
   - Include helpful error messages
   - Log errors with context

3. **Performance**
   - Implement DataLoader for batch loading
   - Cache expensive operations
   - Monitor resolver performance

4. **Security**
   - Validate all inputs
   - Implement rate limiting
   - Use field-level authorization

5. **Testing**
   - Test services in isolation
   - Test federated queries
   - Include error scenarios

## Next Steps

- [ADR-Federation-Architecture.md](./ADR-Federation-Architecture.md) - Architectural decisions
- [service-architecture-guide.md](./service-architecture-guide.md) - Service patterns
- [backlog.md](./backlog.md) - Current development priorities