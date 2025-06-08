#!/bin/bash

echo "Starting Cosmo Router for PM2..."

# Change to the gothic-gateway directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Set environment variables
# The execution config path is read from config.yaml or can be overridden
export EXECUTION_CONFIG_FILE_PATH="${EXECUTION_CONFIG_FILE_PATH:-./config.json}"

# Verify required files exist
if [ ! -f "config.json" ]; then
    echo "Error: config.json not found. Run ./generate-config.sh first"
    exit 1
fi

if [ ! -f "config.yaml" ]; then
    echo "Error: config.yaml not found. This file contains runtime configuration"
    exit 1
fi

# Start the router with the runtime configuration
# The execution config path is specified in config.yaml or via env var
echo "Starting router with config.yaml..."
exec ./router/router -config config.yaml