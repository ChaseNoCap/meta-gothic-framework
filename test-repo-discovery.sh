#!/bin/bash

echo "Testing Repository Discovery Fix"
echo "================================"
echo ""

# Test directly against repo-agent service
echo "1. Testing repo-agent service directly (port 3004):"
curl -s -X POST http://localhost:3004/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { scanAllDetailed { statistics { totalRepositories } metadata { workspaceRoot } } }"
  }' | jq '.data.scanAllDetailed.statistics.totalRepositories' | xargs -I {} echo "   Found {} repositories"

echo ""

# Test through gateway
echo "2. Testing through gateway (port 3000):"
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { scanAllDetailed { statistics { totalRepositories } metadata { workspaceRoot } } }"
  }' | jq '.data.scanAllDetailed.statistics.totalRepositories' | xargs -I {} echo "   Found {} repositories"

echo ""
echo "✅ If both show 10 repositories, the fix is working!"
echo ""
echo "You can now visit http://localhost:3001/tools/change-review"
echo "The loading modal should show '📁 Discovered 10 repositories in the workspace'"