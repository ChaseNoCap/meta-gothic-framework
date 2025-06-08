# Meta GOTHIC GraphQL Services

This directory contains the GraphQL microservices that power the Meta GOTHIC framework, implementing a federated architecture using Fastify and Mercurius.

## Architecture

The system consists of five main services:

1. **Cosmo Router** (Port 4000) - Federation gateway that unifies all services
2. **Claude Service** (Port 3002) - Manages Claude AI interactions and sessions
3. **Git Service** (Port 3004) - Handles all Git repository operations
4. **GitHub Adapter** (Port 3005) - GitHub API integration service
5. **UI Dashboard** (Port 3001) - Web interface for the Meta GOTHIC framework

## Quick Start

### Install Dependencies

```bash
# Install dependencies for all services
cd services/git-service && npm install
cd ../claude-service && npm install
cd ../gothic-gateway && npm install
cd ../github-adapter && npm install
cd ../../packages/ui-components && npm install
```

### Start Services

Start each service in a separate terminal:

```bash
# Terminal 1: Start git-service
cd services/git-service
npm run dev

# Terminal 2: Start claude-service
cd services/claude-service
npm run dev

# Terminal 3: Start Cosmo Router (federation gateway)
cd services/gothic-gateway
npm run dev

# Terminal 4: Start GitHub Adapter
cd services/github-adapter
npm run dev

# Terminal 5: Start UI Dashboard
cd packages/ui-components
npm run dev
```

### Access Services

- **Cosmo Router** (Federation Gateway): http://localhost:4000/graphql (recommended)
- **UI Dashboard**: http://localhost:3001
- **Claude Service**: http://localhost:3002/graphql
- **Git Service**: http://localhost:3004/graphql
- **GitHub Adapter**: http://localhost:3005/graphql

## Service Details

### git-service

Provides Git operations through GraphQL:

**Queries:**
- `gitStatus(path)` - Get status of a specific repository
- `scanAllRepositories` - Scan workspace for all repositories
- `scanAllDetailed` - Deep scan with diffs and history
- `submodules` - List Git submodules
- `repositoryDetails(path)` - Get comprehensive repo info

**Mutations:**
- `executeGitCommand` - Execute safe Git commands
- `commitChanges` - Stage and commit changes
- `batchCommit` - Commit across multiple repos
- `pushChanges` - Push to remote

### claude-service

Manages Claude AI interactions:

**Queries:**
- `sessions` - List active Claude sessions
- `session(id)` - Get session details
- `health` - Service health check

**Mutations:**
- `executeCommand` - Execute Claude command
- `continueSession` - Continue existing session
- `killSession` - Terminate session
- `generateCommitMessages` - AI commit messages
- `generateExecutiveSummary` - Cross-repo summary

**Subscriptions:**
- `commandOutput(sessionId)` - Real-time command output

### cosmo-router (gothic-gateway)

Federation gateway using Cosmo Router that:
- Unifies all services into a single GraphQL endpoint
- Handles authentication and authorization
- Provides Federation v2 supergraph composition
- Supports SSE subscriptions for real-time updates

### github-adapter

GitHub API integration service that:
- Provides GraphQL interface to GitHub API
- Handles repository management
- Manages workflows and actions
- Fetches repository metrics and statistics

### ui-dashboard

Web interface that:
- Monitors package health and CI/CD pipelines
- Controls pipeline operations
- Provides repository browser
- Enables AI-assisted development workflows

## Development

### Generate TypeScript Types

Each service can generate TypeScript types from its schema:

```bash
# In each service directory
npm run generate-types
```

### Testing

```bash
# Run tests for a service
npm test
```

### Building for Production

```bash
# Build all services
npm run build
```

## Environment Variables

### Common Variables
- `LOG_LEVEL` - Logging level (debug, info, warn, error)
- `CORS_ORIGIN` - CORS origin for API access
- `WORKSPACE_ROOT` - Root directory for Git operations

### Service-Specific
- `GIT_SERVICE_PORT` - Port for git-service (default: 3004)
- `CLAUDE_SERVICE_PORT` - Port for claude-service (default: 3002)
- `GATEWAY_PORT` - Port for Cosmo Router gateway (default: 4000)
- `GITHUB_ADAPTER_PORT` - Port for GitHub Adapter (default: 3005)
- `UI_DASHBOARD_PORT` - Port for UI Dashboard (default: 3001)

## Migration from REST

This GraphQL implementation replaces the previous REST endpoints:

### Git Operations (Previously in git-server.js)
- `POST /api/git/exec` → `mutation executeGitCommand`
- `POST /api/git/status` → `query gitStatus`
- `GET /api/git/scan-all` → `query scanAllRepositories`
- `GET /api/git/scan-all-detailed` → `query scanAllDetailed`
- `POST /api/git/commit` → `mutation commitChanges`
- `POST /api/git/batch-commit` → `mutation batchCommit`
- `POST /api/git/push` → `mutation pushChanges`

### Claude Operations (Previously in claude-api-server.js)
- `POST /api/claude/execute` → `mutation executeCommand` + `subscription commandOutput`
- `POST /api/claude/continue` → `mutation continueSession`
- `GET /api/claude/sessions` → `query sessions`
- `DELETE /api/claude/sessions/:id` → `mutation killSession`
- `POST /api/claude/batch-commit-messages` → `mutation generateCommitMessages`
- `POST /api/claude/executive-summary` → `mutation generateExecutiveSummary`

## Next Steps

1. Implement remaining resolvers for all operations
2. Add authentication middleware
3. Implement subscription support for real-time updates
4. Update UI components to use GraphQL client
5. Add monitoring and tracing