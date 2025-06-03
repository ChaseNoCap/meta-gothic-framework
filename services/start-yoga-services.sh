#!/bin/bash

# Start all GraphQL services with Yoga

echo "🚀 Starting GraphQL Services with Yoga..."

# Set workspace root to parent directory (meta-gothic-framework)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
export WORKSPACE_ROOT="$(dirname "$SCRIPT_DIR")"
echo "Setting WORKSPACE_ROOT to: $WORKSPACE_ROOT"

# Kill any existing services
echo "Stopping existing services..."
pkill -f "claude-service|repo-agent|meta-gothic-app|mesh" 2>/dev/null
sleep 2

# Start repo-agent-service
echo "Starting Repo Agent Service (Yoga)..."
cd repo-agent-service
WORKSPACE_ROOT="$WORKSPACE_ROOT" npm run dev:yoga > /tmp/repo-agent-yoga.log 2>&1 &
REPO_PID=$!
cd ..

# Start claude-service  
echo "Starting Claude Service (Yoga)..."
cd claude-service
WORKSPACE_ROOT="$WORKSPACE_ROOT" npm run dev:yoga > /tmp/claude-yoga.log 2>&1 &
CLAUDE_PID=$!
cd ..

# Give services time to start
echo "Waiting for services to start..."
sleep 5

# Start gateway with GitHub support and caching
echo "Starting Meta-GOTHIC GraphQL Gateway..."
cd meta-gothic-app
# Make sure GitHub token is available
export GITHUB_TOKEN="${GITHUB_TOKEN:-${VITE_GITHUB_TOKEN}}"
npm run dev > /tmp/meta-gothic-gateway.log 2>&1 &
GATEWAY_PID=$!
cd ..

# Wait a bit more for gateway
sleep 3

# Check if services are running
echo ""
echo "✅ Services Status:"
echo "  - Repo Agent Service: http://localhost:3004/graphql (PID: $REPO_PID)"
echo "  - Claude Service: http://localhost:3002/graphql (PID: $CLAUDE_PID)"  
echo "  - GraphQL Gateway: http://localhost:3000/graphql (PID: $GATEWAY_PID)"
echo "    (includes GitHub REST API and response caching)"
echo ""
echo "📊 GraphiQL Interface: http://localhost:3000/graphql"
echo ""
echo "To stop all services: pkill -f 'claude-service|repo-agent|meta-gothic-app'"
echo ""
echo "Logs available at:"
echo "  - /tmp/repo-agent-yoga.log"
echo "  - /tmp/claude-yoga.log"
echo "  - /tmp/meta-gothic-gateway.log"