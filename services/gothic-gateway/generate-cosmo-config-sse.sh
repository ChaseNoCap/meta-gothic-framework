#!/bin/bash

# Script to generate Cosmo Router execution configuration with SSE support
# This creates the config that Cosmo Router needs to federate services with SSE subscriptions

echo "🚀 Generating Cosmo Router execution configuration with SSE support..."

# Create the execution config with SSE subscription support
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
          "subscription": {
            "enabled": true,
            "url": {
              "staticVariableContent": "http://localhost:3002/graphql/stream"
            },
            "protocol": "GRAPHQL_SUBSCRIPTION_PROTOCOL_SSE"
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
              "staticVariableContent": "http://localhost:3003/graphql"
            },
            "method": "POST"
          },
          "subscription": {
            "enabled": true,
            "url": {
              "staticVariableContent": "http://localhost:3003/graphql/stream"
            },
            "protocol": "GRAPHQL_SUBSCRIPTION_PROTOCOL_SSE"
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
      "routingUrl": "http://localhost:3002/graphql",
      "subscriptionUrl": "http://localhost:3002/graphql/stream",
      "subscriptionProtocol": "SSE"
    },
    {
      "id": "1",
      "name": "git-service", 
      "routingUrl": "http://localhost:3003/graphql",
      "subscriptionUrl": "http://localhost:3003/graphql/stream", 
      "subscriptionProtocol": "SSE"
    },
    {
      "id": "2",
      "name": "github-adapter",
      "routingUrl": "http://localhost:3005/graphql"
    }
  ]
}
EOF

echo "✅ Configuration generated successfully with SSE support!"
echo "📄 Output written to: config.json"
echo ""
echo "ℹ️  Note: Cosmo Router will use this config to connect to the services."
echo "    Claude and Git services are configured to use SSE for subscriptions."
echo "    SSE endpoints: /graphql/stream on ports 3002 and 3003"