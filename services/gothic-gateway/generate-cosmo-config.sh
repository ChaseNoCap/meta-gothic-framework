#!/bin/bash

# Script to generate Cosmo Router execution configuration
# This creates the config that Cosmo Router needs to federate services

echo "🚀 Generating Cosmo Router execution configuration..."

# Create the execution config with proper structure
cat > config.json << 'EOF'
{
  "version": "1",
  "engineConfig": {
    "defaultFlushInterval": 500000000,
    "datasourceConfigurations": [
      {
        "id": "0",
        "kind": "GRAPHQL",
        "name": "claude-service",
        "customGraphql": {
          "fetch": {
            "url": {
              "staticVariableContent": "http://localhost:3002/graphql"
            },
            "method": "POST"
          },
          "federation": {
            "enabled": true,
            "serviceSdl": ""
          }
        }
      },
      {
        "id": "1", 
        "kind": "GRAPHQL",
        "name": "git-service",
        "customGraphql": {
          "fetch": {
            "url": {
              "staticVariableContent": "http://localhost:3004/graphql"
            },
            "method": "POST"
          },
          "federation": {
            "enabled": true,
            "serviceSdl": ""
          }
        }
      },
      {
        "id": "2",
        "kind": "GRAPHQL", 
        "name": "github-adapter",
        "customGraphql": {
          "fetch": {
            "url": {
              "staticVariableContent": "http://localhost:3005/graphql"
            },
            "method": "POST"
          },
          "federation": {
            "enabled": true,
            "serviceSdl": ""
          }
        }
      }
    ]
  },
  "subgraphs": [
    {
      "id": "0",
      "name": "claude-service",
      "routingUrl": "http://localhost:3002/graphql"
    },
    {
      "id": "1",
      "name": "git-service", 
      "routingUrl": "http://localhost:3004/graphql"
    },
    {
      "id": "2",
      "name": "github-adapter",
      "routingUrl": "http://localhost:3005/graphql"
    }
  ]
}
EOF

echo "✅ Configuration generated successfully!"
echo "📄 Output written to: config.json"
echo ""
echo "ℹ️  Note: Cosmo Router will use this config to connect to the services."
echo "    The router will introspect the services to discover their schemas."