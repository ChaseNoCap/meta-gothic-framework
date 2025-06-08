# Local Development Setup with SSE Support

This guide explains how to run the metaGOTHIC framework locally with Server-Sent Events (SSE) support for real-time subscriptions.

## Overview

The Gothic Gateway now supports SSE subscriptions alongside traditional GraphQL queries and mutations. This provides real-time capabilities without the complexity of WebSocket federation.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐
│   UI (React)    │────▶│  Gothic Gateway  │
│ Apollo Client   │     │  (Port 3000)     │
└─────────────────┘     └────────┬─────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│ Claude Service│      │  Git Service  │      │GitHub Adapter │
│  (Port 3002)  │      │  (Port 3003)  │      │  (Port 3005)  │
│   GraphQL     │      │   GraphQL     │      │   GraphQL     │
│   + SSE       │      │   (No SSE)    │      │   (No SSE)    │
└───────────────┘      └───────────────┘      └───────────────┘
```

## Quick Start

### 1. Start All Services with SSE

```bash
# Option 1: Use PM2 (Recommended)
pm2 start ecosystem.config.cjs

# Option 2: Use the SSE startup script
cd services
./start-sse-services.sh

# Option 3: Start services individually
cd services/claude-service && npm run dev:sse &
cd services/git-service && npm run dev:sse &
cd services/github-adapter && npm run serve:federation &
cd services/gothic-gateway && npm run dev:sse &
```

### 2. Verify Services

```bash
# Test the SSE gateway
./services/gothic-gateway/test-sse-gateway.sh

# Or manually check endpoints
curl http://localhost:3000/health
curl http://localhost:3002/graphql -X POST -H "Content-Type: application/json" -d '{"query":"{__typename}"}'
curl http://localhost:3004/graphql -X POST -H "Content-Type: application/json" -d '{"query":"{__typename}"}'
curl http://localhost:3005/graphql -X POST -H "Content-Type: application/json" -d '{"query":"{__typename}"}'
```

### 3. Access Points

- **Gothic Gateway**: http://localhost:3000/graphql
- **GraphiQL Playground**: http://localhost:3000/graphql
- **SSE Endpoint**:
  - Claude: http://localhost:3000/graphql/stream/claude
- **UI Dashboard**: http://localhost:3001

## Service Configuration

### Gothic Gateway (SSE Mode)

The gateway runs in SSE mode with Apollo Federation for queries/mutations and custom SSE proxy for subscriptions.

```typescript
// Configuration in gateway-sse-simple.ts
const services = [
  { name: 'claude', url: 'http://localhost:3002/graphql' },
  { name: 'git', url: 'http://localhost:3004/graphql' },
  { name: 'github', url: 'http://localhost:3005/graphql' }
];

const SSE_ENDPOINTS = {
  claude: 'http://localhost:3002/graphql/stream'
  // git: No SSE endpoint - service has no subscriptions
};
```

### Claude Service (SSE Enabled)

```yaml
# Endpoints
GraphQL: http://localhost:3002/graphql
SSE Stream: http://localhost:3002/graphql/stream

# Available Subscriptions
- commandOutput(sessionId: String!)
- agentRunProgress(runId: ID!)
- sessionUpdated(sessionId: String!)
```

### Git Service (No SSE)

```yaml
# Endpoints
GraphQL: http://localhost:3003/graphql

# No subscriptions defined - queries and mutations only
# If real-time features are needed, subscriptions must be added to schema first
```

### GitHub Adapter (GraphQL Only)

```yaml
# Endpoints
GraphQL: http://localhost:3005/graphql

# No subscriptions - queries and mutations only
```

## Testing Subscriptions

### Using GraphiQL

1. Open http://localhost:3000/graphql
2. Run a subscription:

```graphql
subscription WatchCommands {
  commandOutput(sessionId: "test-session") {
    sessionId
    output
    timestamp
  }
}
```

### Using curl

```bash
# Test Claude subscription
curl -N -X POST http://localhost:3000/graphql/stream/claude \
  -H "Accept: text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "subscription { commandOutput(sessionId: \"test\") { output } }"
  }'

# Git Service has no subscriptions
# If real-time features are needed, add subscriptions to the schema first
```

### Using Node.js Client

```javascript
const EventSource = require('eventsource');

const es = new EventSource('http://localhost:3000/graphql/stream/claude', {
  headers: {
    'Content-Type': 'application/json'
  }
});

es.onmessage = (event) => {
  console.log('Received:', event.data);
};
```

## Environment Variables

```bash
# Required for GitHub Adapter
export GITHUB_TOKEN=your_github_token

# Optional
export PORT=3000              # Gateway port
export NODE_ENV=development   # Environment
export LOG_LEVEL=debug        # Logging level
```

## Troubleshooting

### Service Won't Start

```bash
# Check if ports are in use
lsof -i :3000,3002,3004,3005

# Kill processes if needed
kill -9 $(lsof -t -i:3000)

# Check logs
pm2 logs
```

### SSE Connection Drops

- SSE connections include automatic heartbeat every 30 seconds
- Check browser console for reconnection attempts
- Verify CORS settings match your client origin

### Subscription Not Working

1. Verify service is running: `curl http://localhost:3002/graphql/stream`
2. Check service supports SSE: Look for `/graphql/stream` endpoint
3. Verify subscription syntax in GraphQL schema
4. Check browser DevTools Network tab for SSE connection

### CORS Issues

The gateway is configured to allow:
- Origin: http://localhost:3001
- Credentials: true

Modify in `gateway-sse-simple.ts` if needed.

## Development Workflow

1. **Make Changes**: Edit service code
2. **Restart Service**: PM2 will auto-restart or manually restart
3. **Test Endpoint**: Use test script or GraphiQL
4. **Check Logs**: `pm2 logs [service-name]`

## Next Steps

- Configure Apollo Client for SSE (see apollo-client-sse-setup.md)
- Test real-time features in UI
- Monitor performance with SSE connections
- Plan production deployment strategy

## SSE vs WebSocket Comparison

| Feature | SSE | WebSocket |
|---------|-----|-----------|
| Protocol | HTTP | WS/WSS |
| Direction | Server→Client | Bidirectional |
| Reconnection | Automatic | Manual |
| Proxy Support | Excellent | Limited |
| Browser Support | Good | Excellent |
| Message Format | Text only | Text/Binary |
| Federation | Custom | Complex |

For GraphQL subscriptions, SSE provides a simpler, more reliable solution with automatic reconnection and better infrastructure compatibility.