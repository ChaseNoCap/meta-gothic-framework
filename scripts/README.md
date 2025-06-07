# Meta-Gothic Framework Scripts

This directory contains utility scripts for managing the Meta-Gothic Framework.

## Git Management Scripts

### Hierarchical Commit & Push

The Meta-Gothic Framework uses Git submodules for packages. To maintain a clean git history, changes must be committed in the correct order:

1. **Submodules first** - Commit changes in package directories
2. **Parent repo second** - Commit the updated submodule references

### Available Commands

#### `npm run git:commit` - Hierarchical Commit
Commits changes in the correct order:
```bash
npm run git:commit "your commit message"
```

Features:
- Automatically detects changes in submodules
- Commits submodules first
- Updates submodule references in parent repo
- Creates a single commit message for all repos
- Shows what's being committed at each step

#### `npm run git:push` - Hierarchical Push
Pushes all commits to remote repositories:
```bash
npm run git:push
```

Features:
- Pushes submodules first, then parent repo
- Shows what commits will be pushed
- Handles new branches (creates them on remote)
- Provides detailed success/failure summary

#### `npm run git:sync` - Commit and Push
Combines commit and push operations:
```bash
npm run git:sync "your commit message"
```

### Direct Script Usage

You can also use the scripts directly:

```bash
# Commit with a message
./scripts/git-commit-hierarchical.sh "feat: add new feature"

# Push all changes
./scripts/git-push-hierarchical.sh
```

### Why Hierarchical?

When working with Git submodules:
- ❌ **Wrong way**: Commit parent first → Creates dirty state when submodules are committed later
- ✅ **Right way**: Commit submodules first → Parent commits clean references

### Example Workflow

1. Make changes in various packages and the root repo
2. Run `npm run git:commit "feat: update authentication"`
3. Review what's being committed
4. Confirm push when prompted (or use `npm run git:push` later)

### Troubleshooting

**"Failed to push" errors**:
- Ensure you have push access to all repositories
- Check if branches are protected
- Pull latest changes: `git pull --recurse-submodules`

**"No remote branch" warnings**:
- The script will create remote branches automatically
- Ensure your git remote is configured correctly

## Service Management Scripts

### `start.cjs` - Service Manager
Starts all Meta-Gothic services using PM2 with Cosmo federation.

#### Usage
```bash
# Start services with monitor
npm start

# Start services without monitor (useful for testing)
npm start -- --no-monitor
# or
npm start -- -n
```

Features:
- Automatic cleanup of zombie processes and ports
- Environment variable loading from .env files
- Health checks for all services
- Pre-flight dependency checks
- Automatic launch of service monitor (unless --no-monitor flag is used)
- Cosmo router configuration
- PM2 process management for all services

Options:
- `--no-monitor` or `-n` - Start services and exit without launching the monitor

### `monitor.cjs` - Service Monitor
Real-time monitoring of all Meta-Gothic services with interactive controls.

#### Usage
```bash
# Monitor services
npm run monitor
```

Interactive Commands:
- `l` - Toggle log view
- `r` - Restart all services
- `s` - Stop all services
- `1-4` - Restart individual service
- `m` - Open PM2 monit
- `q` - Quit monitor

### `debug-service.cjs` - Service Debugger
Debug individual services with detailed logging.

### `preflight-check.cjs` - Pre-flight Checks
Validates environment and dependencies before starting services.