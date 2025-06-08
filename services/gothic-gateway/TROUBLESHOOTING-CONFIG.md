# Cosmo Router Configuration Troubleshooting Guide

## Common Issues and Solutions

### Issue: "no string found for key" Error

**Symptom**: Router fails to start with error like:
```
failed to load configuration: could not load GraphQL schema for data source 0: no string found for key ""
```

**Cause**: The router configuration is missing the service SDL schemas.

**Solution**: 
1. Don't manually create the config.json file
2. Use `wgc router compose` to generate it:
   ```bash
   npx wgc router compose --input subgraph-config.yaml --out config.json
   ```

### Issue: "invalid character '\n' in string" Error

**Symptom**: Router fails with JSON parsing error:
```
proto: syntax error (line 26:27): invalid character '\n' in string
```

**Cause**: Improperly escaped SDL strings in manually created config.

**Solution**: Let `wgc` handle the escaping:
```bash
# DON'T manually fetch and escape SDLs
# DO use wgc compose
npx wgc router compose --input subgraph-config.yaml --out config.json
```

### Issue: Services Not Composing

**Symptom**: `wgc router compose` fails with federation errors.

**Debug Steps**:

1. Check each service implements federation:
   ```bash
   # Should return SDL schema
   curl -X POST http://localhost:3002/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"{ _service { sdl } }"}'
   ```

2. Verify _entities resolver:
   ```bash
   curl -X POST http://localhost:3002/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"{ _entities(representations: []) { __typename } }"}'
   ```

3. Check for @key directives on entities

### Issue: SSE Protocol Not Recognized

**Symptom**: Subscriptions don't work even though config generates successfully.

**Solution**: Ensure your subgraph-config.yaml uses correct protocol:
```yaml
subscription:
  url: http://localhost:3002/graphql/stream
  protocol: sse  # Must be lowercase
```

### Issue: Router Binary Not Found

**Symptom**: `./router: command not found`

**Solution**: 
1. Download the Cosmo Router binary:
   ```bash
   npx wgc router download
   ```
2. Make it executable:
   ```bash
   chmod +x router
   ```

## Config Generation Process

### What `wgc router compose` Does

1. **Reads** subgraph-config.yaml
2. **Introspects** each service (calls their GraphQL endpoints)
3. **Fetches** SDL from each service's `_service { sdl }` query
4. **Validates** federation compatibility
5. **Generates** optimized router configuration
6. **Outputs** complete config.json with:
   - Properly escaped SDL strings
   - Routing configurations
   - Subscription settings
   - Engine optimizations

### Config Structure Overview

The generated config.json contains:
```json
{
  "version": "string",
  "engineConfig": {
    "datasourceConfigurations": [
      {
        "kind": "GRAPHQL",
        "rootNodes": [...],
        "childNodes": [...],
        "customGraphql": {
          "fetch": {...},
          "subscription": {
            "enabled": true,
            "url": {...},
            "protocol": "GRAPHQL_SUBSCRIPTION_PROTOCOL_SSE"
          },
          "federation": {
            "enabled": true,
            "serviceSdl": "escaped SDL string here"
          }
        }
      }
    ]
  },
  "subgraphs": [...]
}
```

### Manual Config Generation (Not Recommended)

If you must create config manually:

1. **Fetch SDLs** from each service
2. **Properly escape** for JSON (newlines, quotes)
3. **Use correct protocol enum**: `GRAPHQL_SUBSCRIPTION_PROTOCOL_SSE`
4. **Include all required fields**

Better approach: Create a script that uses `wgc`:
```bash
#!/bin/bash
# regenerate-config.sh

echo "Regenerating Cosmo Router config..."

# Ensure services are running
echo "Checking services..."
for port in 3002 3003 3005; do
  if ! curl -s http://localhost:$port/health > /dev/null; then
    echo "❌ Service on port $port is not running!"
    exit 1
  fi
done

# Generate config
echo "Composing configuration..."
npx wgc router compose --input subgraph-config.yaml --out config.json

echo "✅ Config generated successfully!"
```

## Debugging Tools

### 1. Validate Subgraph Config

```bash
# Check YAML syntax
yamllint subgraph-config.yaml

# Validate structure
npx wgc router compose --input subgraph-config.yaml --dry-run
```

### 2. Inspect Generated Config

```bash
# Check if config is valid JSON
jq . config.json > /dev/null && echo "✅ Valid JSON"

# View structure
jq 'keys' config.json

# Check for SDL
jq '.engineConfig.datasourceConfigurations[0].customGraphql.federation.serviceSdl' config.json | head -c 100
```

### 3. Test Individual Services

```bash
# Test SSE endpoint
curl -N -H "Accept: text/event-stream" http://localhost:3002/graphql/stream

# Should see heartbeats after 30s:
# :heartbeat
```

### 4. Router Debug Mode

```yaml
# router.yaml
log_level: "debug"
dev_mode: true
engine:
  enable_request_tracing: true
```

## Quick Fixes

### Reset Everything

```bash
# Stop all services
pm2 stop all

# Clear any cached configs
rm -f config.json config-*.json

# Restart services
pm2 start ecosystem.config.cjs

# Wait for services to be ready
sleep 5

# Regenerate config
npx wgc router compose --input subgraph-config.yaml --out config.json

# Restart router
pm2 restart gateway
```

### Verify Working Setup

```bash
# Should return data from all services
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ 
      claudeHealth { healthy }
      repoAgentHealth { status }
      githubUser { login }
    }"
  }'
```

## Important Notes

1. **Never edit** config.json manually after generation
2. **Always regenerate** after schema changes
3. **Check service health** before composing
4. **Use version control** for subgraph-config.yaml
5. **Don't commit** generated config.json (it's build output)