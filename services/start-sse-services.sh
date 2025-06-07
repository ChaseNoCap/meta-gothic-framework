#!/bin/bash

echo "Starting services with SSE support..."

# Start Claude Service with SSE
echo "Starting Claude Service with SSE..."
cd /Users/josh/Documents/meta-gothic-framework/services/claude-service
npm run dev:sse &
CLAUDE_PID=$!

# Start Git Service with SSE
echo "Starting Git Service with SSE..."
cd /Users/josh/Documents/meta-gothic-framework/services/git-service
npm run dev:sse &
GIT_PID=$!

# Start GitHub Adapter
echo "Starting GitHub Adapter..."
cd /Users/josh/Documents/meta-gothic-framework/services/github-adapter
npm run serve:federation &
GITHUB_PID=$!

# Wait for services to start
sleep 5

# Start Gateway (using existing Apollo for now)
echo "Starting Gateway..."
cd /Users/josh/Documents/meta-gothic-framework/services/gothic-gateway
npm run dev:federation &
GATEWAY_PID=$!

echo "All services started!"
echo "Claude Service PID: $CLAUDE_PID"
echo "Git Service PID: $GIT_PID"
echo "GitHub Adapter PID: $GITHUB_PID"
echo "Gateway PID: $GATEWAY_PID"

# Wait for user to stop
echo "Press Ctrl+C to stop all services..."
wait