# REST Service Export Fix

## Issue
The Change Review page was failing when using REST mode because the service exports were incorrectly configured. The `changeReviewService` export in `services/index.ts` was actually pointing to the GraphQL implementation (`changeReviewServiceGraphQL`), not the REST implementation.

## Root Cause
1. In `services/index.ts`, the export was:
   ```typescript
   export { changeReviewServiceGraphQL as changeReviewService } from './changeReviewServiceGraphQL';
   ```

2. In `changeReviewService.ts`, there was a confusing re-export at the bottom:
   ```typescript
   export { changeReviewServiceGraphQL as default } from './changeReviewServiceGraphQL';
   ```

## Fix Applied
1. Updated `services/index.ts` to export the actual REST service:
   ```typescript
   // Export the actual REST service, not the GraphQL one
   export { changeReviewService } from './changeReviewService';
   ```

2. Removed the confusing re-export from `changeReviewService.ts`

3. Added explicit export of `changeReviewServiceGraphQL` for when it's needed directly

## Result
Now when the Change Review page is in REST mode, it correctly uses the REST implementation that makes HTTP calls to `http://localhost:3003/api/git/...` endpoints. The commit operations should work properly when the git server is running.

## Service Selection in ChangeReview.tsx
The page selects services based on `apiMode`:
- `'rest'` → uses `changeReviewService` (REST implementation)
- `'graphql'` → uses `graphqlChangeReviewService` 
- `'graphql-parallel'` → uses `graphqlParallelChangeReviewService`

All three services implement the same interface with methods:
- `performComprehensiveReview()`
- `commitRepository()`
- `batchCommit()`
- `pushRepository()`
- `batchPush()`