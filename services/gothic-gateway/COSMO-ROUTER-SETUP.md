# Cosmo Router Setup Guide

## Problem: Missing supergraphSdl

The Cosmo Router requires a `supergraphSdl` field in its execution configuration. This field contains the composed federated schema from all subgraphs.

### Error Message
```
"could not load GraphQL schema for data source 0: no string found for key """
```

This error occurs because the router is looking for the supergraph SDL but can't find it in the configuration.

## Solution: Use wgc compose

The proper way to generate a Cosmo Router configuration is using the `wgc` (WunderGraph CLI) compose command.

### Prerequisites

1. **All services must be running** with their federation endpoints available:
   - Claude Service: http://localhost:3002/graphql
   - Git Service: http://localhost:3003/graphql
   - GitHub Adapter: http://localhost:3005/graphql

2. **Schema files must exist**:
   - `../claude-service/schema/schema-federated.graphql`
   - `../git-service/schema/schema-federated.graphql`
   - `../github-adapter/schema.graphql`

3. **wgc CLI must be installed**:
   ```bash
   npm install -g @wundergraph/cosmo-cli
   ```

### Configuration Files

1. **compose.yaml** - Defines the subgraphs:
   ```yaml
   version: 1
   subgraphs:
     - name: claude
       routing_url: http://localhost:3002/graphql
       schema:
         file: ../claude-service/schema/schema-federated.graphql
     
     - name: git
       routing_url: http://localhost:3003/graphql
       schema:
         file: ../git-service/schema/schema-federated.graphql
     
     - name: github
       routing_url: http://localhost:3005/graphql
       schema:
         file: ../github-adapter/schema.graphql
   ```

2. **router.yaml** - Router configuration:
   ```yaml
   version: "1"
   dev_mode: true
   listen_addr: "localhost:4000"
   log_level: "debug"
   
   playground:
     enabled: true
     path: /
   
   engine:
     enable_single_flight: true
     enable_request_tracing: true
   
   cors:
     allow_origins: ["*"]
     allow_methods: ["HEAD", "GET", "POST", "OPTIONS"]
     allow_headers: ["*"]
     allow_credentials: true
   
   execution_config:
     file:
       path: "./config.json"
   ```

### Generating the Configuration

Run the provided script:
```bash
./generate-cosmo-supergraph.sh
```

Or manually:
```bash
wgc router compose --config compose.yaml --out config.json
```

### What the Configuration Contains

The generated `config.json` will include:
- `supergraphSdl`: The composed federated schema
- `engineConfig`: Data source configurations for each subgraph
- Federation settings for each service
- SSE subscription endpoints for real-time features

### Starting the Router

Once the configuration is generated:
```bash
# Direct start
./router/router -config router.yaml

# Or with PM2
pm2 start ecosystem.config.cjs
```

### Troubleshooting

1. **Services not available**: Make sure all services are running before composing
2. **Schema files missing**: Check that all schema files exist at the specified paths
3. **wgc not found**: Install with `npm install -g @wundergraph/cosmo-cli`
4. **Composition errors**: Check individual service schemas for federation compliance

### Alternative: Manual Configuration

If `wgc` is not available, you can use the `generate-complete-config.sh` script which:
1. Fetches SDL from running services via introspection
2. Manually constructs a basic supergraph SDL
3. Creates the config.json with all necessary fields

However, using `wgc compose` is the recommended approach for proper federation composition.