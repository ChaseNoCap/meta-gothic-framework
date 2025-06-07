#!/bin/bash

# Git Service startup script
echo "Starting Git Service..."

# Change to service directory
cd "$(dirname "$0")"

# Export environment variables
export NODE_ENV=${NODE_ENV:-development}
export PORT=${PORT:-3004}
export GIT_PORT=${PORT:-3004}
export WORKSPACE_ROOT=${WORKSPACE_ROOT:-$(pwd)/../..}

# Start the service
exec npx tsx src/index.ts