#!/bin/bash

# Stop all GraphQL services for the Meta GOTHIC Framework

echo "🛑 Stopping Meta GOTHIC GraphQL Services..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to stop a service
stop_service() {
    local service_name=$1
    local pid_file="/tmp/${service_name}.pid"
    
    if [ -f "$pid_file" ]; then
        pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            echo -e "${GREEN}✓ Stopped $service_name (PID: $pid)${NC}"
            rm "$pid_file"
        else
            echo -e "${RED}✗ $service_name was not running${NC}"
            rm "$pid_file"
        fi
    else
        echo -e "${RED}✗ No PID file found for $service_name${NC}"
    fi
}

# Stop services
stop_service "meta-gothic-gateway"
stop_service "claude-service"
stop_service "repo-agent-service"

echo ""
echo "All services stopped."