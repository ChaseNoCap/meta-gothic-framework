#!/bin/bash

# Test script for GraphQL Federation Gateway

echo "🧪 Testing Meta GOTHIC Federation Gateway..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

GATEWAY_URL="http://localhost:3000"

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local expected_code=${3:-200}
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    
    if [ "$response" = "$expected_code" ]; then
        echo -e "${GREEN}✓ $name${NC}"
    else
        echo -e "${RED}✗ $name (got $response, expected $expected_code)${NC}"
    fi
}

# Function to test GraphQL query
test_graphql_query() {
    local name=$1
    local query=$2
    
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "{\"query\": \"$query\"}" \
        "$GATEWAY_URL/graphql")
    
    if echo "$response" | grep -q "errors"; then
        echo -e "${RED}✗ $name${NC}"
        echo "   Response: $response"
    else
        echo -e "${GREEN}✓ $name${NC}"
    fi
}

echo -e "${BLUE}Testing basic endpoints...${NC}"
test_endpoint "Health endpoint" "$GATEWAY_URL/health"
test_endpoint "Services endpoint" "$GATEWAY_URL/services"
test_endpoint "GraphQL endpoint" "$GATEWAY_URL/graphql" 400
test_endpoint "GraphiQL playground" "$GATEWAY_URL/graphiql"

echo ""
echo -e "${BLUE}Testing service discovery...${NC}"
services=$(curl -s "$GATEWAY_URL/services")
echo "$services" | jq '.services'

echo ""
echo -e "${BLUE}Testing GraphQL queries...${NC}"

# Test repo-agent service query
test_graphql_query "Git status query" 'query { isRepositoryClean(path: ".") { isClean uncommittedFiles } }'

# Test claude service query
test_graphql_query "Health query" 'query { health { status claudeAvailable } }'

# Test mutation
test_graphql_query "Scan all repositories" 'query { scanAllRepositories { name path isDirty } }'

echo ""
echo -e "${BLUE}Testing federated schema introspection...${NC}"
introspection=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"query": "{ __schema { types { name } } }"}' \
    "$GATEWAY_URL/graphql")

type_count=$(echo "$introspection" | jq '.data.__schema.types | length')
echo "Found $type_count types in federated schema"

echo ""
echo -e "${GREEN}Federation gateway test complete!${NC}"