#!/bin/bash

# Start the Claude service with Yoga simple implementation
echo "Starting Claude Service (Yoga Simple)..."

# Kill any existing instances
pkill -f "tsx.*index-yoga-simple" || true

# Start the service in the background
nohup npx tsx src/index-yoga-simple.ts > /tmp/claude-yoga-simple.log 2>&1 &

# Wait a moment for startup
sleep 2

# Check if it's running
if ps aux | grep -q "[t]sx.*index-yoga-simple"; then
    echo "✅ Service started successfully"
    echo "📋 Logs: tail -f /tmp/claude-yoga-simple.log"
    echo "🌐 GraphQL endpoint: http://localhost:3002/graphql"
    
    # Test health endpoint
    echo -n "🔍 Testing health endpoint... "
    if curl -s http://localhost:3002/health > /dev/null 2>&1; then
        echo "✅ Health check passed"
    else
        echo "❌ Health check failed"
    fi
else
    echo "❌ Failed to start service"
    echo "Check logs at /tmp/claude-yoga-simple.log"
    tail -20 /tmp/claude-yoga-simple.log
fi