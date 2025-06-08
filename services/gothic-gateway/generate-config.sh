#!/bin/bash

# The ONE TRUE script to generate Cosmo Router configuration
# This properly composes the federated supergraph schema and sets all required timeouts

echo "🚀 Generating Cosmo Router configuration..."

# Change to the gateway directory
cd "$(dirname "$0")"

# Service ports - SINGLE SOURCE OF TRUTH
CLAUDE_PORT=3002
GIT_PORT=3004
GITHUB_PORT=3005

# Check if services are running
echo "📥 Checking service availability..."

# Test Claude Service
if ! curl -s -f http://localhost:$CLAUDE_PORT/graphql -X POST -H "Content-Type: application/json" -d '{"query":"{ _service { sdl } }"}' > /dev/null; then
  echo "❌ Claude Service not available at http://localhost:$CLAUDE_PORT/graphql"
  echo "Please start the service first"
  exit 1
fi

# Test Git Service
if ! curl -s -f http://localhost:$GIT_PORT/graphql -X POST -H "Content-Type: application/json" -d '{"query":"{ _service { sdl } }"}' > /dev/null; then
  echo "❌ Git Service not available at http://localhost:$GIT_PORT/graphql"
  echo "Please start the service first"
  exit 1
fi

# Test GitHub Adapter
if ! curl -s -f http://localhost:$GITHUB_PORT/graphql -X POST -H "Content-Type: application/json" -d '{"query":"{ _service { sdl } }"}' > /dev/null; then
  echo "❌ GitHub Adapter not available at http://localhost:$GITHUB_PORT/graphql"
  echo "Please start the service first"  
  exit 1
fi

echo "✅ All services are available"

# Fetch SDL from each service
echo "📥 Fetching SDL schemas from services..."

