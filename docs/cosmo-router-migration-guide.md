# Migration Guide: Apollo Gateway to Cosmo Router with SSE Federation

## Overview

This document outlines the migration from Apollo Gateway to Cosmo Router, with a focus on implementing Server-Sent Events (SSE) for federated subscriptions.

## Why Cosmo Router?

### Key Advantages
- **Native SSE Support**: Built-in support for Server-Sent Events alongside WebSocket protocols
- **Performance**: Written in Go for superior performance and lower resource consumption
- **Federation v2 Compatible**: Full support for Apollo Federation v1 and v2
- **Multiple Subscription Protocols**: SSE, WebSocket (graphql-ws), Multipart HTTP
- **Hot Reloading**: Configuration updates without downtime
- **Better Resource Management**: Multiplexes long-lived connections to subgraphs

### SSE vs WebSocket for Subscriptions
- **SSE Advantages**:
  - Works over standard HTTP/2
  - Better proxy and firewall compatibility
  - Automatic reconnection built into browsers
  - Lower complexity for one-way data flow
  - No special libraries needed on client side
- **Use SSE When**:
  - You only need server-to-client updates (most subscription use cases)
  - You want better infrastructure compatibility
  - You prefer simpler client implementation

## Migration Steps

### Phase 1: Preparation

1. **Audit Current Setup**
   ```bash
   # Document current Apollo Gateway configuration
   - Service URLs and ports
   - Custom plugins and middleware
   - Authentication/authorization logic
   - CORS configuration
   - Health check endpoints
   ```

2. **Review Subscription Usage**
   - Identify all subscription types in your schema
   - Document current WebSocket implementation
   - List clients using subscriptions

### Phase 2: Install Cosmo Router

1. **Download Cosmo Router**
   ```bash
   # For macOS ARM64
   curl -fsSL https://cosmo.wundergraph.com/install.sh | bash
   
   # Or via Docker
   docker pull wundergraph/cosmo-router:latest
   ```

2. **Create Router Configuration**
   ```yaml
   # router.yaml
   version: "1"
   
   graph:
     token: "${GRAPH_API_TOKEN}" # From Cosmo Studio
   
   cors:
     origins:
       - "http://localhost:3001"
       - "http://localhost:5173"
     methods:
       - GET
       - POST
     headers:
       - Content-Type
       - Authorization
   
   # Enable SSE for subscriptions
   subscriptions:
     enabled: true
     protocols:
       # Prefer SSE over WebSocket
       - sse
       - graphql-ws
     
   # Subgraph configuration
   subgraphs:
     - name: claude-service
       routing_url: "http://localhost:3002/graphql"
       subscription_url: "http://localhost:3002/graphql/stream"
       subscription_protocol: "sse"
       
     - name: git-service
       routing_url: "http://localhost:3004/graphql"
       subscription_url: "http://localhost:3004/graphql/stream"
       subscription_protocol: "sse"
       
     - name: github-adapter
       routing_url: "grpc://localhost:3005"
       protocol: "grpc"
   
   # Performance optimizations
   traffic_shaping:
     router:
       max_request_body_size: 5MB
     all: # Rules for all subgraphs
       retry:
         enabled: true
         max_attempts: 3
         interval: 3s
   ```

### Phase 3: Update Subgraphs for SSE

1. **Update Claude Service** (`/services/claude-service/src/index-federation.ts`)
   ```typescript
   import { createYoga } from 'graphql-yoga';
   import { useSSE } from '@graphql-yoga/plugin-sse';
   
   const yoga = createYoga({
     schema,
     plugins: [
       // Add SSE plugin for subscriptions
       useSSE({
         endpoint: '/graphql/stream',
         // Configure SSE-specific options
         credentials: 'same-origin',
       }),
       // Keep existing plugins
     ],
     // Enable subscriptions
     subscriptions: {
       onConnect: (ctx) => {
         console.log('SSE subscription connected');
       },
       onDisconnect: (ctx) => {
         console.log('SSE subscription disconnected');
       },
     },
   });
   ```

2. **Update Subscription Resolvers**
   ```typescript
   // Example: Update commandOutput subscription for SSE
   export const commandOutput = {
     subscribe: async function* (_, { sessionId }, context) {
       const sessionManager = context.sessionManager;
       
       // SSE requires explicit heartbeat for keep-alive
       const heartbeatInterval = setInterval(() => {
         yield { commandOutput: { type: 'heartbeat', content: '', timestamp: new Date().toISOString() } };
       }, 30000);
       
       try {
         // Existing subscription logic
         for await (const output of sessionManager.subscribeToOutput(sessionId)) {
           yield { commandOutput: output };
         }
       } finally {
         clearInterval(heartbeatInterval);
       }
     },
   };
   ```

3. **Add SSE Headers to Subgraphs**
   ```typescript
   // Add to Express middleware
   app.use('/graphql/stream', (req, res, next) => {
     res.setHeader('Content-Type', 'text/event-stream');
     res.setHeader('Cache-Control', 'no-cache');
     res.setHeader('Connection', 'keep-alive');
     res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
     next();
   });
   ```

### Phase 4: Client Updates

