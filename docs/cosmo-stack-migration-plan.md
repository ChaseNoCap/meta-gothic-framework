# Full Cosmo Stack Migration Plan

## Executive Summary

We're migrating the entire metaGOTHIC framework from Apollo Gateway to the full WunderGraph Cosmo stack, prioritizing SSE (Server-Sent Events) for subscriptions and leveraging Cosmo's gRPC capabilities for the GitHub REST API integration.

## Migration Overview

### Current Architecture
- **Gateway**: Apollo Gateway with federation (meta-gothic-app → gothic-gateway)
- **Services**: 3 federated GraphQL services:
  - claude-service (no change)
  - repo-agent-service → git-service
  - github-mesh → github-adapter
- **Subscriptions**: WebSocket-based using graphql-ws
- **GitHub Integration**: REST API wrapped with GraphQL Mesh

### Target Architecture
- **Gateway**: Cosmo Router (gothic-gateway) with SSE-first subscriptions
- **Services**: Renamed and adapted for Cosmo federation:
  - claude-service (GraphQL + SSE)
  - git-service (GraphQL + SSE)
  - github-adapter (gRPC)
- **Subscriptions**: SSE as primary protocol, WebSocket as fallback
- **GitHub Integration**: gRPC service using HashiCorp's go-plugin framework

## Phase 1: Cosmo Infrastructure Setup (Week 1)

### Day 1-2: Install Cosmo Stack

```bash
# Install Cosmo CLI
curl -fsSL https://cosmo.wundergraph.com/install.sh | bash

# Create workspace
cd /Users/josh/Documents/meta-gothic-framework
mkdir cosmo-config
cd cosmo-config

# Initialize Cosmo workspace
cosmo workspace create meta-gothic --plan oss

# Create federated graph
cosmo federated-graph create meta-gothic \
  --routing-url http://localhost:3000/graphql \
  --subscription-protocol sse
```

### Day 3-4: Configure Cosmo Router

Create `cosmo-router.yaml`:
```yaml
version: "1"

# Federation configuration
federation_version: 2.10

# Graph configuration from Cosmo Control Plane
graph:
  # Token will be set via environment variable
  token: "${COSMO_GRAPH_TOKEN}"

# Server configuration
server:
  listen_addr: "0.0.0.0:3000"
  playground:
    enabled: true
    path: /
  graphql:
    path: /graphql

# CORS configuration
cors:
  enabled: true
  allow_origins:
    - "http://localhost:3001"
    - "http://localhost:5173"
  allow_methods:
    - GET
    - POST
    - OPTIONS
  allow_headers:
    - Content-Type
    - Authorization
  allow_credentials: true

# Subscription configuration - SSE first
subscriptions:
  enabled: true
  protocols:
    # Server-Sent Events as primary
    - protocol: sse
      path: /graphql/stream
      # SSE-specific configuration
      heartbeat_interval: 30s
      compression: true
    # WebSocket as fallback
    - protocol: graphql-ws
      path: /graphql/ws
      subprotocols:
        - graphql-ws
        - graphql-transport-ws

# Subgraph configuration
subgraphs:
  - name: claude
    routing_url: "http://localhost:3002/graphql"
    subscription:
      enabled: true
      protocol: sse
      url: "http://localhost:3002/graphql/stream"
    headers:
      # Forward all headers to subgraph
      forward_all: true
      
  - name: git-service
    routing_url: "http://localhost:3004/graphql"
    subscription:
      enabled: true
      protocol: sse
      url: "http://localhost:3004/graphql/stream"
    headers:
      forward_all: true
      
  - name: github-adapter
    # Using gRPC for better performance
    routing_url: "grpc://localhost:3005"
    protocol: grpc
    # No subscriptions for GitHub service

# Traffic shaping and resilience
traffic_shaping:
  router:
    max_request_body_size: 5MB
    timeout: 30s
  
  all: # Applied to all subgraphs
    retry:
      enabled: true
      max_attempts: 3
      interval: "3s"
      backoff_multiplier: 2
    
    timeout:
      request: "10s"
      idle: "60s"

# Performance configuration
engine:
  # Query planning cache
  query_cache:
    enabled: true
    size: 1024
    ttl: 300s
  
  # DataLoader configuration
  dataloader:
    enabled: true
    cache_size: 1000
    batch_window: 2ms

# Telemetry configuration
telemetry:
  # Prometheus metrics
  metrics:
    prometheus:
      enabled: true
      path: /metrics
      listen_addr: "0.0.0.0:9090"
  
  # OpenTelemetry tracing
  tracing:
    enabled: true
    sampling_rate: 0.1
    jaeger:
      endpoint: "http://localhost:14268/api/traces"
  
  # Logging
  logging:
    level: info
    format: json
    # Log slow queries
    slow_query_log:
      enabled: true
      threshold: 100ms

# Security configuration
security:
  # Query depth limiting
  query_depth_limit: 15
  
  # Query complexity
  query_complexity:
    enabled: true
    max: 1000
    
  # Rate limiting
  rate_limiting:
    enabled: true
    window: 60s
    max_requests: 1000
    
  # Introspection control
  introspection:
    enabled: true
    # Only allow in development
    require_authentication: false

# Health checks
health_check:
  enabled: true
  path: /health
  # Check subgraph health
  check_subgraphs: true
```

