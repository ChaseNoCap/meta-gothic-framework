# Federation Mode Configuration

## Overview

The Meta-Gothic Framework now runs in Apollo Federation v2 mode by default. This document explains the configuration changes and how to manage the services.

## Configuration Changes

### ecosystem.config.cjs

The PM2 ecosystem configuration has been updated to run services in federation mode:

1. **Claude Service**: Uses `index-federation.ts` instead of `index-yoga.ts`
2. **Repo Agent Service**: Uses `index-federation.ts` instead of `index-yoga.ts`
3. **Gateway**: Uses `gateway-federation.ts` instead of `gateway.ts`
4. **GitHub Mesh**: Temporarily disabled due to dependency issues

### Service Endpoints

- **Gateway (Federation)**: http://localhost:3000/graphql
- **Claude Service**: http://localhost:3002/graphql
- **Repo Agent Service**: http://localhost:3004/graphql
- **UI**: http://localhost:3001

## Starting Services

### Default Mode (Federation)

```bash
npm run start
```

This will start all services in federation mode using PM2.

### Manual Federation Mode

If you need to start services manually:

```bash
# Terminal 1 - Claude Service
cd services/claude-service
npm run dev:federation

# Terminal 2 - Repo Agent Service  
cd services/repo-agent-service
npm run dev:federation

# Terminal 3 - Gateway
cd services/meta-gothic-app
npm run dev:federation

# Terminal 4 - UI
cd packages/ui-components
npm run dev
```

### Legacy Stitching Mode

If you need to run in the old stitching mode for any reason:

```bash
# Temporarily edit ecosystem.config.cjs to use:
# - src/index-yoga.ts for services
# - src/gateway.ts for gateway

npm run start
```

## Monitoring

The monitor script (`scripts/monitor.cjs`) works with both federation and stitching modes. It displays:
- Service health status
- Port availability
- Real-time logs
- Performance metrics

## Troubleshooting

### Schema Composition Errors

If you see "Expected null to be a GraphQL schema" errors:

1. Ensure all services are running in the same mode (all federation or all stitching)
2. Check that services are healthy at their individual endpoints
3. Restart the gateway after all services are running

### Service Not Found

If the gateway can't find a service:

1. Verify the service is running on the correct port
2. Check the service implements the federation spec
3. Look at gateway logs for introspection errors

### Type Mismatch Errors

If you get type mismatch errors in the UI:

1. The gateway maintains backward compatibility
2. Old queries with type prefixes (`Claude_`, `Repo_`) still work
3. New queries without prefixes are preferred

## Benefits of Federation Mode

1. **Better Performance**: Query planning optimizes cross-service requests
2. **Service Independence**: Each service owns its schema
3. **Cleaner Types**: No more type prefixes needed
4. **Easier Scaling**: Services can be deployed independently

## Migration Notes

- The UI has been updated to work with both modes
- Type prefixes have been removed from new queries
- Federation examples are in `packages/ui-components/src/graphql/federation-operations.ts`
- The gateway automatically handles entity resolution between services