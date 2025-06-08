#!/bin/bash

# Script to generate Cosmo Router execution configuration with SSE support and SDL schemas
# This creates the config that Cosmo Router needs to federate services with SSE subscriptions

echo "🚀 Generating Cosmo Router execution configuration with SSE and SDL..."

# First, fetch the SDL from each service
echo "📥 Fetching SDL schemas from services..."

# Fetch Claude Service SDL and properly escape it for JSON
CLAUDE_SDL=$(curl -s -X POST http://localhost:3002/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ _service { sdl } }"}' | jq -r '.data._service.sdl' | jq -Rs .)

# Fetch Git Service SDL and properly escape it for JSON
GIT_SDL=$(curl -s -X POST http://localhost:3003/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ _service { sdl } }"}' | jq -r '.data._service.sdl' | jq -Rs .)

# Fetch GitHub Adapter SDL and properly escape it for JSON
GITHUB_SDL=$(curl -s -X POST http://localhost:3005/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ _service { sdl } }"}' | jq -r '.data._service.sdl' | jq -Rs .)

if [ -z "$CLAUDE_SDL" ] || [ -z "$GIT_SDL" ] || [ -z "$GITHUB_SDL" ]; then
  echo "❌ Failed to fetch SDL from one or more services. Make sure all services are running."
  exit 1
fi

echo "✅ SDL schemas fetched successfully"

# Create the execution config with SSE subscription support and SDL
cat > config.json << EOF
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
            "serviceSdl": $CLAUDE_SDL
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
            "serviceSdl": $GIT_SDL
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
            "serviceSdl": $GITHUB_SDL
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

echo "✅ Configuration generated successfully with SSE support and SDL schemas!"
echo "📄 Output written to: config.json"
echo ""
echo "ℹ️  Note: Cosmo Router will use this config to connect to the services."
echo "    Claude and Git services are configured to use SSE for subscriptions."
echo "    SDL schemas have been properly JSON-escaped and embedded."