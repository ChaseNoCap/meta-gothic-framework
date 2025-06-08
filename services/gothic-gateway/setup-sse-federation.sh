#!/bin/bash

# Setup script for Cosmo Router with SSE Federation
# This script automates the configuration and startup process

set -e  # Exit on error

echo "🚀 Setting up Cosmo Router with SSE Federation"
echo "=============================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check if services are running
echo -e "\n${YELLOW}Step 1: Checking services...${NC}"
SERVICES_OK=true

for port in 3002 3003 3005; do
  SERVICE_NAME=""
  case $port in
    3002) SERVICE_NAME="Claude Service" ;;
    3003) SERVICE_NAME="Git Service" ;;
    3005) SERVICE_NAME="GitHub Adapter" ;;
  esac
  
  echo -n "  $SERVICE_NAME (port $port): "
  
  if curl -s http://localhost:$port/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
  else
    echo -e "${RED}✗ Not running${NC}"
    SERVICES_OK=false
  fi
done

if [ "$SERVICES_OK" = false ]; then
  echo -e "\n${RED}Error: Not all services are running!${NC}"
  echo "Please start services with: npm start"
  exit 1
fi

# Step 2: Check for wgc CLI
echo -e "\n${YELLOW}Step 2: Checking wgc CLI...${NC}"
if ! command -v wgc &> /dev/null && ! npx wgc --version &> /dev/null; then
  echo -e "${RED}Error: wgc CLI not found!${NC}"
  echo "Install with: npm install -g wgc"
  exit 1
fi
echo -e "  ${GREEN}✓ wgc CLI available${NC}"

# Step 3: Check for required files
echo -e "\n${YELLOW}Step 3: Checking configuration files...${NC}"

if [ ! -f "subgraph-config.yaml" ]; then
  echo -e "  ${YELLOW}Creating subgraph-config.yaml...${NC}"
  cat > subgraph-config.yaml << 'EOF'
version: 1
subgraphs:
  - name: claude-service
    routing_url: http://localhost:3002/graphql
    subscription:
      url: http://localhost:3002/graphql/stream
      protocol: sse
  - name: git-service  
    routing_url: http://localhost:3003/graphql
    subscription:
      url: http://localhost:3003/graphql/stream
      protocol: sse
  - name: github-adapter
    routing_url: http://localhost:3005/graphql
    # No subscriptions for GitHub adapter
EOF
  echo -e "  ${GREEN}✓ Created subgraph-config.yaml${NC}"
else
  echo -e "  ${GREEN}✓ subgraph-config.yaml exists${NC}"
fi

if [ ! -f "router.yaml" ]; then
  echo -e "  ${YELLOW}Creating router.yaml...${NC}"
  cat > router.yaml << 'EOF'
# Cosmo Router Configuration for Local Development
version: "1"

# Development settings
dev_mode: true

# Server settings
listen_addr: "localhost:4000"
log_level: "info"

# GraphQL Playground
playground:
  enabled: true
  path: /

# Engine settings
engine:
  enable_single_flight: true
  enable_request_tracing: true

# CORS configuration
cors:
  allow_origins: ["*"]
  allow_methods: ["HEAD", "GET", "POST", "OPTIONS"]
  allow_headers: ["*"]
  allow_credentials: true

# Execution config from wgc
execution_config:
  file:
    path: "./config.json"
EOF
  echo -e "  ${GREEN}✓ Created router.yaml${NC}"
else
  echo -e "  ${GREEN}✓ router.yaml exists${NC}"
fi

# Step 4: Compose configuration
echo -e "\n${YELLOW}Step 4: Composing router configuration...${NC}"
if npx wgc router compose --input subgraph-config.yaml --out config.json; then
  echo -e "  ${GREEN}✓ Configuration composed successfully${NC}"
else
  echo -e "  ${RED}✗ Failed to compose configuration${NC}"
  exit 1
fi

# Step 5: Check for router binary
echo -e "\n${YELLOW}Step 5: Checking router binary...${NC}"
if [ ! -f "./router" ]; then
  echo "  Router binary not found. Downloading..."
  if npx wgc router download; then
    chmod +x router
    echo -e "  ${GREEN}✓ Router downloaded${NC}"
  else
    echo -e "  ${RED}✗ Failed to download router${NC}"
    exit 1
  fi
else
  echo -e "  ${GREEN}✓ Router binary exists${NC}"
fi

# Step 6: Final checks
echo -e "\n${YELLOW}Step 6: Verifying setup...${NC}"
echo -n "  Configuration file size: "
ls -lh config.json | awk '{print $5}'
echo -n "  Number of subgraphs: "
jq '.subgraphs | length' config.json

# Summary
echo -e "\n${GREEN}✅ Setup complete!${NC}"
echo -e "\nTo start the router:"
echo -e "  ${YELLOW}./router --config router.yaml${NC}"
echo -e "\nOr with PM2:"
echo -e "  ${YELLOW}pm2 start ./router --name gateway -- --config router.yaml${NC}"
echo -e "\nTest the federation:"
echo -e "  ${YELLOW}curl -X POST http://localhost:4000/graphql -H \"Content-Type: application/json\" -d '{\"query\":\"{__typename}\"}'${NC}"
echo -e "\nView GraphQL Playground:"
echo -e "  ${YELLOW}http://localhost:4000${NC}"