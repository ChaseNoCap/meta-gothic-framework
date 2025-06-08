# Revised Service Naming Strategy

## Current Service Responsibilities

After analyzing the codebase, here's what each service actually does:

### 1. **repo-agent-service**
- **Purpose**: Local Git operations only
- **NO GitHub API usage**
- Uses `simple-git` for file system Git operations
- Handles: commit, push, pull, status, branch management
- Works with local repositories on disk

### 2. **github-mesh**
- **Purpose**: GitHub REST API GraphQL wrapper
- **Dedicated GitHub API service**
- Uses GraphQL Mesh to transform GitHub REST to GraphQL
- Provides federated access to GitHub data

### 3. **meta-gothic-app** (Gateway)
- **Mixed responsibilities** (problem!)
  - GraphQL Federation gateway
  - Direct GitHub API calls (duplicating github-mesh)
  - User configuration management
  - Event broadcasting

## The Naming Problem

The current names are confusing because:
- `repo-agent-service` sounds like it might use GitHub API, but it doesn't
- `github-mesh` and the gateway both handle GitHub API
- Responsibilities are unclear and overlapping

## Recommended Service Architecture & Names

### Option A: Clear Separation of Concerns (Recommended)

```yaml
# Local Git Operations
git-service:
  package: "@meta-gothic/git-service"
  port: 3004
  description: "Local Git repository operations"
  responsibilities:
    - Git commands (commit, push, pull, status)
    - Repository scanning
    - File system operations
    - NO GitHub API calls

# GitHub API Integration  
github-service:
  package: "@meta-gothic/github-service"
  port: 3005
  description: "GitHub API integration service"
  responsibilities:
    - GitHub REST/GraphQL API wrapper
    - Repository metadata
    - Workflows and actions
    - User information
    - ALL GitHub API calls

# AI Operations
claude-service:
  package: "@meta-gothic/claude-service"
  port: 3002
  description: "AI-powered development assistance"
  # No changes needed

# Federation Gateway
gothic-gateway:
  package: "@meta-gothic/gateway"
  port: 3000
  description: "GraphQL federation gateway"
  responsibilities:
    - Service federation only
    - NO direct API calls (remove duplicate GitHub code)
    - Request routing
    - Schema stitching
```

### Option B: Domain-Based Names

```yaml
# Version Control Services
local-git-service:    # Clear it's local only
remote-git-service:   # Clear it's remote/GitHub

# Or more specific:
git-operations-service:      # Local git
github-integration-service:  # GitHub API
```

## Migration Plan

### Phase 1: Remove Duplication (CRITICAL)
1. **Move all GitHub API code from gateway to github-service**
   - Remove `CachedGitHubService.ts` from gateway
   - Remove `githubResolvers.ts` mutations from gateway
   - Consolidate in github-service with proper caching

### Phase 2: Rename Services
1. `repo-agent-service` → `git-service`
2. `github-mesh` → `github-service` 
3. `meta-gothic-app` → `gothic-gateway`

### Phase 3: Update Documentation
- Clear responsibility matrix
- Architecture diagrams
- API documentation

## Benefits of New Names

### `git-service` (formerly repo-agent-service)
- **Clear**: Obviously handles Git operations
- **Accurate**: No confusion with GitHub API
- **Simple**: Shorter, cleaner name

### `github-service` (formerly github-mesh)
- **Clear**: Obviously handles GitHub integration
- **Technology-agnostic**: No "mesh" in name
- **Consistent**: Matches `git-service` pattern

### `gothic-gateway`
- **Clear**: Obviously the gateway
- **Single responsibility**: Just federation
- **Clean**: No duplicate API code

## Architecture After Cleanup

```
gothic-gateway (3000)
├── claude-service (3002) - AI operations
├── git-service (3004) - Local Git operations  
└── github-service (3005) - GitHub API operations

Clear separation:
- Local Git operations (git-service)
- Remote GitHub operations (github-service)
- AI operations (claude-service)
- Pure federation (gateway)
```

## Decision Needed

Before proceeding with Cosmo migration, we should:

1. **Decide on final names**
2. **Remove duplicate GitHub API code from gateway**
3. **Clarify service boundaries**

The current overlap between github-mesh and the gateway's GitHub code is technical debt that should be resolved before the migration.

## Recommended Immediate Actions

1. **Audit**: List all GitHub API calls in both services
2. **Consolidate**: Move all GitHub API logic to one service
3. **Rename**: Implement new naming scheme
4. **Document**: Create clear service boundaries

This cleanup will make the Cosmo migration much cleaner and prevent carrying technical debt forward.