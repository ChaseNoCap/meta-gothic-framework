# GraphQL Architecture Guide

## Overview
The metaGOTHIC framework uses a federated GraphQL architecture where all API calls from the UI go through a single GraphQL gateway. This ensures consistency, better caching, and easier monitoring.

## Architecture

```
┌─────────────────────────────────────────┐
│         UI Components                   │
│         (React + Apollo Client)         │
└────────────────┬────────────────────────┘
                 │ GraphQL (port 3001)
                 ▼
┌─────────────────────────────────────────┐
│      GraphQL Federation Gateway         │
│         (GraphQL Yoga + Mesh)           │
├─────────────────────────────────────────┤
│ • Unified API endpoint                  │
│ • Schema stitching                      │
│ • WebSocket subscriptions               │
│ • OpenAPI transformation (planned)      │
└────┬──────────────────┬─────────────────┘
     │                  │
     ▼                  ▼
┌──────────────┐  ┌──────────────────┐
│Claude Service│  │Repo Agent Service│
│ (port 3002)  │  │   (port 3004)   │
└──────────────┘  └──────────────────┘
```

## Services

### 1. Claude Service (port 3002)
- **Purpose**: AI operations and session management
- **Operations**:
  - `executeCommand`: Run Claude commands
  - `generateCommitMessages`: AI-powered commit messages
  - `generateExecutiveSummary`: Create summaries
  - `agentRuns`: Track AI agent executions

### 2. Repo Agent Service (port 3004)
- **Purpose**: Git operations and repository management
- **Operations**:
  - `gitStatus`: Get repository status
  - `scanAllRepositories`: Scan for changes
  - `commitChanges`: Commit to repositories
  - `pushChanges`: Push to remote

### 3. Federation Gateway (port 3001)
- **Purpose**: Unified API endpoint for UI
- **Features**:
  - Combines schemas from all services
  - Handles authentication
  - Manages subscriptions
  - Will include GitHub REST→GraphQL transformation

## UI Integration

### Apollo Client Setup
```typescript
const apolloClient = new ApolloClient({
  uri: 'http://localhost:3001/graphql',
  wsUri: 'ws://localhost:3001/graphql',
  cache: new InMemoryCache(),
  headers: {
    Authorization: `Bearer ${GITHUB_TOKEN}`
  }
});
```

### Service Usage Pattern
Instead of direct REST calls:
```typescript
// ❌ Old way - direct REST
const response = await fetch('/api/git/status');

// ✅ New way - GraphQL
const { data } = await apolloClient.query({
  query: GET_REPOSITORY_STATUS,
  variables: { path: repoPath }
});
```

## Migration Status

### ✅ Completed
1. **GraphQL Services**: All backend services migrated to GraphQL Yoga
2. **Federation Gateway**: Working with WebSocket support
3. **UI Components**: Updated to use GraphQL services
4. **Service Wrappers**: Created GraphQL versions of all services

### 🚧 In Progress
1. **GitHub OpenAPI**: Integrating GitHub REST API via OpenAPI transformation
2. **Performance Testing**: Validating federation performance
3. **Error Handling**: Improving error propagation

### 📋 Planned
1. **Caching Strategy**: Implement field-level caching
2. **Monitoring**: Add performance tracking
3. **Security**: Enhanced authentication flow

## Environment Variables

### Required for UI
```bash
# GraphQL Gateway endpoint
VITE_GRAPHQL_URL=http://localhost:3001/graphql
VITE_GRAPHQL_WS_URL=ws://localhost:3001/graphql

# GitHub authentication
VITE_GITHUB_TOKEN=your_github_token
```

### Deprecated (remove after full migration)
```bash
# No longer needed - all goes through GraphQL
# VITE_API_URL=/api
# VITE_GIT_API_URL=http://localhost:3003
```

## Running the Stack

1. **Start backend services**:
   ```bash
   cd services
   ./start-yoga-services.sh
   ```

2. **Start federation gateway**:
   ```bash
   cd services/meta-gothic-app
   npm run dev:yoga-mesh-ws
   ```

3. **Start UI**:
   ```bash
   cd packages/ui-components
   npm run dev
   ```

## Troubleshooting

### Gateway not showing GitHub operations
The OpenAPI transformation is configured but not yet integrated into the running gateway. GitHub operations can be added to repo-agent-service as GraphQL queries/mutations.

### WebSocket connection issues
Ensure the gateway is running with WebSocket support (`yoga-mesh-gateway-ws-fixed.ts`).

### Authentication errors
Check that VITE_GITHUB_TOKEN is set in your environment.

## Benefits of This Architecture

1. **Single API Endpoint**: All requests go through one endpoint
2. **Type Safety**: Generated TypeScript types from GraphQL schema
3. **Performance**: Field-level caching and query optimization
4. **Real-time Updates**: WebSocket subscriptions for live data
5. **Future-proof**: Easy to add new services or data sources