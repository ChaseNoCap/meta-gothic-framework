#!/bin/bash
# GitHub Mesh startup script with proper error handling

echo "[$(date)] Starting GitHub Mesh service..." | tee -a ./logs/startup.log

# Check for required environment variables
if [ -z "$GITHUB_TOKEN" ]; then
    echo "[$(date)] ERROR: GITHUB_TOKEN environment variable is not set" | tee -a ./logs/startup.log
    exit 1
fi

# Patch OpenAPI spec if needed
if [ ! -f "./github-openapi-patched.json" ] || [ "./patch-openapi.cjs" -nt "./github-openapi-patched.json" ]; then
    echo "[$(date)] Patching GitHub OpenAPI spec..." | tee -a ./logs/startup.log
    node patch-openapi.cjs 2>&1 | tee -a ./logs/startup.log
fi

# Build mesh artifacts
echo "[$(date)] Building mesh artifacts..." | tee -a ./logs/startup.log
node ./node_modules/.bin/mesh build 2>&1 | tee -a ./logs/startup.log
if [ $? -ne 0 ]; then
    echo "[$(date)] ERROR: Mesh build failed" | tee -a ./logs/startup.log
    exit 1
fi

# Start the mesh server
echo "[$(date)] Starting mesh server on port ${PORT:-3005}..." | tee -a ./logs/startup.log
exec node ./node_modules/.bin/mesh serve --port ${PORT:-3005} 2>&1 | tee -a ./logs/startup.log