### Day 5: Register Subgraphs with Cosmo

```bash
# Register Claude service
cosmo subgraph create claude \
  --federated-graph meta-gothic \
  --routing-url http://localhost:3002/graphql \
  --subscription-url http://localhost:3002/graphql/stream \
  --subscription-protocol sse

# Register Git service  
cosmo subgraph create git-service \
  --federated-graph meta-gothic \
  --routing-url http://localhost:3004/graphql \
  --subscription-url http://localhost:3004/graphql/stream \
  --subscription-protocol sse

# Register GitHub Adapter service (gRPC)
cosmo subgraph create github-adapter \
  --federated-graph meta-gothic \
  --routing-url grpc://localhost:3005 \
  --protocol grpc
```

## Phase 2: Service Migration to SSE (Week 2)

### Update Claude Service for SSE

1. **Install Dependencies**:
```bash
cd services/claude-service
npm install @graphql-yoga/plugin-sse @graphql-yoga/plugin-response-cache
```

2. **Update `index-federation.ts`**:
```typescript
import { createYoga } from 'graphql-yoga';
import { useSSE } from '@graphql-yoga/plugin-sse';
import { useResponseCache } from '@graphql-yoga/plugin-response-cache';
import { usePrometheus } from '@graphql-yoga/plugin-prometheus';

const yoga = createYoga({
  schema,
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  },
  plugins: [
    // SSE support for subscriptions
    useSSE({
      endpoint: '/graphql/stream',
      retry: 3000, // Client retry interval
      heartbeat: 30000, // Keep-alive heartbeat
    }),
    
    // Response caching
    useResponseCache({
      session: (request) => request.headers.get('authorization'),
      ttl: 60_000,
      ttlPerType: {
        ClaudeSession: 0, // Don't cache sessions
        AgentRun: 30_000,
      },
    }),
    
    // Prometheus metrics
    usePrometheus({
      endpoint: '/metrics',
      labels: {
        service: 'claude-service',
      },
    }),
    
    // Existing plugins...
  ],
  
  // SSE-specific subscription configuration
  subscriptions: {
    onConnect: async (ctx) => {
      console.log('SSE subscription connected');
      // Validate authentication if needed
      return true;
    },
    onDisconnect: async (ctx) => {
      console.log('SSE subscription disconnected');
      // Cleanup resources
    },
    onSubscribe: async (ctx, msg) => {
      // Log subscription start
      console.log('Subscription started:', msg.payload.operationName);
    },
  },
});

// Add SSE-specific middleware
app.use('/graphql/stream', (req, res, next) => {
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Keep connection alive
  req.socket.setTimeout(0);
  req.socket.setNoDelay(true);
  req.socket.setKeepAlive(true, 30000);
  
  next();
});
```

3. **Update Subscription Resolvers for SSE**:
```typescript
// subscriptions/commandOutput.ts
export const commandOutput = {
  subscribe: async function* (_, { sessionId }, context) {
    const sessionManager = context.sessionManager;
    
    // SSE heartbeat for keep-alive
    let lastActivity = Date.now();
    const heartbeatInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastActivity > 25000) { // Send heartbeat if no activity
        lastActivity = now;
        // Special heartbeat event
        return { 
          commandOutput: { 
            type: 'heartbeat', 
            content: '', 
            timestamp: new Date().toISOString() 
          } 
        };
      }
    }, 10000);
    
    try {
      for await (const output of sessionManager.subscribeToOutput(sessionId)) {
        lastActivity = Date.now();
        yield { commandOutput: output };
      }
    } finally {
      clearInterval(heartbeatInterval);
    }
  },
};
```

