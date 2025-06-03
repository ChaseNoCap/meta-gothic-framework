# ADR-Infrastructure: Package Management and CI/CD

**Status**: Accepted and Implemented  
**Date**: Consolidated 2025-01-06  
**Combines**: ADR-001, ADR-002, ADR-003, ADR-007, ADR-016, ADR-017

## Executive Summary

The metaGOTHIC framework uses Git submodules for package management, enabling independent development while maintaining centralized control. Automated CI/CD pipelines handle publishing, updates, and monitoring across all packages.

## Context

Managing multiple interconnected packages requires balancing independence with coordination. Traditional monorepos become unwieldy, while completely separate repositories lack cohesion. We needed a solution that enables parallel development, automated workflows, and clear ownership boundaries.

## Decision

### 1. Git Submodules Architecture

**Meta Repository Pattern**: A central repository aggregates all packages as Git submodules.

```
meta-gothic-framework/          # Meta repository
├── packages/                   # Git submodules
│   ├── claude-client/         # Independent repo
│   ├── prompt-toolkit/        # Independent repo
│   └── ...
├── services/                  # Service submodules
└── scripts/                   # Automation tooling
```

**Benefits**:
- Each package has independent versioning and history
- Clear ownership boundaries (separate repos)
- Flexible development modes (npm link vs install)
- Simplified CI/CD per package

### 2. Automated Publishing Infrastructure

**GitHub Actions Workflow**:
```yaml
on:
  push:
    tags:
      - 'v*'
jobs:
  publish:
    - Test → Build → Publish to GitHub Packages
    - Notify meta repository via repository_dispatch
    - Update dependent packages automatically
```

**Key Features**:
- Tag-based publishing triggers (v1.0.0)
- Automated dependency propagation
- Real-time status notifications
- Rollback capabilities

### 3. Unified Dependency Management

**Update Strategy**:
1. Package publishes new version
2. Sends `repository_dispatch` event to meta repo
3. Meta repo updates submodule reference
4. Triggers cascade updates in dependent packages

**NPM Authentication**:
- Single `NPM_TOKEN` environment variable
- `.npmrc` uses `${NPM_TOKEN}` placeholder
- Same approach for local dev and CI/CD
- Personal Access Token with read/write package scopes

### 4. Development Workflows

**Local Development Modes**:

```bash
# Mode 1: NPM Install (stable)
npm install
# Uses published versions from GitHub Packages

# Mode 2: NPM Link (development)
npm run link:all
# Creates symlinks for active development
```

**Hybrid Approach**: Start with ecosystem patterns, extend with domain features:
- Use established tools (e.g., Commander.js for CLIs)
- Add metaGOTHIC-specific features incrementally
- Maintain compatibility while innovating

### 5. CI/CD Data Collection

**Metrics Collection**:
```javascript
// Collect metrics during CI/CD runs
const metrics = {
  buildTime, testResults, coverage,
  packageSize, dependencies, timestamp
};
// Persist to dashboard-data.json
```

**Dashboard Integration**:
- Real-time build status
- Historical trends
- Cross-package insights
- Automated alerts

## Implementation

### Setup Commands

```bash
# Clone with submodules
git clone --recurse-submodules https://github.com/ChaseNoCap/meta-gothic-framework

# Update all submodules
git submodule update --remote --merge

# Add new package
git submodule add https://github.com/ChaseNoCap/new-package packages/new-package
```

### Publishing Workflow

```bash
# In package directory
npm version patch  # or minor/major
git push --tags    # Triggers publish workflow
# Meta repo automatically updates
```

### Environment Setup

```bash
# Required for package access
export NPM_TOKEN=ghp_xxxxxxxxxxxx

# For local development
echo "//npm.pkg.github.com/:_authToken=\${NPM_TOKEN}" >> ~/.npmrc
```

## Consequences

### Positive
- **Independent Development**: Teams work without blocking each other
- **Clear Boundaries**: Obvious ownership and responsibility
- **Automated Workflows**: Minimal manual intervention
- **Version Control**: Full history for each package
- **Flexible Deployment**: Packages can be used independently

### Negative
- **Learning Curve**: Git submodules require understanding
- **Initial Setup**: More complex than simple monorepo
- **Sync Overhead**: Must keep submodules updated

### Mitigations
- Comprehensive documentation and scripts
- Automated update mechanisms
- Clear troubleshooting guides

## Alternatives Considered

1. **Monorepo (Rejected)**
   - Too restrictive for independent teams
   - Single point of failure
   - Complex CI/CD

2. **Lerna/Nx (Rejected)**
   - Additional tooling complexity
   - Still fundamentally monorepo
   - Less flexibility

3. **Completely Separate Repos (Rejected)**
   - No unified view
   - Manual coordination required
   - Difficult cross-package testing

## Status

Fully implemented and proven in production:
- 8 packages successfully managed
- Automated publishing operational
- Dashboard provides real-time visibility
- Multiple successful version cycles completed

## References

- [Git Submodules Documentation](https://git-scm.com/book/en/v2/Git-Tools-Submodules)
- [GitHub Actions](https://docs.github.com/en/actions)
- [GitHub Packages](https://docs.github.com/en/packages)