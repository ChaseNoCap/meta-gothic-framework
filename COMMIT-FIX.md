# Commit Operation Fix

## Issue
The "Commit All" button was failing with:
```
POST http://localhost:3003/api/git/batch-commit net::ERR_CONNECTION_REFUSED
```

## Root Cause
The commit operation was incorrectly using the REST API service (`changeReviewService`) instead of the currently selected service (`reviewService`), which could be GraphQL when the user selects GraphQL mode.

## Fix Applied

### 1. Updated Commit Operation
**File**: `/packages/ui-components/src/pages/ChangeReview.tsx`
- Changed `changeReviewService.batchCommit(commits)` to `reviewService.batchCommit(commits)`
- Changed `changeReviewService.batchPush(successfulRepos)` to `reviewService.batchPush(successfulRepos)`

### 2. Exposed Missing Methods
**File**: `/packages/ui-components/src/services/graphqlChangeReviewService.ts`
- Added `batchCommit` method to the exported interface
- Added `batchPush` method (with TODO for future implementation)

## Result
- When using GraphQL mode, commits now go through the GraphQL batchCommit mutation
- When using REST mode, commits continue to use the REST API
- The service selection (REST/GraphQL/Parallel) is properly respected

## Note
Push functionality is not yet implemented in the GraphQL services and will return an error message indicating this.