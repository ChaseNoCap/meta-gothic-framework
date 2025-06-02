# GraphQL Git Operation Completion Solution

## Overview

This document describes the replacement of brittle delay-based approaches with a proper solution for tracking git operation completion in the metaGOTHIC framework.

## Problem

Previously, the codebase used arbitrary delays (`setTimeout`) after git commit operations to wait for them to complete:

```typescript
// Old approach - brittle and unreliable
setTimeout(() => {
  startReview();
  setIsRefreshing(false);
}, 1500); // Arbitrary 1.5 second delay
```

This approach had several issues:
- Delays were arbitrary and could be too short or unnecessarily long
- No verification that the git operation actually completed
- Could lead to race conditions or stale data

## Solution

We've implemented a proper solution that:

1. **Tracks commit completion** using the commit hash returned from the GraphQL mutation
2. **Polls repository status** to verify the working directory is clean
3. **Provides configurable timeout and retry logic**
4. **Works with both single and batch operations**

### New GraphQL Schema

Added new fields to `CommitResult`:
```graphql
type CommitResult {
  success: Boolean!
  commitHash: String
  error: String
  repository: String!
  committedFiles: [String!]!
  isClean: Boolean        # NEW: Whether working directory is clean after commit
  remainingFiles: Int     # NEW: Number of uncommitted files remaining
}
```

Added new queries:
```graphql
type Query {
  # Check if repository has uncommitted changes
  isRepositoryClean(path: String!): RepositoryCleanStatus!
  
  # Get the latest commit hash for a repository
  latestCommit(path: String!): CommitInfo!
}
```

### React Hook: useGitOperationCompletion

A new React hook that properly waits for git operations to complete:

```typescript
import { useGitOperationCompletion } from '@/hooks/useGitOperationCompletion';

// In your component
const {
  waitForCommitCompletion,
  waitForBatchCompletion,
  getLatestCommitHash
} = useGitOperationCompletion({
  pollingInterval: 500,    // Poll every 500ms (default)
  maxAttempts: 20,         // Max 10 seconds (default)
  onComplete: () => {
    // Called when operations complete successfully
    refreshData();
  },
  onError: (error) => {
    // Called if operations fail or timeout
    showError(error.message);
  }
});
```

### Usage Examples

#### Single Repository Commit

```typescript
const commitRepository = async (repo: Repository) => {
  try {
    // Get current commit hash before committing
    const previousHash = await getLatestCommitHash(repo.path);
    
    // Perform the commit
    const result = await commitChanges({
      repository: repo.path,
      message: commitMessage
    });
    
    if (result.success) {
      // Wait for commit to complete properly
      await waitForCommitCompletion(
        repo.path,
        previousHash,
        true // expectedClean - wait until working directory is clean
      );
      
      // Repository is now in a clean state, safe to refresh
    }
  } catch (error) {
    console.error('Commit failed:', error);
  }
};
```

#### Batch Commit Operations

```typescript
const commitAll = async (repositories: Repository[]) => {
  // Get current hashes for all repos
  const repoHashes = await Promise.all(
    repositories.map(async repo => ({
      path: repo.path,
      previousHash: await getLatestCommitHash(repo.path)
    }))
  );
  
  // Perform batch commit
  const result = await batchCommit(commits);
  
  // Wait for all successful commits to complete
  const successfulCommits = result.results
    .filter(res => res.success)
    .map(res => {
      const hash = repoHashes.find(h => h.path === res.repository);
      return hash ? {
        path: hash.path,
        previousCommitHash: hash.previousHash
      } : null;
    })
    .filter(Boolean);
  
  await waitForBatchCompletion(successfulCommits);
  // All commits are complete and verified
};
```

## Benefits

1. **Reliability**: Operations are verified to be complete before proceeding
2. **Performance**: No unnecessary waiting - completes as soon as operations finish
3. **Error Handling**: Proper timeout and error reporting
4. **Flexibility**: Configurable polling intervals and timeouts
5. **User Experience**: Clear feedback when operations are taking longer than expected

## Migration Guide

To migrate existing code:

1. Replace `setTimeout` delays with `waitForCommitCompletion` or `waitForBatchCompletion`
2. Capture commit hashes before operations using `getLatestCommitHash`
3. Use the hook's callbacks instead of inline state updates
4. Remove manual refresh calls - let the hook handle it

## Implementation Details

The solution works by:

1. **Before commit**: Capturing the current commit hash
2. **After commit**: Polling the repository status using GraphQL queries
3. **Verification**: Checking that:
   - The commit hash has changed (new commit created)
   - The working directory is clean (no uncommitted files)
4. **Completion**: Calling the `onComplete` callback when verified

The polling mechanism uses exponential backoff and has configurable timeouts to prevent infinite waiting.