#!/bin/bash

# Test script for the Meta GOTHIC Gateway

echo "🧪 Testing Meta GOTHIC Gateway..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

GATEWAY_URL="http://localhost:3000"

# Function to check endpoint
check_endpoint() {
    local endpoint=$1
    local name=$2
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint")
    
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✓${NC} $name is accessible"
        return 0
    else
        echo -e "${RED}✗${NC} $name returned status code: $response"
        return 1
    fi
}

# Check if gateway is running
echo "Checking gateway endpoints..."
check_endpoint "$GATEWAY_URL/health" "Health endpoint"
check_endpoint "$GATEWAY_URL/services" "Service discovery"

echo ""

# Test GraphQL endpoint with introspection query
echo "Testing GraphQL endpoint..."
INTROSPECTION_QUERY='{"query":"{ __schema { types { name } } }"}'

response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "$INTROSPECTION_QUERY" \
    "$GATEWAY_URL/graphql")

if echo "$response" | grep -q "__schema"; then
    echo -e "${GREEN}✓${NC} GraphQL endpoint is working"
else
    echo -e "${RED}✗${NC} GraphQL endpoint failed"
    echo "Response: $response"
fi

echo ""

# Check service health
echo "Checking federated services..."
services=$(curl -s "$GATEWAY_URL/services" | jq -r '.services[] | "\(.name): \(.healthy)"')

while IFS=: read -r service status; do
    if [ "$status" = " true" ]; then
        echo -e "${GREEN}✓${NC} $service is healthy"
    else
        echo -e "${RED}✗${NC} $service is not healthy"
    fi
done <<< "$services"

echo ""
echo "Gateway test complete!"