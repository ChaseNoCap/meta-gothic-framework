#!/bin/bash

echo "🧪 Testing Yoga GraphQL Gateway..."
echo ""

# Test health from Claude service
echo "1. Testing Claude Service Health Query:"
curl -s http://localhost:3000/graphql \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ health { healthy version claudeAvailable activeSessions } }"}' | jq .

echo ""
echo "2. Testing Repo Agent Git Status Query:"
curl -s http://localhost:3000/graphql \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ gitStatus(path: \"/Users/josh/Documents/meta-gothic-framework\") { branch isDirty ahead behind } }"}' | jq .

echo ""
echo "3. Testing Cross-Service Query (both services in one query):"
curl -s http://localhost:3000/graphql \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ health { healthy claudeAvailable } scanAllRepositories { name isDirty branch } }"}' | jq .

echo ""
echo "4. Testing Available Queries:"
curl -s http://localhost:3000/graphql \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { queryType { fields { name description } } } }"}' | jq '.data.__schema.queryType.fields[] | .name' | sort

echo ""
echo "✅ Gateway test complete!"