1. **Update Apollo Client for SSE**
   ```typescript
   import { createClient } from 'graphql-sse';
   
   const sseClient = createClient({
     url: 'http://localhost:3000/graphql/stream',
     headers: {
       Authorization: `Bearer ${token}`,
     },
   });
   
   // Use for subscriptions
   const subscription = sseClient.subscribe({
     query: `
       subscription CommandOutput($sessionId: ID!) {
         commandOutput(sessionId: $sessionId) {
           type
           content
           timestamp
         }
       }
     `,
     variables: { sessionId },
   });
   ```

2. **Native EventSource Alternative**
   ```typescript
   // For simple subscriptions, use native EventSource
   const eventSource = new EventSource(
     `http://localhost:3000/graphql/stream?` + 
     `query=${encodeURIComponent(subscriptionQuery)}&` +
     `variables=${encodeURIComponent(JSON.stringify(variables))}`
   );
   
   eventSource.onmessage = (event) => {
     const data = JSON.parse(event.data);
     // Handle subscription data
   };
   
   eventSource.onerror = (error) => {
     // EventSource automatically reconnects
     console.error('SSE error:', error);
   };
   ```

### Phase 5: Testing & Validation

1. **Test SSE Subscriptions**
   ```bash
   # Test SSE endpoint directly
   curl -N -H "Accept: text/event-stream" \
     "http://localhost:3000/graphql/stream?query=subscription{...}"
   ```

2. **Validate Federation**
   ```bash
   # Use Cosmo CLI to validate schema
   cosmo subgraph check claude-service --schema ./claude-schema.graphql
   cosmo subgraph check git-service --schema ./git-schema.graphql
   cosmo subgraph check github-adapter --schema ./github.proto
   ```

3. **Performance Testing**
   - Monitor connection count reduction
   - Measure latency improvements
   - Check memory usage under load

### Phase 6: Deployment

1. **Update PM2 Configuration**
   ```javascript
   // ecosystem.config.cjs
   {
     name: 'gothic-gateway',
     script: 'cosmo',
     args: 'router --config ./router.yaml',
     cwd: './services/gothic-gateway',
     env: {
       GRAPH_API_TOKEN: process.env.COSMO_GRAPH_TOKEN,
       PORT: 3000,
     },
   }
   ```

2. **Update Docker Compose** (if applicable)
   ```yaml
   gateway:
     image: wundergraph/cosmo-router:latest
     volumes:
       - ./router.yaml:/router.yaml
     environment:
       - GRAPH_API_TOKEN=${COSMO_GRAPH_TOKEN}
     ports:
       - "3000:3000"
   ```

## Service-Specific Updates

### Claude Service Requirements
- Add `@graphql-yoga/plugin-sse` dependency
- Implement heartbeat in long-running subscriptions
- Update subscription resolvers to handle SSE disconnections gracefully

### Git Service Requirements
- Similar updates as Claude Service
- Ensure git operations don't block SSE event loop
- Consider chunking large diff outputs
- Handle file system operations asynchronously

### GitHub Adapter Service
- Convert to gRPC protocol for better performance
- Implement with HashiCorp's go-plugin framework
- Use Protocol Buffers for type safety
- Enable connection pooling and multiplexing

## Monitoring & Observability

### Cosmo Router Metrics
- Built-in Prometheus metrics at `/metrics`
- OpenTelemetry support for distributed tracing
- Real-time dashboard in Cosmo Studio

### SSE-Specific Monitoring
```yaml
# Add to router.yaml
telemetry:
  metrics:
    prometheus:
      enabled: true
      path: /metrics
  tracing:
    enabled: true
    sampling_rate: 0.1
```

## Rollback Strategy

1. Keep Apollo Gateway configuration intact
2. Use feature flags to switch between gateways
3. Implement health checks for both gateways
4. Monitor error rates during migration

## Common Issues & Solutions

### Issue: SSE Connections Dropping
**Solution**: 
- Add keepalive heartbeats
- Configure proxy timeouts
- Use HTTP/2 for better connection handling

### Issue: Authentication with SSE
**Solution**:
- Pass auth tokens as query parameters for EventSource
- Or use cookies with appropriate CORS settings
- Consider using graphql-sse client for better auth handling

### Issue: Large Subscription Payloads
**Solution**:
- Implement pagination in subscriptions
- Use compression (gzip/brotli)
- Consider switching to WebSocket for binary data

## Recommended Timeline

1. **Week 0**: Complete service renaming (git-service, github-adapter, gothic-gateway)
2. **Week 1**: Setup Cosmo Router, test with mock data
3. **Week 2**: Update git-service with SSE support
4. **Week 3**: Update claude-service and convert github-adapter to gRPC
5. **Week 4**: Client migration and testing
6. **Week 5**: Production deployment with monitoring

## Additional Resources

- [Cosmo Documentation](https://cosmo-docs.wundergraph.com/)
- [GraphQL SSE Specification](https://github.com/graphql/graphql-over-http/blob/main/rfcs/ServerSentEvents.md)
- [Cosmo Router GitHub](https://github.com/wundergraph/cosmo)
- [Migration Support](https://wundergraph.com/contact)