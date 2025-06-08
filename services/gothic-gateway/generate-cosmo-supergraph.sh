#!/bin/bash

# Script to generate Cosmo Router configuration using wgc compose
# This properly composes the federated supergraph schema

echo "🚀 Generating Cosmo Router supergraph configuration using wgc..."

# Change to the gateway directory
cd "$(dirname "$0")"

# Check if services are running
echo "📥 Checking service availability..."

# Test Claude Service
if ! curl -s -f http://localhost:3002/graphql -X POST -H "Content-Type: application/json" -d '{"query":"{ _service { sdl } }"}' > /dev/null; then
  echo "❌ Claude Service not available at http://localhost:3002/graphql"
  echo "Please start the service first"
  exit 1
fi

# Test Git Service
if ! curl -s -f http://localhost:3003/graphql -X POST -H "Content-Type: application/json" -d '{"query":"{ _service { sdl } }"}' > /dev/null; then
  echo "❌ Git Service not available at http://localhost:3003/graphql"
  echo "Please start the service first"
  exit 1
fi

# Test GitHub Adapter
if ! curl -s -f http://localhost:3005/graphql -X POST -H "Content-Type: application/json" -d '{"query":"{ _service { sdl } }"}' > /dev/null; then
  echo "❌ GitHub Adapter not available at http://localhost:3005/graphql"
  echo "Please start the service first"
  exit 1
fi

echo "✅ All services are available"

# Use wgc to compose the supergraph
echo "🔨 Composing supergraph with wgc..."

# Run wgc compose to generate the router configuration
wgc router compose \
  --config compose.yaml \
  --out config.json

if [ $? -ne 0 ]; then
  echo "❌ Failed to compose supergraph with wgc"
  echo "Make sure all schema files exist and are valid"
  exit 1
fi

echo "✅ Supergraph composed successfully!"
echo "📄 Output written to: config.json"
echo ""
echo "🚀 You can now start the Cosmo Router with:"
echo "    ./router/router -config router.yaml"
echo ""
echo "📊 Or start with PM2:"
echo "    pm2 start ecosystem.config.cjs"