### Update Git Service for SSE

Similar updates to Claude service, with focus on:
- Adding SSE plugin to git-service (formerly repo-agent-service)
- Updating subscription resolvers for git operations
- Handling long-running git operations with proper streaming
- Ensuring non-blocking event loop for file system operations

### Convert GitHub Adapter Service to gRPC

1. **Create Proto Definition** (`github.proto`):
```protobuf
syntax = "proto3";

package github;

service GitHubService {
  rpc GetRepository(GetRepositoryRequest) returns (Repository);
  rpc ListRepositories(ListRepositoriesRequest) returns (RepositoryList);
  rpc GetWorkflowRuns(GetWorkflowRunsRequest) returns (WorkflowRunList);
  rpc TriggerWorkflow(TriggerWorkflowRequest) returns (WorkflowRun);
}

message GetRepositoryRequest {
  string owner = 1;
  string repo = 2;
}

message Repository {
  string id = 1;
  string name = 2;
  string owner = 3;
  string description = 4;
  int32 stars = 5;
  int32 forks = 6;
  // ... more fields
}
```

2. **Implement gRPC Service** (using Go with HashiCorp's go-plugin):
```go
// github-adapter/main.go
package main

import (
    "context"
    "log"
    "net"
    
    "google.golang.org/grpc"
    "github.com/google/go-github/v50/github"
    "golang.org/x/oauth2"
    pb "github.com/meta-gothic/github-adapter/proto"
)

type githubService struct {
    pb.UnimplementedGitHubServiceServer
    client *github.Client
}

func NewGitHubService(token string) *githubService {
    ctx := context.Background()
    ts := oauth2.StaticTokenSource(
        &oauth2.Token{AccessToken: token},
    )
    tc := oauth2.NewClient(ctx, ts)
    
    return &githubService{
        client: github.NewClient(tc),
    }
}

const githubService = {
  GetRepository: async (call, callback) => {
    try {
      const { owner, repo } = call.request;
      const { data } = await octokit.repos.get({ owner, repo });
      
      callback(null, {
        id: data.id.toString(),
        name: data.name,
        owner: data.owner.login,
        description: data.description || '',
        stars: data.stargazers_count,
        forks: data.forks_count,
      });
    } catch (error) {
      callback(error);
    }
  },
  // ... more methods
};

// Start gRPC server
const server = new grpc.Server();
server.addService(githubProto.GitHubService.service, githubService);
server.bindAsync('0.0.0.0:3005', grpc.ServerCredentials.createInsecure(), () => {
  console.log('GitHub gRPC service running on port 3005');
  server.start();
});
```

## Phase 3: Client Migration (Week 3)

### Update Apollo Client for SSE

1. **Install SSE Client**:
```bash
npm install graphql-sse
```

2. **Create SSE Link**:
```typescript
import { createClient } from 'graphql-sse';
import { ApolloClient, InMemoryCache, split } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { HttpLink } from '@apollo/client/link/http';

// HTTP link for queries and mutations
const httpLink = new HttpLink({
  uri: 'http://localhost:3000/graphql',
});

// SSE client for subscriptions
const sseClient = createClient({
  url: 'http://localhost:3000/graphql/stream',
  headers: {
    Authorization: `Bearer ${getAuthToken()}`,
  },
  retry: (retries) => {
    // Exponential backoff
    return Math.min(1000 * 2 ** retries, 30000);
  },
  onMessage: (message) => {
    // Handle heartbeat messages
    if (message.data?.type === 'heartbeat') {
      console.log('Received heartbeat');
      return;
    }
  },
});

// SSE link for Apollo Client
const sseLink = {
  request: (operation) => {
    return new Observable((observer) => {
      const unsubscribe = sseClient.subscribe(
        {
          query: operation.query,
          variables: operation.variables,
          operationName: operation.operationName,
        },
        {
          next: (data) => observer.next(data),
          error: (err) => observer.error(err),
          complete: () => observer.complete(),
        }
      );
      
      return () => unsubscribe();
    });
  },
};

// Split link based on operation type
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  sseLink,
  httpLink
);

// Create Apollo Client
const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});
```

3. **Update Subscription Components**:
```typescript
// Example: CommandOutput component
const CommandOutputSubscription = ({ sessionId }) => {
  const { data, loading, error } = useSubscription(COMMAND_OUTPUT_SUBSCRIPTION, {
    variables: { sessionId },
    // Handle reconnection
    shouldResubscribe: true,
    onSubscriptionData: ({ subscriptionData }) => {
      // Filter out heartbeat messages
      if (subscriptionData.data?.commandOutput?.type === 'heartbeat') {
        return;
      }
      // Process actual data
      handleCommandOutput(subscriptionData.data.commandOutput);
    },
  });
  
  // Component logic...
};
```

## Phase 4: Deployment & Migration (Week 4)

### Day 1-2: Update PM2 Configuration

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'gothic-gateway',
      script: 'cosmo',
      args: 'router start --config ./cosmo-router.yaml',
      cwd: './services/gothic-gateway',
      env: {
        COSMO_GRAPH_TOKEN: process.env.COSMO_GRAPH_TOKEN,
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/cosmo-router-error.log',
      out_file: './logs/cosmo-router-out.log',
      merge_logs: true,
    },
    // ... other services
  ],
};
```

### Day 3-4: Migration Strategy

1. **Parallel Running**:
   - Run both Apollo Gateway and Cosmo Router
   - Use feature flags to switch between them
   - Monitor performance and errors

2. **Gradual Migration**:
   - Start with read-only operations
   - Migrate subscriptions to SSE
   - Finally migrate mutations

3. **Rollback Plan**:
   - Keep Apollo Gateway configuration
   - One-line switch back if issues
   - Monitor error rates closely

### Day 5: Production Cutover

```bash
# Final deployment steps
cosmo federated-graph publish meta-gothic \
  --schema ./supergraph.graphql

