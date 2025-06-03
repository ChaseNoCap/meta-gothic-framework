#!/bin/bash

echo "🔄 Testing Meta-GOTHIC WebSocket Event Stream..."
echo ""

# Make sure services are running
if ! curl -s http://localhost:3000/graphql > /dev/null; then
    echo "❌ Gateway not running. Please start services first:"
    echo "   cd services && ./start-yoga-services.sh"
    exit 1
fi

echo "✅ Gateway is running"
echo ""

# Run the WebSocket client
cd "$(dirname "$0")"
npx tsx examples/websocket-client.ts