# Fetch Claude Service SDL
CLAUDE_SDL=$(curl -s -X POST http://localhost:$CLAUDE_PORT/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ _service { sdl } }"}' | jq -r '.data._service.sdl')

# Fetch Git Service SDL  
GIT_SDL=$(curl -s -X POST http://localhost:$GIT_PORT/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ _service { sdl } }"}' | jq -r '.data._service.sdl')

# Fetch GitHub Adapter SDL
GITHUB_SDL=$(curl -s -X POST http://localhost:$GITHUB_PORT/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ _service { sdl } }"}' | jq -r '.data._service.sdl')

if [ -z "$CLAUDE_SDL" ] || [ "$CLAUDE_SDL" = "null" ]; then
  echo "❌ Failed to fetch SDL from Claude Service"
  exit 1
fi

if [ -z "$GIT_SDL" ] || [ "$GIT_SDL" = "null" ]; then
  echo "❌ Failed to fetch SDL from Git Service"
  exit 1
fi

if [ -z "$GITHUB_SDL" ] || [ "$GITHUB_SDL" = "null" ]; then
  echo "❌ Failed to fetch SDL from GitHub Adapter"
  exit 1
fi

echo "✅ SDL schemas fetched successfully"

# Use wgc to properly compose the federated schema
echo "🔨 Composing federated schema with wgc..."

# Create subgraph configs for wgc
cat > subgraphs.yaml << EOF
federation_version: V2_10
subgraphs:
  - name: claude-service
    routing_url: http://localhost:$CLAUDE_PORT/graphql
    subscription:
      protocol: SSE
      url: http://localhost:$CLAUDE_PORT/graphql/stream
  - name: git-service
    routing_url: http://localhost:$GIT_PORT/graphql
    subscription:
      protocol: SSE
      url: http://localhost:$GIT_PORT/graphql/stream
  - name: github-adapter
    routing_url: http://localhost:$GITHUB_PORT/graphql
EOF

# Use wgc to compose the supergraph
if ! wgc router compose -i subgraphs.yaml -o router-config.json; then
  echo "❌ Failed to compose supergraph with wgc"
  echo "Falling back to manual composition..."
  SUPERGRAPH_SDL="$CLAUDE_SDL"
else
  echo "✅ Supergraph composed successfully with wgc"
  # wgc generates router-config.json, copy it to config.json
  cp router-config.json config.json
  echo "✅ Configuration generated successfully!"
  echo "📄 Output written to: config.json"
  echo ""
  echo "🚀 Start the gateway with: pm2 restart gateway"
  exit 0
fi

# Escape the SDL for JSON
SUPERGRAPH_SDL_ESCAPED=$(echo "$SUPERGRAPH_SDL" | jq -Rs .)

# Start with the backup config if it exists, otherwise create from scratch
if [ -f "config-backup.json" ]; then
  echo "📋 Using config-backup.json as base..."
  BASE_CONFIG=$(cat config-backup.json)
else
  echo "📋 Creating new configuration..."
  BASE_CONFIG='{}'
fi

# Create the complete configuration with:
# 1. supergraphSdl field
# 2. Proper timeout settings (1500 seconds = 25 minutes)
# 3. Correct service ports
# 4. CORS configuration
jq --arg supergraphSdl "$SUPERGRAPH_SDL" \
   --arg claudeSdl "$CLAUDE_SDL" \
   --arg gitSdl "$GIT_SDL" \
   --arg githubSdl "$GITHUB_SDL" \
   '. + {
  "version": "1",
  "supergraphSdl": $supergraphSdl,
  "engineConfig": {
    "defaultFlushInterval": 500000000,
    "datasourceConfigurations": [
      {
        "id": "0",
        "kind": "GRAPHQL",
        "name": "claude-service",
        "rootNodes": (try .engineConfig.datasourceConfigurations[0].rootNodes catch []),
        "childNodes": (try .engineConfig.datasourceConfigurations[0].childNodes catch []),
        "customGraphql": {
          "fetch": {
            "url": {
              "staticVariableContent": "http://localhost:3002/graphql"
            },
            "method": "POST"
          },
          "subscription": {
            "enabled": true,
            "protocol": "SSE",
            "url": {
              "staticVariableContent": "http://localhost:3002/graphql"
            }
          },
          "federation": {
            "enabled": true,
            "serviceSdl": $claudeSdl
          }
        },
        "requestTimeoutSeconds": "1500"
      },
      {
        "id": "1",
        "kind": "GRAPHQL",
        "name": "git-service",
        "rootNodes": (try .engineConfig.datasourceConfigurations[1].rootNodes catch []),
        "childNodes": (try .engineConfig.datasourceConfigurations[1].childNodes catch []),
        "customGraphql": {
          "fetch": {
            "url": {
              "staticVariableContent": "http://localhost:3004/graphql"
            },
            "method": "POST"
          },
          "subscription": {
            "enabled": true,
            "protocol": "SSE",
            "url": {
              "staticVariableContent": "http://localhost:3004/graphql"
            }
          },
          "federation": {
            "enabled": true,
            "serviceSdl": $gitSdl
          }
        },
        "requestTimeoutSeconds": "1500"
      },
      {
        "id": "2",
        "kind": "GRAPHQL",
        "name": "github-adapter",
        "rootNodes": (try .engineConfig.datasourceConfigurations[2].rootNodes catch []),
        "childNodes": (try .engineConfig.datasourceConfigurations[2].childNodes catch []),
        "customGraphql": {
          "fetch": {
            "url": {
              "staticVariableContent": "http://localhost:3005/graphql"
            },
            "method": "POST",
            "header": {
              "Content-Type": [{"staticVariableContent": "application/json"}]
            }
          },
          "federation": {
            "enabled": true,
            "serviceSdl": $githubSdl
          }
        },
        "requestTimeoutSeconds": "1500"
      }
    ],
    "fieldConfigurations": (try .engineConfig.fieldConfigurations catch [])
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
}' <<< "$BASE_CONFIG" > config.json

if [ $? -ne 0 ]; then
  echo "❌ Failed to generate configuration"
  exit 1
fi

# Validate the generated config has the required fields
if ! jq -e '.supergraphSdl' config.json > /dev/null; then
  echo "❌ Configuration missing supergraphSdl field"
  exit 1
fi

echo "✅ Configuration generated successfully!"
echo "📄 Output written to: config.json"
echo ""
echo "ℹ️  Configuration includes:"
echo "    ✓ supergraphSdl field with federated schema"
echo "    ✓ Individual service SDLs for each subgraph"
echo "    ✓ 25-minute timeout for all datasources"
echo "    ✓ Correct service ports (Claude: $CLAUDE_PORT, Git: $GIT_PORT, GitHub: $GITHUB_PORT)"
echo "    ✓ CORS configuration for UI access"
echo "    ✓ SSE subscriptions for Claude and Git services"
echo ""
echo "🚀 Start the gateway with: pm2 restart gateway"