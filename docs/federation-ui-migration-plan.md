# Federation UI Migration Plan

## Overview

This document outlines the plan to migrate the UI components from using the stitched GraphQL schema (with type prefixes) to the federated schema.

## Current State

- UI is already configured to use the gateway endpoint at `http://localhost:3000/graphql`
- Queries and mutations use type prefixes from the old stitching approach:
  - `Claude_` prefix for Claude service types
  - `Repo_` prefix for Repo Agent service types
- The gateway is backward compatible, so existing queries continue to work

## Migration Steps

### Phase 1: Remove Type Prefixes (Quick Win)

Update the following files to remove type prefixes:

1. **`src/graphql/operations.ts`**
   - Change `Claude_ExecuteInput` → `ClaudeExecuteInput`
   - Change `Repo_CommitInput` → `CommitInput`
   - Change `Repo_BatchCommitInput` → `BatchCommitInput`
   - Change `Claude_BatchCommitMessageInput` → `BatchCommitMessageInput`
   - Change `Repo_GitCommandInput` → `GitCommandInput`

2. **Update TypeScript Types**
   - Regenerate GraphQL types from the federated schema
   - Update any manual type imports

### Phase 2: Update Query Names (Optional)

The federated schema uses cleaner query names:
- `claudeHealth` → `health` (from Claude service)
- `repoAgentHealth` → `health` (from Repo Agent service)

Since both services define `health`, the gateway exposes them as:
- `claudeHealth` for Claude service
- `repoAgentHealth` for Repo Agent service

No changes needed here as the current names match the federated schema.

### Phase 3: Implement Cross-Service Queries

Take advantage of federation by creating queries that span services:

```graphql
query SessionWithRepository($sessionId: ID!) {
  session(id: $sessionId) {
    id
    workingDirectory
    repository {  # Resolved by Repo Agent service
      path
      isDirty
      status {
        branch
        uncommittedCount
      }
    }
  }
}
```

### Phase 4: Add GitHub Integration

Leverage the GitHub Mesh service for enhanced repository data:

```graphql
query RepositoryWithGitHub($owner: String!, $name: String!) {
  githubRepository(owner: $owner, name: $name) {
    stargazers_count
    open_issues_count
    localRepository {  # Resolved by Repo Agent service
      isDirty
      uncommittedCount
    }
  }
}
```

## Implementation Order

1. **Start with non-breaking changes**: Remove type prefixes in mutations
2. **Test backward compatibility**: Ensure all existing queries work
3. **Gradually add federation features**: Implement cross-service queries
4. **Monitor performance**: Check query execution times

## Testing Strategy

1. **Unit Tests**: Update GraphQL mocks to match new schema
2. **Integration Tests**: Test against running federated gateway
3. **E2E Tests**: Ensure UI functionality remains intact

## Code Changes Required

### 1. Update operations.ts

```diff
- mutation ExecuteCommand($input: Claude_ExecuteInput!) {
+ mutation ExecuteCommand($input: ClaudeExecuteInput!) {

- mutation CommitChanges($input: Repo_CommitInput!) {
+ mutation CommitChanges($input: CommitInput!) {

- mutation BatchCommit($input: Repo_BatchCommitInput!) {
+ mutation BatchCommit($input: BatchCommitInput!) {

- mutation GenerateCommitMessages($input: Claude_BatchCommitMessageInput!) {
+ mutation GenerateCommitMessages($input: BatchCommitMessageInput!) {

- mutation ExecuteGitCommand($input: Repo_GitCommandInput!) {
+ mutation ExecuteGitCommand($input: GitCommandInput!) {
```

### 2. Update Health Check Query

The health check in apollo-client.ts needs updating:

```diff
query HealthCheck {
-  claudeHealth {
-    healthy
+  health {
+    status
+    claudeAvailable
  }
-  repoAgentHealth {
-    status
-  }
}
```

### 3. Generate New Types

```bash
cd packages/ui-components
npm run codegen
```

## Benefits of Migration

1. **Cleaner Type Names**: No more prefixes to worry about
2. **Cross-Service Queries**: Fetch related data in single request
3. **Better Performance**: Federation's query planning optimizes execution
4. **Future-Proof**: Ready for additional services and entities

## Rollback Plan

If issues arise:
1. The gateway remains backward compatible
2. Can revert individual query changes
3. Type prefixes will continue to work during transition

## Success Criteria

- [ ] All UI queries work without type prefixes
- [ ] No runtime errors in production
- [ ] Performance metrics remain stable or improve
- [ ] At least one cross-service query implemented