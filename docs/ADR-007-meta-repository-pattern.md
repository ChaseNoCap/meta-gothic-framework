# ADR-007: Meta Repository Pattern for Package Management

**Date**: 2025-01-27  
**Status**: Accepted  
**Decision Makers**: H1B Analysis & metaGOTHIC Teams  

## Context

Managing multiple related packages in a polyglot, microservices architecture requires careful coordination of dependencies, versioning, and deployment. The traditional monorepo and separate repository approaches each have significant trade-offs.

### Current State
- H1B project successfully uses meta repository with 11 packages
- Each package is an independent Git repository
- Git submodules link packages to meta repository
- Automated publishing via GitHub Actions
- Real-time dependency updates via repository_dispatch

### Problem Statement
We need a package management strategy that:
1. Maintains package independence and versioning
2. Enables coordinated development and testing
3. Supports automated CI/CD pipelines
4. Allows both local development and production workflows
5. Scales to dozens of packages
6. Provides clear ownership boundaries

### Requirements
- **Independence**: Packages can be developed and released independently
- **Coordination**: Easy to work on multiple packages together
- **Automation**: Full CI/CD automation support
- **Flexibility**: Support both npm link (dev) and npm install (prod)
- **Discoverability**: Easy to find and understand all packages
- **Governance**: Clear ownership and contribution model

## Decision

Use the **Meta Repository Pattern** with Git submodules for managing the package ecosystem.

### Chosen Solution

#### Architecture Overview
```
h1b-visa-analysis/ (Meta Repository)
├── packages/                    # Git submodules directory
│   ├── logger/                 # → github.com/ChaseNoCap/logger
│   ├── di-framework/           # → github.com/ChaseNoCap/di-framework
│   ├── cache/                  # → github.com/ChaseNoCap/cache
│   └── [other packages]        # Each is independent repo
├── src/                        # Meta repo application code
├── package.json               # Consumes published packages
└── .gitmodules                # Submodule configuration
```

#### Key Components

**1. Independent Package Repositories**
- Each package has its own GitHub repository
- Independent version management (semver)
- Own CI/CD pipeline
- Dedicated issues and PRs
- Clear ownership model

**2. Git Submodules Integration**
```bash
# .gitmodules
[submodule "packages/logger"]
    path = packages/logger
    url = https://github.com/ChaseNoCap/logger.git
    branch = main

# Commands
git submodule update --init --recursive  # Clone all
git submodule update --remote --merge    # Update all
```

**3. Dual Development Modes**
```javascript
// Development mode (npm link)
cd packages/logger && npm link
cd ../.. && npm link @chasenocap/logger
// Changes reflect immediately (<1s)

// Production mode (npm install)
npm install @chasenocap/logger@latest
// Uses published package from GitHub Packages
```

**4. Automated Dependency Updates**
```yaml
# Package publishes → Triggers notification
on:
  registry_package:
    types: [published]
    
# Meta repo receives → Creates update PR
on:
  repository_dispatch:
    types: [dependency-update]
```

### Implementation Approach

#### Package Lifecycle
1. **Development**: Work in submodule with npm link
2. **Testing**: Run tests in both package and meta repo
3. **Publishing**: Tag release → GitHub Action publishes
4. **Notification**: repository_dispatch to dependents
5. **Update**: Auto-PR created in meta repository
6. **Integration**: PR merged, submodule updated

#### Directory Structure
```
Package Repository Structure:
├── src/                 # Source code
├── tests/              # Test files
├── dist/               # Build output (gitignored)
├── package.json        # Package manifest
├── tsconfig.json       # TypeScript config
├── .github/
│   └── workflows/
│       └── unified-workflow.yml  # CI/CD pipeline
└── CLAUDE.md           # AI context documentation
```

## Alternatives Considered

### Option 1: Monorepo (Lerna/Nx/Turborepo)
- **Pros**: Atomic commits, easier refactoring, single test run
- **Cons**: Large repo size, complex permissions, version coupling
- **Reason for rejection**: Reduces package independence and complicates CI/CD

### Option 2: Separate Repositories Only
- **Pros**: Complete independence, simple permissions
- **Cons**: Difficult coordination, no unified view, complex local dev
- **Reason for rejection**: Poor developer experience for multi-package work

### Option 3: npm Workspaces
- **Pros**: Native npm support, shared dependencies
- **Cons**: Single repository, coupled versions, limited flexibility
- **Reason for rejection**: Doesn't support independent package repositories

## Consequences

### Positive
- ✅ **Independence**: Each package maintains full autonomy
- ✅ **Flexibility**: Supports both local and production workflows
- ✅ **Automation**: Proven CI/CD patterns work perfectly
- ✅ **Scalability**: Successfully managing 11+ packages
- ✅ **Governance**: Clear ownership via separate repos
- ✅ **Performance**: npm link provides instant feedback

### Negative
- ⚠️ **Learning Curve**: Developers must understand Git submodules
- ⚠️ **Complexity**: More moving parts than monorepo
- ⚠️ **Synchronization**: Submodule updates require explicit commits

### Risks & Mitigations
- **Risk**: Submodule confusion (detached HEAD, etc.)
  - **Mitigation**: Clear documentation, helper scripts
  
- **Risk**: Version conflicts between packages
  - **Mitigation**: Automated dependency updates, version pinning
  
- **Risk**: CI/CD complexity
  - **Mitigation**: Unified workflow template, monitoring dashboard

## Validation

### Success Criteria
- [x] All 11 H1B packages successfully managed
- [x] <1s local development feedback with npm link
- [x] 100% automated publishing pipeline
- [x] Real-time dependency updates working
- [x] Developers report improved productivity

### Testing Approach
- Integration tests across package boundaries
- Automated dependency update testing
- Submodule operation validation
- Performance benchmarking (npm link vs install)

## References

- [Git Submodules Documentation](https://git-scm.com/book/en/v2/Git-Tools-Submodules)
- [Meta Repository Pattern Guide](./meta-repository-pattern.md)
- [Package Operations Guide](./package-operations-guide.md)
- [H1B Package Catalog](./package-catalog.md)

## Changelog

- **2025-01-27**: Documented accepted pattern from H1B project