#!/bin/bash

# Start all GraphQL services for the Meta GOTHIC Framework

echo "🚀 Starting Meta GOTHIC GraphQL Services..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to start a service
start_service() {
    local service_name=$1
    local service_dir=$2
    local port=$3
    
    echo -e "${BLUE}Starting $service_name on port $port...${NC}"
    
    cd "$service_dir" || exit
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}Installing dependencies for $service_name...${NC}"
        npm install
    fi
    
    # Start the service in the background
    if [ "$service_name" = "repo-agent-service" ]; then
        WORKSPACE_ROOT="$(cd ../.. && pwd)" npm run dev > "/tmp/${service_name}.log" 2>&1 &
    else
        npm run dev > "/tmp/${service_name}.log" 2>&1 &
    fi
    
    echo $! > "/tmp/${service_name}.pid"
    
    # Wait for service to be ready
    sleep 3
    
    # Check if service is running
    if curl -s -o /dev/null "http://localhost:$port/health"; then
        echo -e "${GREEN}✓ $service_name started successfully${NC}"
    else
        echo -e "${RED}✗ Failed to start $service_name${NC}"
        echo "Check logs at /tmp/${service_name}.log"
    fi
    
    cd - > /dev/null || exit
    echo ""
}

# Start services in order
start_service "repo-agent-service" "services/repo-agent-service" 3004
start_service "claude-service" "services/claude-service" 3002

# Wait for services to be fully ready
echo "Waiting for services to be ready..."
sleep 5

# Start the gateway
start_service "meta-gothic-gateway" "services/meta-gothic-app" 3000

echo ""
echo -e "${GREEN}All services started!${NC}"
echo ""
echo "Services running at:"
echo "  - GraphQL Gateway: http://localhost:3000/graphql"
echo "  - GraphiQL Playground: http://localhost:3000/graphiql"
echo "  - Repo Agent Service: http://localhost:3004/graphql"
echo "  - Claude Service: http://localhost:3002/graphql"
echo ""
echo "To stop all services, run: ./services/stop-all-services.sh"