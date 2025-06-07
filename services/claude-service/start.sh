#!/bin/bash

# Claude Service startup script
echo "Starting Claude Service..."

# Change to service directory
cd "$(dirname "$0")"

# Export environment variables
export NODE_ENV=${NODE_ENV:-development}
export PORT=${PORT:-3002}
export CLAUDE_PORT=${PORT:-3002}
export WORKSPACE_ROOT=${WORKSPACE_ROOT:-$(pwd)/../..}

# Start the service
exec npx tsx src/index.ts