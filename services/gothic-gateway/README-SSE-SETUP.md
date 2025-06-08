# Cosmo Router SSE Federation Setup Guide

This guide documents how to set up Cosmo Router with SSE (Server-Sent Events) support for federated GraphQL subscriptions.

## Overview

The metaGOTHIC framework uses Cosmo Router to federate three GraphQL services:
- **Claude Service** (port 3002) - AI agent operations with SSE subscriptions
- **Git Service** (port 3003) - Git operations with SSE subscriptions  
- **GitHub Adapter** (port 3005) - GitHub API integration (no subscriptions)

## Prerequisites

1. All services must be running and accessible
2. `wgc` CLI tool must be available (`npm install -g wgc` or use `npx wgc`)
3. Services must implement Federation v2 with `_service { sdl }` field

## Step-by-Step Setup

### 1. Create Subgraph Configuration

Create a `subgraph-config.yaml` file that defines your federated services:

```yaml
version: 1
subgraphs:
  - name: claude-service
    routing_url: http://localhost:3002/graphql
    subscription:
      url: http://localhost:3002/graphql/stream
      protocol: sse
  - name: git-service  
    routing_url: http://localhost:3003/graphql
    subscription:
      url: http://localhost:3003/graphql/stream
      protocol: sse
  - name: github-adapter
    routing_url: http://localhost:3005/graphql
    # No subscriptions for GitHub adapter
```

### 2. Compose Router Configuration

Use the `wgc` CLI to compose a router configuration from your subgraphs:

```bash
npx wgc router compose --input subgraph-config.yaml --out config.json
```

This command:
- Introspects each service to get their schemas
- Validates federation compatibility
- Generates an optimized router configuration
- Outputs to `config.json`

### 3. Configure Cosmo Router

Create a `router.yaml` configuration file for the router itself:

```yaml
# Cosmo Router Configuration for Local Development
version: "1"

# Development settings
dev_mode: true

# Server settings
listen_addr: "localhost:4000"
log_level: "debug"

# GraphQL Playground
playground:
  enabled: true
  path: /

# Engine settings
engine:
  enable_single_flight: true
  enable_request_tracing: true

# CORS configuration
cors:
  allow_origins: ["*"]
  allow_methods: ["HEAD", "GET", "POST", "OPTIONS"]
  allow_headers: ["*"]
  allow_credentials: true

# Execution config from wgc
execution_config:
  file:
    path: "./config.json"
```

### 4. Start the Router

Run the Cosmo Router with your configuration:

```bash
# Using the router binary directly
./router --config router.yaml

# Or using PM2
pm2 start pm2-router-wrapper.sh --name gateway
```

### 5. Verify Setup

Test that the federation is working:

```bash
# Test GraphQL endpoint
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'

# Test a federated query
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ claudeHealth { healthy } }"}'
```

## Testing SSE Subscriptions

### Using GraphQL Playground

Navigate to http://localhost:4000 and run:

```graphql
subscription WatchCommands {
  commandOutput(sessionId: "test-session") {
    sessionId
    type
    content
    timestamp
    isFinal
  }
}
```

### Using curl

```bash
# Create a subscription query
QUERY='subscription { commandOutput(sessionId: "test-123") { sessionId type content } }'

# URL encode and make the request
curl -N -H "Accept: text/event-stream" \
  "http://localhost:4000/graphql/stream?query=$(echo -n "$QUERY" | jq -sRr @uri)"
```

### Using graphql-sse Client

```javascript
import { createClient } from 'graphql-sse';

const client = createClient({
  url: 'http://localhost:4000/graphql/stream',
});

const unsubscribe = client.subscribe(
  {
    query: `
      subscription CommandOutput($sessionId: String!) {
        commandOutput(sessionId: $sessionId) {
          sessionId
          type
          content
          timestamp
          isFinal
        }
      }
    `,
    variables: { sessionId: "test-session" }
  },
  {
    next: (data) => console.log('Received:', data),
    error: (err) => console.error('Error:', err),
    complete: () => console.log('Complete')
  }
);
```

