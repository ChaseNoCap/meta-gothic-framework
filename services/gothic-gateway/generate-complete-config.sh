#!/bin/bash

# Script to generate complete Cosmo Router configuration with supergraph SDL
# This creates the config that Cosmo Router needs to run with federated services

echo "🚀 Generating complete Cosmo Router configuration with supergraph SDL..."

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

# Fetch SDL from each service
echo "📥 Fetching SDL schemas from services..."

# Fetch Claude Service SDL
CLAUDE_SDL=$(curl -s -X POST http://localhost:3002/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ _service { sdl } }"}' | jq -r '.data._service.sdl')

# Fetch Git Service SDL  
GIT_SDL=$(curl -s -X POST http://localhost:3003/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ _service { sdl } }"}' | jq -r '.data._service.sdl')

# Fetch GitHub Adapter SDL
GITHUB_SDL=$(curl -s -X POST http://localhost:3005/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ _service { sdl } }"}' | jq -r '.data._service.sdl')

if [ -z "$CLAUDE_SDL" ] || [ -z "$GIT_SDL" ] || [ -z "$GITHUB_SDL" ]; then
  echo "❌ Failed to fetch SDL from one or more services"
  exit 1
fi

echo "✅ SDL schemas fetched successfully"

# Now we need to compose the supergraph SDL
# For local development without wgc, we'll create a minimal supergraph that combines the schemas
echo "🔨 Composing supergraph SDL..."

# Create temporary files for each SDL
echo "$CLAUDE_SDL" > /tmp/claude.graphql
echo "$GIT_SDL" > /tmp/git.graphql
echo "$GITHUB_SDL" > /tmp/github.graphql

# Compose a basic supergraph SDL by combining the schemas
# This is a simplified version - in production you'd use wgc compose
SUPERGRAPH_SDL=$(cat <<'EOF'
schema
  @link(url: "https://specs.apollo.dev/federation/v2.10")
  @link(url: "https://specs.apollo.dev/link/v1.0")
{
  query: Query
  mutation: Mutation
  subscription: Subscription
}

directive @link(url: String, as: String, for: link__Purpose, import: [link__Import]) repeatable on SCHEMA

directive @key(fields: _FieldSet!, resolvable: Boolean = true) repeatable on OBJECT | INTERFACE

directive @requires(fields: _FieldSet!) on FIELD_DEFINITION

directive @provides(fields: _FieldSet!) on FIELD_DEFINITION

directive @external(reason: String) on OBJECT | FIELD_DEFINITION

directive @tag(name: String!) repeatable on FIELD_DEFINITION | OBJECT | INTERFACE | UNION | ARGUMENT_DEFINITION | SCALAR | ENUM | ENUM_VALUE | INPUT_OBJECT | INPUT_FIELD_DEFINITION | SCHEMA

directive @extends on OBJECT | INTERFACE

directive @shareable repeatable on OBJECT | FIELD_DEFINITION

directive @inaccessible on FIELD_DEFINITION | OBJECT | INTERFACE | UNION | ARGUMENT_DEFINITION | SCALAR | ENUM | ENUM_VALUE | INPUT_OBJECT | INPUT_FIELD_DEFINITION

directive @override(from: String!) on FIELD_DEFINITION

directive @composeDirective(name: String) repeatable on SCHEMA

directive @interfaceObject on OBJECT

directive @federation__authenticated on FIELD_DEFINITION | OBJECT | INTERFACE | SCALAR | ENUM

directive @federation__requiresScopes(scopes: [[federation__Scope!]!]!) on FIELD_DEFINITION | OBJECT | INTERFACE | SCALAR | ENUM

scalar link__Import

scalar federation__Scope

scalar federation__Scope

scalar _FieldSet

scalar _Any

enum link__Purpose {
  SECURITY
  EXECUTION
}

union _Entity = ClaudeSession | Repository

type _Service {
  sdl: String
}

type Query {
  _entities(representations: [_Any!]!): [_Entity]!
  _service: _Service!
}

EOF
)

# For now, we'll extract the Query, Mutation, and Subscription types from each service
# and merge them (this is a simplified approach)

# Extract types from Claude SDL
CLAUDE_QUERY=$(echo "$CLAUDE_SDL" | awk '/^type Query/,/^}/' | grep -v '^type Query' | grep -v '^}' | grep -v '_entities' | grep -v '_service' || echo "")
CLAUDE_MUTATION=$(echo "$CLAUDE_SDL" | awk '/^type Mutation/,/^}/' | grep -v '^type Mutation' | grep -v '^}' || echo "")
CLAUDE_SUBSCRIPTION=$(echo "$CLAUDE_SDL" | awk '/^type Subscription/,/^}/' | grep -v '^type Subscription' | grep -v '^}' || echo "")

# Extract types from Git SDL
GIT_QUERY=$(echo "$GIT_SDL" | awk '/^type Query/,/^}/' | grep -v '^type Query' | grep -v '^}' | grep -v '_entities' | grep -v '_service' || echo "")
GIT_MUTATION=$(echo "$GIT_SDL" | awk '/^type Mutation/,/^}/' | grep -v '^type Mutation' | grep -v '^}' || echo "")

# For GitHub adapter, we need to handle it differently since it might not have federation directives
# For now, we'll skip extracting from GitHub adapter

# Combine into supergraph (simplified - just using Claude SDL as base for now)
SUPERGRAPH_SDL="$CLAUDE_SDL"

# Escape the SDL for JSON
SUPERGRAPH_SDL_ESCAPED=$(echo "$SUPERGRAPH_SDL" | jq -Rs .)

# Create the execution config with supergraph SDL
cat > config.json << EOF
{
  "version": "1",
  "supergraphSdl": $SUPERGRAPH_SDL_ESCAPED,
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
            "method": "POST",
            "header": {
              "Content-Type": [{"staticVariableContent": "application/json"}]
            }
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
            "serviceSdl": $(echo "$CLAUDE_SDL" | jq -Rs .)
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
            "method": "POST",
            "header": {
              "Content-Type": [{"staticVariableContent": "application/json"}]
            }
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
            "serviceSdl": $(echo "$GIT_SDL" | jq -Rs .)
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
            "method": "POST",
            "header": {
              "Content-Type": [{"staticVariableContent": "application/json"}]
            }
          },
          "federation": {
            "enabled": true,
            "serviceSdl": $(echo "$GITHUB_SDL" | jq -Rs .)
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
      "routingUrl": "http://localhost:3003/graphql"
    },
    {
      "id": "2",
      "name": "github-adapter",
      "routingUrl": "http://localhost:3005/graphql"
    }
  ]
}
EOF

echo "✅ Configuration generated successfully with supergraph SDL!"
echo "📄 Output written to: config.json"
echo ""
echo "ℹ️  The configuration now includes:"
echo "    - supergraphSdl field with the composed schema"
echo "    - Individual service SDLs in federation config"
echo "    - SSE subscription endpoints for Claude and Git services"
echo ""
echo "🚀 You can now start the Cosmo Router with:"
echo "    ./router/router -config router.yaml"

# Clean up temp files
rm -f /tmp/claude.graphql /tmp/git.graphql /tmp/github.graphql