# Update DNS/load balancer to point to Cosmo Router
# Monitor metrics and logs
# Remove Apollo Gateway after 1 week of stable operation
```

## Phase 5: Optimization & Monitoring (Week 5)

### Performance Optimization

1. **Configure Edge Caching**:
```yaml
# Add to cosmo-router.yaml
caching:
  rules:
    - type: query
      name: getRepository
      ttl: 300s
      scope: public
    - type: query
      name: gitStatus
      ttl: 60s
      scope: private
```

2. **Implement Request Batching**:
```yaml
batching:
  enabled: true
  max_batch_size: 10
  timeout: 10ms
```

### Monitoring Setup

1. **Prometheus Metrics**:
   - Request duration by operation
   - Subscription connection count
   - SSE heartbeat success rate
   - gRPC call performance

2. **Grafana Dashboards**:
   - Real-time router performance
   - Subgraph health status
   - Subscription lifecycle
   - Error rates and types

3. **Alerting Rules**:
   - High error rate (> 1%)
   - Slow queries (> 1s)
   - Subscription failures
   - Memory/CPU thresholds

## Benefits of Full Cosmo Stack

### 1. **SSE Advantages**
- Works through proxies/firewalls
- Automatic reconnection
- Lower overhead than WebSocket
- Better for one-way data flow

### 2. **gRPC for GitHub**
- Binary protocol efficiency
- Streaming support
- Better error handling
- Type-safe with protobuf

### 3. **Cosmo Router Features**
- Built-in rate limiting
- Advanced caching strategies
- Native OpenTelemetry support
- Hot configuration updates

### 4. **Developer Experience**
- Cosmo Studio for visualization
- Better debugging tools
- Automatic documentation
- Performance insights

## Success Criteria

1. **Performance**:
   - 50% reduction in subscription overhead
   - 30% faster GitHub API calls via gRPC
   - < 10ms router overhead

2. **Reliability**:
   - 99.9% uptime
   - Automatic reconnection for SSE
   - Graceful degradation

3. **Developer Productivity**:
   - Faster schema updates
   - Better error messages
   - Simplified debugging

## Rollback Strategy

If issues arise:
1. Switch back to Apollo Gateway (1 line change in PM2)
2. Revert client SSE changes (feature flag)
3. Keep gRPC service as it's backward compatible
4. Document lessons learned

## Timeline Summary

- **Week 1**: Cosmo infrastructure setup
- **Week 2**: Service migration to SSE
- **Week 3**: Client updates
- **Week 4**: Deployment and migration
- **Week 5**: Optimization and monitoring

Total effort: 5 weeks for complete migration to full Cosmo stack with SSE and gRPC.