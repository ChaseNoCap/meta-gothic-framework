# Troubleshooting: Workspace Root and Repository Discovery Issues

## Problem Symptoms
- Change Review page shows "📁 Discovered 0 repositories in the workspace"
- GraphQL mutations fail with "No data returned from mutation"
- Services can't find repositories in the workspace

## Root Causes

### 1. Incorrect Workspace Root
Services may use their own directory as workspace root instead of the parent project directory.

**Symptom**: Services report 0 repositories when there are actually multiple repositories in the parent directory.

**Solution**: Set `WORKSPACE_ROOT` environment variable when starting services:
```bash
# In start-yoga-services.sh
WORKSPACE_ROOT="$(dirname "$SCRIPT_DIR")"
export WORKSPACE_ROOT
```

### 2. Race Condition in Review State
The GraphQL change review service can get stuck in "in progress" state after an error.

**Symptom**: Retry attempts fail with "review already in progress" errors.

**Solution**: Add error recovery in the UI:
```typescript
// Reset state on error
if (error) {
  await reviewService.resetReviewState();
}
```

### 3. Request Timeout Issues
Long-running GraphQL mutations may timeout without proper handling.

**Symptom**: Requests hang indefinitely or fail after long waits.

**Solution**: Implement timeout wrapper:
```typescript
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Request timed out')), 120000);
});

const response = await Promise.race([
  mutationPromise,
  timeoutPromise
]);
```

### 4. GraphQL Type Name Mismatches
Federation requires specific type name prefixes that may not match in non-federated mode.

**Symptom**: "Unknown type" errors with suggestions for similar type names.

**Solution**: Ensure type names match the service mode:
- Federated: `Claude_BatchCommitMessageInput`
- Non-federated: `BatchCommitMessageInput`

### 5. Request Body Size Limits
Large git diffs can exceed default body size limits.

**Symptom**: "Request body is too large" errors.

**Solution**: Increase Fastify body limit:
```typescript
const app = Fastify({
  logger: true,
  bodyLimit: 10 * 1024 * 1024 // 10MB
});
```

## Verification Steps

1. **Check Workspace Root**:
   ```bash
   # Should show the parent directory, not service directory
   echo $WORKSPACE_ROOT
   ```

2. **Test Repository Discovery**:
   ```bash
   # Direct service call
   curl http://localhost:3004/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"{ scanAllRepositories { name } }"}'
   ```

3. **Verify Federation Gateway**:
   ```bash
   # Gateway call
   curl http://localhost:3000/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"{ scanAllRepositories { name } }"}'
   ```

## Common Issues

### Claude CLI Not Found
**Symptom**: Commit message generation fails with exit code 1

**Solution**: 
- Ensure Claude CLI is installed and in PATH
- Check API keys are configured
- Fallback to pattern-based generation will be used

### Services Not Starting
**Symptom**: Connection refused errors

**Solution**:
- Check if ports are already in use
- Verify all dependencies are installed
- Check service logs for startup errors

## Prevention

1. Always start services with the provided script:
   ```bash
   cd services
   ./start-yoga-services.sh
   ```

2. Set environment variables before starting:
   ```bash
   export GITHUB_TOKEN=your_token
   export WORKSPACE_ROOT=/path/to/meta-gothic-framework
   ```

3. Monitor service health:
   - Check http://localhost:3000/graphql for gateway
   - Check individual service endpoints
   - Watch service logs for errors