#!/bin/bash

# PM2 wrapper for Cosmo Router
# This script ensures the router starts properly and signals PM2 when ready

# Change to the gothic-gateway directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Log file for debugging
LOG_FILE="./logs/router-startup.log"
mkdir -p logs

echo "[$(date)] Starting PM2 router wrapper..." >> "$LOG_FILE"

# Source the start script functions
source ./start-cosmo-router.sh

# Override the trap to not exit
trap - EXIT INT TERM

# Start the router and get PID
echo "[$(date)] Starting router process..." >> "$LOG_FILE"
./router/router &
ROUTER_PID=$!

echo "[$(date)] Router PID: $ROUTER_PID" >> "$LOG_FILE"

# Wait for router to be healthy
if wait_for_router; then
    echo "[$(date)] Router is healthy, signaling PM2..." >> "$LOG_FILE"
    
    # Signal PM2 that we're ready
    if [ -n "$PM2_HOME" ]; then
        # Send ready signal to PM2
        kill -s SIGUSR1 $PM2_PARENT_PID 2>/dev/null || true
    fi
    
    echo "[$(date)] Waiting for router process..." >> "$LOG_FILE"
    # Wait for the router process
    wait $ROUTER_PID
else
    echo "[$(date)] Router failed to start" >> "$LOG_FILE"
    kill $ROUTER_PID 2>/dev/null || true
    exit 1
fi