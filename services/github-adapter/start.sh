#\!/bin/bash

# GitHub Adapter startup script
echo "Starting GitHub Adapter..."

# Change to service directory
cd "$(dirname "$0")"

# Export environment variables
export NODE_ENV=${NODE_ENV:-development}
export PORT=${PORT:-3005}
export GITHUB_MESH_PORT=${PORT:-3005}

# Start the service
exec node index.js
