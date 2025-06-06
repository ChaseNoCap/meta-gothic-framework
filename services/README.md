# Meta GOTHIC GraphQL Services

This directory contains the GraphQL microservices that power the Meta GOTHIC framework, implementing a federated architecture using Fastify and Mercurius.

## Architecture

The system consists of three main services:

1. **git-service** (Port 3004) - Handles all Git repository operations
2. **claude-service** (Port 3002) - Manages Claude AI interactions and sessions
3. **gothic-gateway** (Port 3000) - Federation gateway that unifies all services

## Quick Start

### Install Dependencies

```bash
# Install dependencies for all services
cd services/git-service && npm install
cd ../claude-service && npm install
cd ../gothic-gateway && npm install
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

# Terminal 3: Start federation gateway
cd services/gothic-gateway
npm run dev
```

### Access GraphQL Playground

- Federation Gateway: http://localhost:3000/graphql (recommended)
- Git Service: http://localhost:3004/graphql
- Claude Service: http://localhost:3002/graphql

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

### gothic-gateway

Federation gateway that:
- Unifies all services into a single GraphQL endpoint
- Handles authentication and authorization
- Provides schema stitching and query planning
- Supports WebSocket subscriptions

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
- `GATEWAY_PORT` - Port for federation gateway (default: 3000)

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