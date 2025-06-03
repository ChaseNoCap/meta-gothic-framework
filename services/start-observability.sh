#!/bin/bash

echo "🔍 Starting Meta-GOTHIC Observability Platform..."

# Check if services are running
if ! curl -s http://localhost:3000/graphql > /dev/null 2>&1; then
    echo ""
    echo "⚠️  Warning: Gateway not detected at http://localhost:3000"
    echo "   The observability dashboard requires the gateway for real-time events."
    echo "   Start services first with: ./start-yoga-services.sh"
    echo ""
fi

# Start the observability dashboard
cd observability-dashboard
echo "Starting dashboard server on http://localhost:3005..."
npm start