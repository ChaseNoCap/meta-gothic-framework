#!/bin/bash
# Compose supergraph schema from running services

set -e

# Export PATH to include rover
export PATH=$PATH:/Users/josh/.rover/bin

# Accept ELv2 license
export APOLLO_ELV2_LICENSE=accept

# First, introspect schemas from running services
echo "Introspecting repo-agent schema..."
rover subgraph introspect http://localhost:3004/graphql > repo-agent-schema.graphql

echo "Introspecting claude schema..."
rover subgraph introspect http://localhost:3002/graphql > claude-schema.graphql

# Create a supergraph config with local schema files
cat > supergraph-config-local.yaml << EOF
federation_version: 2.10

subgraphs:
  repo-agent:
    routing_url: http://localhost:3004/graphql
    schema:
      file: ./repo-agent-schema.graphql
  claude:
    routing_url: http://localhost:3002/graphql
    schema:
      file: ./claude-schema.graphql
EOF

# Compose the supergraph
echo "Composing supergraph..."
rover supergraph compose --config ./supergraph-config-local.yaml > supergraph.graphql

echo "Supergraph schema composed successfully!"