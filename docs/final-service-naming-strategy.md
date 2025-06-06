# Final Service Naming Strategy

## Agreed Service Names

Based on our analysis and discussion, here's the final naming strategy:

### 1. **git-service** (formerly repo-agent-service)
- **Purpose**: Local Git operations only
- **Port**: 3004
- **Technology**: GraphQL with simple-git
- **Responsibilities**:
  - Local Git commands (status, commit, push, pull)
  - Repository scanning
  - File system operations
  - NO GitHub API calls

### 2. **github-adapter** (formerly github-mesh)
- **Purpose**: GitHub API adapter (REST → GraphQL → gRPC)
- **Port**: 3005
- **Technology**: 
  - Current: GraphQL Mesh (REST to GraphQL)
  - Future: gRPC (with Cosmo)
- **Responsibilities**:
  - GitHub REST API wrapper
  - Will adapt to gRPC protocol
  - Basic repository/user queries
  - **SHOULD INCLUDE**: GitHub Actions/Workflows (moved from gateway)

### 3. **claude-service** (no change)
- **Purpose**: AI-powered development assistance
- **Port**: 3002
- **Technology**: GraphQL with Claude API
- **Responsibilities**: AI operations, session management

### 4. **gothic-gateway** (formerly meta-gothic-app)
- **Purpose**: Pure GraphQL federation gateway
- **Port**: 3000
- **Technology**: 
  - Current: Apollo Gateway
  - Future: Cosmo Router
- **Responsibilities**:
  - Federation ONLY
  - Schema stitching
  - Request routing
  - **TO REMOVE**: All direct GitHub API code

## Why "github-adapter" is the Right Name

1. **Technology Agnostic**: Works for REST, GraphQL Mesh, or gRPC
2. **Clear Purpose**: Adapts GitHub's API to our needs
3. **Future Proof**: Perfect for the gRPC migration
4. **Pattern Match**: Similar to other adapter patterns in software

## Migration Plan

### Phase 1: Consolidate GitHub Features (CRITICAL)
Before ANY renaming, we need to:

1. **Move GitHub Actions/Workflows from gateway to github-adapter**:
   ```typescript
   // Move these from gothic-gateway to github-adapter:
   - triggerWorkflow mutation
   - cancelWorkflowRun mutation  
   - githubWorkflows query
   - githubWorkflowRuns query
   - CachedGitHubService
   ```

2. **Clean up the gateway**:
   - Remove all GitHub API code
   - Remove githubResolvers.ts
   - Keep only federation logic

### Phase 2: Execute Renames
1. `repo-agent-service` → `git-service`
2. `github-mesh` → `github-adapter`
3. `meta-gothic-app` → `gothic-gateway`

### Phase 3: Update for Cosmo
When migrating to Cosmo:
- `github-adapter` converts from REST → gRPC
- Name stays the same (adapter pattern still applies)

## Final Architecture

```
gothic-gateway (3000) - Pure federation
├── claude-service (3002) - AI operations
├── git-service (3004) - Local Git operations
└── github-adapter (3005) - GitHub API adapter (REST/gRPC)
```

## Benefits of This Naming

1. **Clear Separation**:
   - Local Git (git-service)
   - Remote GitHub (github-adapter)
   - AI (claude-service)
   - Federation (gothic-gateway)

2. **No Confusion**:
   - `git-service` = local only
   - `github-adapter` = GitHub API only
   - Clear boundaries

3. **Technology Evolution**:
   - `github-adapter` name works for REST, GraphQL, or gRPC
   - No rename needed when switching protocols

## Implementation Order

1. **Week 1**: 
   - Consolidate GitHub features into github-adapter
   - Clean up gateway code
   
2. **Week 2**:
   - Execute service renames
   - Update all configurations
   
3. **Week 3+**:
   - Proceed with Cosmo migration
   - Convert github-adapter to gRPC

## Decision Summary

- ✅ `git-service` - Local Git operations
- ✅ `github-adapter` - GitHub API adapter (your preferred name)
- ✅ `claude-service` - Keep as is
- ✅ `gothic-gateway` - Pure federation gateway

This gives us clean, clear service names that accurately reflect their responsibilities and support future technology changes.