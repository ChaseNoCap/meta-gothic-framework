# Cosmo Federation v2 Migration Plan

## 🚨 CRITICAL: Complete Local Federation Setup

This document outlines the migration from Yoga/Apollo/Mesh to a pure Cosmo Router Federation v2 setup.

## Current Issue

The Cosmo Router is failing with:
```
"could not load GraphQL schema for data source 0: no string found for key """
```

### Root Cause
The `wgc router compose` command generates an incomplete configuration that's missing the required `supergraphSdl` field. The router expects a complete federated supergraph schema but only receives individual subgraph configurations.

## Requirements

- ✅ **Cosmo Router** - Local federation without cloud services
- ✅ **Federation v2** - Modern federation standard
- ✅ **SSE Support** - For Claude service subscriptions
- ❌ **NO Yoga** - Remove all Yoga servers
- ❌ **NO Apollo Server** - Keep Apollo Client in UI only
- ❌ **NO GraphQL Mesh** - Remove all Mesh configurations
- ❌ **NO Cloud Dependencies** - Everything runs locally

## Migration Order

### Phase 1: Clean Up Legacy Code

1. **Remove Yoga Dependencies**
   ```bash
   # From each service directory
   npm uninstall @graphql-yoga/node graphql-yoga
   rm -f src/index-yoga.ts src/index-sse.ts
   ```

2. **Remove Apollo Server**
   ```bash
   npm uninstall @apollo/server @apollo/subgraph
   rm -f src/index-apollo.ts
   ```

3. **Remove GraphQL Mesh**
   ```bash
   npm uninstall @graphql-mesh/cli @graphql-mesh/graphql
   rm -rf .mesh/ mesh.config.js
   ```

4. **Clean Gateway Directory**
   - Delete experimental files: `yoga-mesh-gateway.ts`, `simple-gateway.ts`, etc.
   - Archive old configs to `_archive/` directory

### Phase 2: Implement Cosmo Subgraphs

#### Claude Service Migration

1. **Install Cosmo Dependencies**
   ```bash
   npm install @wundergraph/cosmo-gateway @wundergraph/cosmo-shared
   ```

2. **Create Cosmo Subgraph Server**
   ```typescript
   // src/index.ts
   import { createSubgraph } from '@wundergraph/cosmo-gateway';
   
   const server = createSubgraph({
     schema: readFileSync('./schema/schema-federated.graphql', 'utf8'),
     resolvers,
     port: 3002,
     path: '/graphql',
     subscriptions: {
       enabled: true,
       protocol: 'SSE',
       path: '/graphql/stream'
     }
   });
   ```

3. **Update Federation Schema**
   ```graphql
   extend schema
     @link(url: "https://specs.apollo.dev/federation/v2.0", 
           import: ["@key", "@shareable", "@external"])
   
   type ClaudeSession @key(fields: "id") {
     id: ID!
     # ... rest of schema
   }
   ```

#### Git Service Migration
- Follow same pattern as Claude Service
- Port: 3004
- Enable SSE for subscriptions

#### GitHub Adapter Migration
- Remove all Mesh configurations
- Implement as pure Cosmo subgraph
- Port: 3005

### Phase 3: Configure Cosmo Router

1. **Generate Supergraph Schema**
   ```bash
   wgc federated-graph compose \
     --output supergraph.graphql \
     --service claude:http://localhost:3002/graphql \
     --service git:http://localhost:3004/graphql \
     --service github:http://localhost:3005/graphql
   ```

2. **Create Proper Router Configuration**
   ```json
   {
     "version": "1",
     "supergraphSdl": "# Contents of supergraph.graphql",
     "engineConfig": {
       "datasourceConfigurations": [
         // ... subgraph configurations
       ]
     }
   }
   ```

3. **Start Router**
   ```bash
   ./router/router --config config.yaml
   ```

## Validation Steps

1. **Test Each Service Independently**
   ```bash
   curl -X POST http://localhost:3002/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"{ __typename }"}'
   ```

2. **Test Federation**
   ```graphql
   # Through router at :4000
   query TestFederation {
     sessions {
       id
       workingDirectory
     }
     gitStatus(path: ".") {
       branch
       isDirty
     }
   }
   ```

3. **Test SSE Subscriptions**
   ```graphql
   subscription WatchCommand {
     commandOutput(sessionId: "123") {
       content
       type
     }
   }
   ```

## Success Criteria

- [ ] All services respond to health checks
- [ ] Router starts without configuration errors
- [ ] All queries work through the router
- [ ] SSE subscriptions stream data correctly
- [ ] No Yoga/Apollo/Mesh code remains
- [ ] Clean startup with `npm start`

## Rollback Plan

If issues arise:
1. Git stash current changes
2. Checkout last working commit
3. Use `start-yoga-services.sh` temporarily
4. Debug issues in isolation

## Documentation Updates

After migration:
1. Update service README files
2. Update main CLAUDE.md
3. Create new architecture diagram
4. Document troubleshooting steps