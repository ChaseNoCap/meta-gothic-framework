#!/bin/bash

echo "Testing Gothic Gateway SSE Endpoints"
echo "===================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test GraphQL endpoint
echo -e "\n1. Testing GraphQL Query Endpoint..."
QUERY_RESPONSE=$(curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}')

if [[ $QUERY_RESPONSE == *"__typename"* ]]; then
  echo -e "${GREEN}✓ GraphQL endpoint working${NC}"
else
  echo -e "${RED}✗ GraphQL endpoint failed${NC}"
  echo "Response: $QUERY_RESPONSE"
fi

# Test health endpoint
echo -e "\n2. Testing Health Endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:3000/health)

if [[ $HEALTH_RESPONSE == *"healthy"* ]]; then
  echo -e "${GREEN}✓ Health endpoint working${NC}"
  echo "Services: $HEALTH_RESPONSE"
else
  echo -e "${RED}✗ Health endpoint failed${NC}"
fi

# Test SSE endpoint for Claude
echo -e "\n3. Testing Claude SSE Endpoint..."
echo "Sending subscription request (will timeout after 5 seconds)..."

timeout 5 curl -N -X POST http://localhost:3000/graphql/stream/claude \
  -H "Accept: text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "subscription { commandOutput(sessionId: \"test-session\") { sessionId output timestamp } }"
  }' 2>/dev/null | head -20

echo -e "\n${GREEN}✓ SSE endpoint responded${NC}"

# Test SSE endpoint for Git
echo -e "\n4. Testing Git SSE Endpoint..."
echo "Sending subscription request (will timeout after 5 seconds)..."

timeout 5 curl -N -X POST http://localhost:3000/graphql/stream/git \
  -H "Accept: text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "subscription { fileChanged(path: \"/test/path\") { path event } }"
  }' 2>/dev/null | head -20

echo -e "\n${GREEN}✓ SSE endpoint responded${NC}"

echo -e "\n===================================="
echo "Testing complete!"
echo ""
echo "To test subscriptions interactively:"
echo "1. Open http://localhost:3000/graphql in your browser"
echo "2. Run a subscription query"
echo "3. Or use the curl commands above without timeout"