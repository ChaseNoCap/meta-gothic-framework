# Service Naming Migration Guide

## Overview

This guide outlines the comprehensive service naming standardization for the metaGOTHIC framework, to be completed before the Cosmo Router migration.

## Service Renaming Plan

### 1. Gateway Service
**Current**: `meta-gothic-app`  
**New**: `gothic-gateway`  
**Rationale**: Clear indication that this is the gateway service, following the GOTHIC naming pattern

### 2. Git Operations Service
**Current**: `repo-agent-service`  
**New**: `git-service`  
**Rationale**: Simpler, clearer name that accurately describes the service's purpose (local git operations)

### 3. GitHub API Service
**Current**: `github-mesh`  
**New**: `github-adapter`  
**Rationale**: Better reflects its role as an adapter for the GitHub API, will be converted to gRPC

### 4. AI Service (No Change)
**Current**: `claude-service`  
**New**: `claude-service` (no change)  
**Rationale**: Already has a clear, appropriate name

## Migration Steps

### Phase 1: Update Directory Structure

```bash
# Rename service directories
cd services/
mv meta-gothic-app gothic-gateway
mv repo-agent-service git-service
mv github-mesh github-adapter
```

### Phase 2: Update Package.json Files

#### gothic-gateway/package.json
```json
{
  "name": "@meta-gothic/gothic-gateway",
  "description": "GraphQL federation gateway for metaGOTHIC framework"
}
```

#### git-service/package.json
```json
{
  "name": "@meta-gothic/git-service",
  "description": "Local git operations service for metaGOTHIC framework"
}
```

#### github-adapter/package.json
```json
{
  "name": "@meta-gothic/github-adapter",
  "description": "GitHub API adapter service (gRPC) for metaGOTHIC framework"
}
```

### Phase 3: Update Configuration Files

#### Update PM2 ecosystem.config.cjs
```javascript
module.exports = {
  apps: [
    {
      name: 'gothic-gateway',
      cwd: './services/gothic-gateway',
      // ... rest of config
    },
    {
      name: 'git-service',
      cwd: './services/git-service',
      // ... rest of config
    },
    {
      name: 'github-adapter',
      cwd: './services/github-adapter',
      // ... rest of config
    },
    {
      name: 'claude-service',
      cwd: './services/claude-service',
      // ... rest of config
    }
  ]
};
```

### Phase 4: Update Federation Configuration

#### gothic-gateway/supergraph-config.yaml
```yaml
federation_version: =2.7.0
subgraphs:
  claude-service:
    routing_url: http://localhost:3002/graphql
    schema:
      subgraph_url: http://localhost:3002/graphql
  git-service:
    routing_url: http://localhost:3004/graphql
    schema:
      subgraph_url: http://localhost:3004/graphql
  github-adapter:
    routing_url: http://localhost:3005/graphql
    schema:
      subgraph_url: http://localhost:3005/graphql
```

### Phase 5: Update Internal References

#### Update Import Statements
```typescript
// Before
import { GitService } from '@meta-gothic/repo-agent-service';
import { GitHubClient } from '@meta-gothic/github-mesh';

// After
import { GitService } from '@meta-gothic/git-service';
import { GitHubClient } from '@meta-gothic/github-adapter';
```

#### Update GraphQL Schema References
```graphql
# Before
extend type Repository @key(fields: "path") {
  path: String! @external
  # From repo-agent-service
}

# After
extend type Repository @key(fields: "path") {
  path: String! @external
  # From git-service
}
```

### Phase 6: Update Documentation

1. **README.md files** - Update service names in all README files
2. **API documentation** - Update service endpoints and examples
3. **Architecture diagrams** - Update service names in all diagrams
4. **ADR documents** - Add notes about the naming change

### Phase 7: Update Scripts

#### start-services.sh
```bash
#!/bin/bash
echo "Starting metaGOTHIC services..."

# Start services with new names
pm2 start ecosystem.config.cjs --only claude-service
pm2 start ecosystem.config.cjs --only git-service
pm2 start ecosystem.config.cjs --only github-adapter
pm2 start ecosystem.config.cjs --only gothic-gateway

echo "All services started with new names!"
```

### Phase 8: Update Docker/Deployment Configs

#### docker-compose.yml
```yaml
version: '3.8'
services:
  gothic-gateway:
    build: ./services/gothic-gateway
    ports:
      - "3000:3000"
    
  claude-service:
    build: ./services/claude-service
    ports:
      - "3002:3002"
    
  git-service:
    build: ./services/git-service
    ports:
      - "3004:3004"
    
  github-adapter:
    build: ./services/github-adapter
    ports:
      - "3005:3005"
```

## Testing Plan

### 1. Unit Tests
- Update test file imports to use new service names
- Ensure all tests pass with new names

### 2. Integration Tests
- Test federation with new service names
- Verify GraphQL queries work across all services
- Test subscription functionality

### 3. End-to-End Tests
- Full system test with renamed services
- Verify UI dashboard connects properly
- Test all GraphQL operations

## Rollback Plan

If issues arise during migration:

1. **Git Revert**
   ```bash
   git revert HEAD
   ```

2. **Directory Rename Back**
   ```bash
   mv gothic-gateway meta-gothic-app
   mv git-service repo-agent-service
   mv github-adapter github-mesh
   ```

3. **Restart Services**
   ```bash
   pm2 restart all
   ```

## Communication Plan

### 1. Team Notification
- Send migration announcement before starting
- Include new service names and rationale
- Provide timeline for migration

### 2. Documentation Updates
- Update all wikis and knowledge bases
- Update onboarding documentation
- Update troubleshooting guides

### 3. External Communications
- Update any external API documentation
- Notify any external consumers of the services
- Update public-facing documentation

## Post-Migration Checklist

- [ ] All services running with new names
- [ ] Federation working correctly
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Team notified
- [ ] Monitoring dashboards updated
- [ ] Log aggregation updated for new service names
- [ ] CI/CD pipelines updated
- [ ] No references to old names in codebase
- [ ] Git history preserved properly

## Benefits of New Naming

1. **Clarity**: Each service name clearly indicates its purpose
2. **Consistency**: All services follow similar naming patterns
3. **Simplicity**: Shorter, more memorable names
4. **Future-proof**: Names allow for service evolution without confusion

## Timeline

- **Day 1**: Directory structure and package.json updates
- **Day 2**: Configuration file updates
- **Day 3**: Code reference updates and testing
- **Day 4**: Documentation updates
- **Day 5**: Final testing and deployment

Total migration time: 5 days (can be done in parallel with other work)