## Service SSE Implementation

Each service that supports subscriptions must implement an SSE endpoint. Here's the pattern used:

### 1. SSE Endpoint Handler

```typescript
// Custom SSE handler that processes GraphQL subscriptions
if (req.url?.startsWith('/graphql/stream')) {
  const sseHandler = createSSEHandler({
    schema,
    execute,
    subscribe,
    context: () => ({
      // Your context object
    })
  });
  
  return sseHandler(req, res);
}
```

### 2. Subscription Resolvers

```typescript
export const commandOutput = {
  subscribe: async function* (
    _parent: unknown,
    { sessionId }: { sessionId: string },
    context: Context
  ) {
    // Implementation that yields values over time
    while (true) {
      const data = await getNextData();
      yield { commandOutput: data };
      
      if (data.isFinal) break;
    }
  }
};
```

## Troubleshooting

### Router Won't Start

1. Check all services are running:
   ```bash
   curl http://localhost:3002/health
   curl http://localhost:3003/health
   curl http://localhost:3005/health
   ```

2. Verify federation schemas:
   ```bash
   # Check each service has _service { sdl }
   curl -X POST http://localhost:3002/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"{ _service { sdl } }"}'
   ```

3. Check router logs:
   ```bash
   pm2 logs gateway
   ```

### SSE Not Working

1. Test SSE endpoint directly on service:
   ```bash
   curl -N http://localhost:3002/graphql/stream
   ```

2. Verify subscription configuration in subgraph-config.yaml
3. Check CORS headers are properly set
4. Ensure heartbeat mechanism is implemented (prevents connection timeout)

### Composition Errors

If `wgc router compose` fails:

1. Check all services are implementing Federation v2
2. Verify there are no conflicting type definitions
3. Use `--suppress-warnings` flag for non-critical issues
4. Check service logs for GraphQL schema errors

## Configuration Reference

### Subgraph Config (YAML)

```yaml
version: 1
subgraphs:
  - name: service-name
    routing_url: http://localhost:PORT/graphql
    subscription:
      url: http://localhost:PORT/graphql/stream  # SSE endpoint
      protocol: sse  # or sse_post, ws
    schema:
      file: ./path/to/schema.graphql  # Optional, for offline composition
```

### Router Config (YAML)

Key settings for SSE support:
- `engine.enable_single_flight`: Prevents duplicate subscriptions
- `cors`: Must allow event-stream content type
- `execution_config.file.path`: Points to composed config.json

## Best Practices

1. **Always regenerate config** after schema changes:
   ```bash
   npx wgc router compose --input subgraph-config.yaml --out config.json
   ```

2. **Implement heartbeats** in SSE endpoints (every 30s)

3. **Use proper error handling** in subscription resolvers

4. **Set appropriate CORS headers** for cross-origin SSE

5. **Monitor memory usage** - long-running subscriptions can accumulate

## Scripts

### Quick Setup Script

```bash
#!/bin/bash
# generate-and-start.sh

echo "🚀 Setting up Cosmo Router with SSE..."

# 1. Compose configuration
npx wgc router compose --input subgraph-config.yaml --out config.json

# 2. Start router
./router --config router.yaml
```

### Health Check Script

```bash
#!/bin/bash
# check-federation.sh

echo "Checking federation health..."

# Check services
for port in 3002 3003 3005; do
  echo -n "Service on port $port: "
  curl -s http://localhost:$port/health | jq -r '.status'
done

# Check router
echo -n "Router on port 4000: "
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}' | jq -r '.data.__typename'
```

## References

- [Cosmo Router Docs](https://cosmo-docs.wundergraph.com/router)
- [GraphQL SSE Specification](https://github.com/enisdenjo/graphql-sse)
- [Federation v2 Docs](https://www.apollographql.com/docs/federation/v2)