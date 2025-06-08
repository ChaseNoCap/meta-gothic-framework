# Cosmo Router Migration Guide

**Last Updated**: January 7, 2025

## Overview

This document outlines the successful migration from Apollo Gateway to WunderGraph Cosmo Router for the metaGOTHIC framework. The migration is now complete with all services running under PM2 management.

## Migration Status: ✅ COMPLETE

### Completed Tasks

1. **Service Renaming** ✅
   - `github-mesh` → `github-adapter`
   - `meta-gothic-app` → `gothic-gateway`
   - `repo-agent-service` → `git-service`

2. **SSE Implementation** ✅
   - Created SSE-enabled versions of Claude and Git services
   - Added `/graphql/stream` endpoints for subscriptions
   - Implemented heartbeat mechanism for connection stability

3. **Cosmo Router Setup** ✅
   - Downloaded Cosmo Router binary to `services/gothic-gateway/router/`
   - Created local federation configuration
   - Implemented PM2 integration with `start-router-pm2.sh`
   - Router successfully federates all services

4. **PM2 Process Management** ✅
   - All services managed by PM2 ecosystem config
   - Proper startup order with health checks
   - Centralized logging and monitoring
   - Automatic restart on failure

5. **Federation Working** ✅
   - All subgraphs connected and responding
   - GraphQL queries work across services
   - UI dashboard fully operational
   - Health monitoring functional

## Service Architecture

### Current Working Setup ✅
```
gothic-gateway (Cosmo Router - PORT 4000)
├── claude-service (Federation v2 - PORT 3002)
├── git-service (Federation v2 - PORT 3004)
└── github-adapter (Federation v2 - PORT 3005)

UI Dashboard (React/Vite - PORT 3001)
└── Connects to gateway at localhost:4000/graphql
```

### PM2 Process Management
All services are managed by PM2 with the following configuration:
- `ecosystem.config.cjs` - PM2 configuration file
- Individual service logs in `logs/` directory
- Health checks and auto-restart enabled
- Environment variables properly loaded

## SSE Implementation Details

### Claude Service SSE Endpoint
- URL: `http://localhost:3002/graphql/stream`
- Supports all existing subscriptions via SSE
- Heartbeat every 30 seconds
- Auto-reconnect on client side

### Git Service SSE Endpoint
- URL: `http://localhost:3004/graphql/stream`
- File watching subscriptions
- Command output streaming
- Real-time git status updates

## Current Configuration

### Cosmo Router Configuration (`router.yaml`)
```yaml
version: '1'

dev_mode: true
log_level: debug

graph:
  token: 'local-token'

telemetry:
  service_name: 'cosmo-router'
  metrics:
    prometheus:
      enabled: true
      path: '/metrics'
      listen_addr: '0.0.0.0:8088'

engine:
  execution_config_storage_path: './config.json'
```

### PM2 Startup Script (`start-router-pm2.sh`)
```bash
#!/bin/bash
echo "Starting Cosmo Router for PM2..."
cd "$SCRIPT_DIR"
export CONFIG_PATH="${CONFIG_PATH:-./config.yaml}"
export EXECUTION_CONFIG_FILE_PATH="${EXECUTION_CONFIG_FILE_PATH:-./config.json}"
export DEV_MODE="${DEV_MODE:-true}"
exec ./router/router
```

## Configuration Files

### Local Federation Config (`graph.localhost.yaml`)
```yaml
version: '1'
subgraphs:
  - name: claude-service
    routing_url: http://localhost:3002/graphql
    schema:
      file: ../claude-service/schema/schema-federated.graphql
  - name: git-service
    routing_url: http://localhost:3004/graphql
    schema:
      file: ../git-service/schema/schema-federated.graphql
  - name: github-adapter
    routing_url: http://localhost:3005/graphql
    schema:
      file: ../github-adapter/schema.graphql
```

### Running Services
```bash
# Start all services with PM2 and monitor
npm start

# Start services without monitor (for testing)
npm start -- --no-monitor

# View service status
pm2 list

# View logs for specific service
pm2 logs gateway
pm2 logs claude-service

# Stop all services
pm2 stop all

# Restart a specific service
pm2 restart gateway
```

## Testing SSE Subscriptions

### Using EventSource API
```javascript
const eventSource = new EventSource('http://localhost:3002/graphql/stream', {
  headers: {
    'Content-Type': 'application/json'
  }
});

eventSource.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};
```

### Using GraphQL SSE Client
```javascript
import { createClient } from 'graphql-sse';

const client = createClient({
  url: 'http://localhost:3002/graphql/stream',
});

const unsubscribe = client.subscribe(
  {
    query: `subscription { commandOutput(sessionId: "123") }`
  },
  {
    next: (data) => console.log(data),
    error: (err) => console.error(err),
    complete: () => console.log('Complete')
  }
);
```

## Future Enhancements

1. **SSE Full Implementation**: Complete SSE support for real-time subscriptions
2. **gRPC Support**: Add gRPC endpoints for GitHub adapter
3. **Enhanced Monitoring**: Integrate Prometheus metrics from router
4. **Production Deployment**: Deploy with proper SSL and authentication
5. **Performance Optimization**: Add caching and query optimization

## SSE Federation Setup

For detailed instructions on setting up SSE subscriptions with Cosmo Router:
- [SSE Setup Guide](../services/gothic-gateway/README-SSE-SETUP.md)
- [Troubleshooting Guide](../services/gothic-gateway/TROUBLESHOOTING-CONFIG.md)
- Quick setup: Run `./setup-sse-federation.sh` in the gateway directory

## Resources

- [WunderGraph Cosmo Docs](https://cosmo-docs.wundergraph.com/)
- [GraphQL SSE Specification](https://github.com/enisdenjo/graphql-sse)
- [Apollo to Cosmo Migration Guide](https://cosmo-docs.wundergraph.com/guides/migration/apollo)
