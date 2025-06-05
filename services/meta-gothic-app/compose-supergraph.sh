#!/bin/bash

# Script to compose the supergraph schema using Apollo Rover CLI
# This requires the rover CLI to be installed: https://www.apollographql.com/docs/rover/

echo "🚀 Composing Apollo Federation supergraph..."

# Check if rover is installed
if ! command -v rover &> /dev/null; then
    echo "❌ Rover CLI is not installed. Please install it first:"
    echo "   curl -sSL https://rover.apollo.dev/nix/latest | sh"
    exit 1
fi

# Fetch schemas from running services
echo "📥 Fetching schemas from services..."

# Fetch Claude service schema
rover subgraph introspect http://localhost:3002/graphql > claude-schema-federated.graphql
if [ $? -ne 0 ]; then
    echo "❌ Failed to fetch Claude service schema. Is the service running?"
    exit 1
fi

# Fetch Repo Agent service schema
rover subgraph introspect http://localhost:3004/graphql > repo-agent-schema-federated.graphql
if [ $? -ne 0 ]; then
    echo "❌ Failed to fetch Repo Agent service schema. Is the service running?"
    exit 1
fi

# Fetch GitHub Mesh service schema
rover subgraph introspect http://localhost:3005/graphql > github-mesh-schema.graphql
if [ $? -ne 0 ]; then
    echo "❌ Failed to fetch GitHub Mesh service schema. Is the service running?"
    exit 1
fi

echo "✅ All schemas fetched successfully"

# Compose the supergraph
echo "🔨 Composing supergraph..."
rover supergraph compose --config ./supergraph.yaml > supergraph.graphql

if [ $? -eq 0 ]; then
    echo "✅ Supergraph composed successfully!"
    echo "📄 Output written to: supergraph.graphql"
    echo ""
    echo "You can now:"
    echo "1. Use the composed supergraph.graphql with Apollo Router"
    echo "2. Or continue using IntrospectAndCompose for automatic composition"
else
    echo "❌ Failed to compose supergraph. Check the errors above."
    exit 1
fi