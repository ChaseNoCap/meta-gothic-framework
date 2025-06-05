# Improved Error Visibility in metaGOTHIC Framework

## Problem Summary

During the GitHub Mesh service integration, we encountered a critical issue: startup errors were completely hidden from view. The service would fail silently with:
- Empty PM2 log files
- No error output when running commands
- Cryptic "Cannot find module" errors only visible when running directly with DEBUG=1

## Root Causes

1. **PM2 Configuration Issues**
   - Services failing during startup didn't log errors
   - `combine_logs` and `merge_logs` options were missing
   - No startup validation before launching services

2. **Silent Failures**
   - GraphQL Mesh CLI failed without proper error messages
   - Missing dependencies (`@graphql-mesh/transform-filter-schema`) weren't reported
   - Background processes swallowed errors

3. **No Pre-flight Checks**
   - Services started blindly without dependency validation
   - Configuration errors only discovered at runtime
   - No way to validate service health before full startup

## Solutions Implemented

### 1. Enhanced PM2 Configuration
```javascript
// ecosystem.config.cjs
{
  name: 'github-mesh',
  script: './start.sh',  // Custom startup script
  env: {
    DEBUG: '1'  // Enable verbose logging
  },
  combine_logs: true,    // Combine stdout and stderr
  merge_logs: true,      // Merge all log types
  autorestart: false,    // Don't hide errors by restarting
  max_restarts: 3        // Limit restart attempts
}
```

### 2. Service Startup Scripts
Created `services/github-mesh/start.sh`:
```bash
#!/bin/bash
# Validate configuration before starting
node ./node_modules/.bin/mesh validate 2>&1 | tee -a ./logs/startup.log
# Start with proper error capture
exec node ./node_modules/.bin/mesh serve --port ${PORT:-3005} 2>&1 | tee -a ./logs/startup.log
```

### 3. Pre-flight Check System
Created `scripts/preflight-check.cjs` that validates:
- Required files exist
- Environment variables are set
- Ports are available
- Service configurations are valid

### 4. Debug Helper Script
Created `scripts/debug-service.cjs`:
```bash
node scripts/debug-service.cjs github-mesh
# Shows service status, recent logs, and follows live output
```

### 5. Integrated Pre-flight into Startup
Modified `scripts/start.cjs` to:
- Run pre-flight checks before PM2 start
- Abort startup if checks fail
- Provide clear error messages

## Benefits

1. **Immediate Error Visibility**
   - Startup errors now appear in logs
   - Configuration issues caught before runtime
   - Clear error messages guide fixes

2. **Faster Debugging**
   - `debug-service.cjs` provides instant access to logs
   - Pre-flight checks identify issues upfront
   - Startup logs capture all output

3. **Better Developer Experience**
   - No more silent failures
   - Clear guidance on fixing issues
   - Validation before deployment

## Usage

### Running Pre-flight Checks
```bash
node scripts/preflight-check.cjs
```

### Debugging a Service
```bash
node scripts/debug-service.cjs github-mesh
```

### Starting with Validation
```bash
npm start  # Now includes pre-flight checks
```

### Manual Service Start (for debugging)
```bash
cd services/github-mesh
./start.sh
```

## Lessons Learned

1. **Always Capture Startup Errors**: Services should log startup failures prominently
2. **Validate Before Starting**: Pre-flight checks save debugging time
3. **Provide Debug Tools**: Helper scripts make troubleshooting easier
4. **Use Startup Scripts**: Wrapper scripts can add logging and validation
5. **Configure PM2 Properly**: Enable all logging options for better visibility

## Future Improvements

1. Add health check endpoints to all services
2. Implement centralized logging aggregation
3. Add startup dependency ordering
4. Create service-specific validation rules
5. Add automatic error reporting to Slack/Discord