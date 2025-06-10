# Service Port Configuration

This document defines the standard port configuration for all Meta GOTHIC Framework services.

## Standard Port Assignments

| Service | Port | Endpoint | Description |
|---------|------|----------|-------------|
| **Cosmo Router** | 4000 | http://localhost:4000/graphql | Federation gateway that unifies all services |
| **Claude Service** | 3002 | http://localhost:3002/graphql | AI agent operations and session management |
| **Git Service** | 3004 | http://localhost:3004/graphql | Git repository operations |
| **GitHub Adapter** | 3005 | http://localhost:3005/graphql | GitHub API integration |
| **Quality Service** | 3006 | http://localhost:3006 | Code quality analysis with TimescaleDB |
| **UI Dashboard** | 3001 | http://localhost:3001 | Web interface for Meta GOTHIC |

## SSE Endpoints

Services that support Server-Sent Events (SSE) for real-time subscriptions:

| Service | SSE Endpoint | Status |
|---------|--------------|--------|
| **Claude Service** | http://localhost:3002/graphql/stream | ✅ Implemented |
| **Git Service** | N/A | ❌ No subscriptions defined |
| **GitHub Adapter** | N/A | ❌ REST adapter, no GraphQL subscriptions |

## Important Notes

1. **Gateway Port Change**: The Cosmo Router runs on port 4000 (not 3000 as in older documentation)
2. **Git Service Port**: The Git Service runs on port 3004 (not 3003 as in some outdated docs)
3. **No Port Conflicts**: Each service uses a unique port to avoid conflicts
4. **Local Development**: All services are designed to run locally without cloud dependencies

## Environment Variables

You can override default ports using environment variables:

```bash
GATEWAY_PORT=4000         # Cosmo Router port
CLAUDE_SERVICE_PORT=3002  # Claude Service port
GIT_SERVICE_PORT=3004     # Git Service port
GITHUB_ADAPTER_PORT=3005  # GitHub Adapter port
QUALITY_SERVICE_PORT=3006 # Quality Service port
UI_DASHBOARD_PORT=3001    # UI Dashboard port
```

## Quick Start

Start all services with their standard ports:

```bash
npm start
```

This will start all services using PM2 with the correct port configuration.

## Verification

Check that all services are running on correct ports:

```bash
# Check Cosmo Router
curl http://localhost:4000/graphql

# Check Claude Service
curl http://localhost:3002/graphql

# Check Git Service  
curl http://localhost:3004/graphql

# Check GitHub Adapter
curl http://localhost:3005/graphql

# Check Quality Service
curl http://localhost:3006

# Check UI Dashboard
open http://localhost:3001
```

## Quality Service MCP Mode

The Quality Service also runs as an MCP server for Claude integration:

```bash
# Start MCP server (for Claude)
cd services/quality-service
npm run start:mcp
```