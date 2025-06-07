#!/bin/bash

echo "Starting Cosmo Router for PM2..."

# Change to the gothic-gateway directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Set environment variables
export CONFIG_PATH="${CONFIG_PATH:-./config.yaml}"
export EXECUTION_CONFIG_FILE_PATH="${EXECUTION_CONFIG_FILE_PATH:-./config.json}"
export DEV_MODE="${DEV_MODE:-true}"

# Config.json should already exist - copied from router-execution-config.json
if [ ! -f "config.json" ]; then
    echo "Error: config.json not found. It should be copied from router-execution-config.json"
    exit 1
fi

# Start the router directly (no background process)
echo "Starting router..."
exec ./router/router