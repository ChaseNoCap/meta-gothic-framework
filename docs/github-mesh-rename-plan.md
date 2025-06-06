# GitHub Mesh to GitHub Adapter Rename Plan

## Overview

We're renaming the "GitHub Mesh" service to "GitHub Adapter" to reflect that we're moving away from GraphQL Mesh to other technologies (gRPC in Cosmo stack).

## Rename Scope

### Service Name Changes
- **Old**: `github-mesh`
- **New**: `github-adapter`

### Package Name Changes
- **Old**: `@meta-gothic/github-mesh`
- **New**: `@meta-gothic/github-adapter`

## Files and Locations to Update

### 1. Directory Structure
```bash
# Rename the main directory
mv services/github-mesh services/github-adapter
```

### 2. Package Files
- `services/github-adapter/package.json`
  - Update `name` field to `@meta-gothic/github-adapter`
  - Update `description` to remove "GraphQL Mesh" reference
  
### 3. PM2 Configuration
- `ecosystem.config.cjs`
  - Update app name from `github-mesh` to `github-adapter`
  - Update log file names
  - Update cwd path

### 4. Script Files
- `scripts/monitor.cjs` - Update service name in monitoring config
- `scripts/debug-service.cjs` - Update in debug service list
- `scripts/start.cjs` - Update in startup configuration
- `scripts/preflight-check.cjs` - Update in preflight checks

### 5. Federation/Supergraph Files
- `services/meta-gothic-app/supergraph.yaml` - Update subgraph name
- `services/meta-gothic-app/supergraph-config.yaml` - Update if present
- `services/meta-gothic-app/supergraph-config-local.yaml` - Update if present
- `services/meta-gothic-app/compose-supergraph.sh` - Update service references

### 6. Generated Schema Files
```bash
# Rename schema file
mv services/meta-gothic-app/github-mesh-schema.graphql \
   services/meta-gothic-app/github-adapter-schema.graphql
```

### 7. Gateway Files
Update all gateway implementations that reference the GitHub service:
- `services/meta-gothic-app/src/gateway-federation.ts`
- Any other gateway files

### 8. Documentation
Update all documentation files:
- Migration guides
- README files
- Architecture diagrams
- API documentation

### 9. Log Files
```bash
# Clean up old log files or rename them
mv logs/github-mesh-*.log logs/github-adapter-*.log
```

### 10. Git Submodule (if applicable)
If the service is a git submodule, update `.gitmodules`

## Implementation Steps

### Step 1: Create Migration Script
```bash
#!/bin/bash
# rename-github-mesh.sh

# 1. Rename directory
echo "Renaming directory..."
mv services/github-mesh services/github-adapter

# 2. Update package.json
echo "Updating package.json..."
sed -i '' 's/@meta-gothic\/github-mesh/@meta-gothic\/github-adapter/g' \
  services/github-adapter/package.json
sed -i '' 's/GraphQL Mesh wrapper for GitHub API/GitHub API adapter service/g' \
  services/github-adapter/package.json

# 3. Update ecosystem.config.cjs
echo "Updating PM2 config..."
sed -i '' 's/github-mesh/github-adapter/g' ecosystem.config.cjs

# 4. Update scripts
echo "Updating scripts..."
for script in scripts/*.cjs; do
  sed -i '' 's/github-mesh/github-adapter/g' "$script"
done

# 5. Update federation files
echo "Updating federation config..."
sed -i '' 's/github-mesh/github-adapter/g' services/meta-gothic-app/supergraph*.yaml
sed -i '' 's/github-mesh/github-adapter/g' services/meta-gothic-app/compose-supergraph.sh

# 6. Rename schema file
echo "Renaming schema file..."
mv services/meta-gothic-app/github-mesh-schema.graphql \
   services/meta-gothic-app/github-adapter-schema.graphql 2>/dev/null || true

# 7. Update gateway files
echo "Updating gateway files..."
find services/meta-gothic-app/src -name "*.ts" -type f -exec \
  sed -i '' 's/github-mesh/github-adapter/g' {} \;
find services/meta-gothic-app/src -name "*.ts" -type f -exec \
  sed -i '' 's/GitHub Mesh/GitHub Adapter/g' {} \;

# 8. Clean package-lock
echo "Cleaning package-lock..."
rm -f services/github-adapter/package-lock.json

# 9. Reinstall dependencies
echo "Reinstalling dependencies..."
cd services/github-adapter && npm install

echo "Rename complete! Please review changes and test."
```

### Step 2: Manual Updates
1. Review and update any documentation
2. Update any CI/CD configurations
3. Update environment variable names if needed
4. Test all services to ensure they still connect properly

### Step 3: Update Federation Registration
After renaming, re-register the service with the federation:
```bash
# For Apollo Federation
rover subgraph publish my-graph@current \
  --name github-adapter \
  --schema ./services/github-adapter/schema.graphql \
  --routing-url http://localhost:3005/graphql

# For Cosmo (future)
cosmo subgraph update github-adapter \
  --federated-graph meta-gothic \
  --routing-url http://localhost:3005/graphql
```

### Step 4: Update References in Code
Search and replace in all TypeScript/JavaScript files:
- `'github-mesh'` → `'github-adapter'`
- `"github-mesh"` → `"github-adapter"`
- `GitHub Mesh` → `GitHub Adapter`
- `GitHubMesh` → `GitHubAdapter` (if used in class names)

### Step 5: Update Logging and Monitoring
1. Update log parsing rules if any
2. Update monitoring dashboards
3. Update alert configurations

## Testing Plan

1. **Service Startup**: Ensure the renamed service starts correctly
2. **Federation**: Test that the service registers with the gateway
3. **Queries**: Run test queries to ensure GitHub data is accessible
4. **Monitoring**: Verify logs are being written to new locations
5. **Integration**: Test with other services that depend on GitHub data

## Rollback Plan

If issues arise:
1. Keep a backup of the original configuration
2. Can temporarily symlink old names to new names
3. Revert the rename script changes

## Future Considerations

When migrating to Cosmo with gRPC:
- The name "github-adapter" remains appropriate
- Will need to update the implementation but not the service name
- Consider creating a new branch for gRPC implementation

## Timeline

1. **Immediate**: Update documentation and create rename script
2. **Next Sprint**: Execute rename during a maintenance window
3. **Future**: Implement gRPC version in the newly named service