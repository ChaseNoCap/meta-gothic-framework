# ADR-003: Automated Publishing Infrastructure

**Date**: May 2025  
**Status**: Implemented  
**Decision Makers**: Development Team  

## Context

The h1b-visa-analysis project needed automated package publishing to enable proper monitoring, reduce manual work, and ensure consistent releases across 11 Git submodule packages.

### Current State
- All 11 packages successfully publish to GitHub Packages
- Publishing was initially manual, creating monitoring blind spots
- Dependency updates required manual intervention
- No visibility into publish status or automation health

### Problem Statement
- Manual publishing prevented automation monitoring
- Inconsistent release processes across packages
- No real-time dependency update propagation
- Lack of publish metrics for dashboard reporting

### Requirements
- Automated publishing triggered by git tags
- Real-time notifications to meta repository
- Quality gates before publishing
- Monitoring and metrics collection
- Zero manual intervention for updates

## Decision

We implemented a comprehensive automated publishing infrastructure with **dual-mode architecture** supporting both rapid local development and production-ready publishing:

### Chosen Solution

1. **Dual-Mode Dependency Architecture**
   - **Local Development Mode**: Uses `npm link` for instant cross-package updates (<1 second)
   - **Pipeline Mode**: Tag-triggered publishing with full integration testing
   - **Automatic Mode Detection**: Based on CI environment and git tag presence
   - **Smart Dependency Manager**: `scripts/smart-deps.js` handles mode switching

2. **Git Submodule Management Pattern**
   - Each of the 11 packages is an independent Git repository
   - Meta repository aggregates packages via Git submodules
   - Submodule references updated automatically during dependency updates
   - Dual development workflow: edit in submodules, consume via npm packages

3. **Tag-Based Publishing Workflows**
   - Each package has standardized publish workflow (`Unified Package Workflow`)
   - Triggered by semantic version tags (v*.*.* format)
   - Includes quality gates (build, test, lint, typecheck)
   - Publishes to GitHub Packages Registry with scoped @chasenocap namespace

4. **Repository Dispatch Notifications**
   - Notify workflows in each package repository
   - Fires repository_dispatch to meta repository on successful publish
   - Enables instant dependency updates across the ecosystem
   - Provides real-time publish notifications with package/version metadata

5. **Automated Dependency Updates**
   - Auto-update workflow in meta repository
   - Triggered by repository_dispatch events from package publishes
   - Updates both npm dependencies AND git submodule references
   - Creates PRs with detailed change information and auto-merge capability

6. **NPM Authentication Strategy (ADR-016)**
   - Environment variable-based authentication using NPM_TOKEN
   - Consistent across local development and CI/CD pipelines
   - `.npmrc` files use `${NPM_TOKEN}` placeholder pattern
   - Same Personal Access Token for repository access and package registry

7. **Monitoring Infrastructure**
   - CI health monitoring scripts with transparent metrics
   - Dashboard generation with real publish/workflow data
   - Workflow success rate tracking across all 11+ packages
   - Publish status visibility and automation health scoring

### Implementation Approach

#### 1. Dual-Mode Architecture

**Local Development Workflow**:
```bash
# Setup (one-time per machine)
npm run dev:setup  # Links all packages automatically

# Normal development
cd packages/logger
# Edit code...
npm test           # Tests run against linked dependencies
# Changes instantly available in all consumers
```

**Pipeline Publishing Workflow**:
```bash
# Tag for publishing
cd packages/logger
git tag v1.2.3 -m "feat: add structured logging"
git push origin main --tags

# Automatic pipeline:
# 1. Unified Package Workflow triggers
# 2. Quality gates (build, test, lint)
# 3. Publish to GitHub Packages
# 4. Repository dispatch to meta repo
# 5. Auto-update workflow creates PR
# 6. Submodule references updated
```

#### 2. Git Submodule Integration

**Submodule Structure**:
```
h1b-visa-analysis/                    # Meta repository
├── packages/                         # All packages as submodules
│   ├── logger/                       # → github.com/ChaseNoCap/logger
│   │   ├── .git/                     # Independent git repository
│   │   ├── package.json              # @chasenocap/logger
│   │   └── src/                      # Package source
│   ├── cache/                        # → github.com/ChaseNoCap/cache
│   └── [9 more packages]
├── .gitmodules                       # Submodule configuration
├── package.json                      # Consumes published packages
│   └── dependencies: {
│         "@chasenocap/logger": "^1.0.0"  # From GitHub Packages
│       }
└── scripts/smart-deps.js             # Mode detection & linking
```

**Automatic Submodule Updates**:
```yaml
# Auto-update workflow (simplified)
name: Auto Update Dependencies
on:
  repository_dispatch:
    types: [package-published]

jobs:
  update:
    steps:
      - name: Update npm dependency
        run: npm update @chasenocap/${{ github.event.client_payload.package }}
      
      - name: Update submodule reference
        run: |
          cd packages/${{ github.event.client_payload.package }}
          git fetch origin
          git checkout ${{ github.event.client_payload.version }}
          cd ../..
          git add packages/${{ github.event.client_payload.package }}
      
      - name: Create PR
        run: gh pr create --title "chore: update ${{ github.event.client_payload.package }}"
```

#### 3. Unified Package Workflow

**Standardized across all packages**:
```yaml
name: Unified Package Workflow
on:
  push:
    tags: ['v*.*.*']

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure npm authentication
        run: |
          npm config set @chasenocap:registry https://npm.pkg.github.com
          npm config set //npm.pkg.github.com/:_authToken ${{ secrets.PAT_TOKEN }}
          npm config set registry https://registry.npmjs.org/
      
      - name: Install dependencies
        run: npm ci
      
      - name: Quality gates
        run: |
          npm run build
          npm test
          npm run lint
          npm run typecheck
      
      - name: Publish package
        run: npm publish
      
      - name: Notify meta repository
        run: |
          curl -X POST \
            -H "Authorization: token ${{ secrets.PAT_TOKEN }}" \
            -H "Accept: application/vnd.github.v3+json" \
            https://api.github.com/repos/ChaseNoCap/h1b-visa-analysis/dispatches \
            -d '{
              "event_type": "package-published",
              "client_payload": {
                "package": "${{ github.event.repository.name }}",
                "version": "${{ github.ref_name }}"
              }
            }'
```

#### 4. Smart Dependency Manager

**Mode Detection Logic**:
```javascript
const detectMode = () => {
  const isCI = process.env.CI === 'true';
  const hasTag = process.env.GITHUB_REF?.startsWith('refs/tags/');
  const isLocalDev = !isCI && !hasTag;
  const forceRegistry = process.env.FORCE_REGISTRY === 'true';
  
  return {
    mode: isLocalDev && !forceRegistry ? 'local' : 'pipeline',
    useLinks: isLocalDev && !forceRegistry,
    useRegistry: isCI || forceRegistry || hasTag,
    shouldPublish: hasTag
  };
};
```

## Alternatives Considered

### Option 1: Scheduled Publishing
- **Pros**: Simple to implement, predictable timing
- **Cons**: Delays in updates, not event-driven
- **Reason for rejection**: Doesn't provide instant updates needed for development

### Option 2: Push-Based Publishing (Every Commit)
- **Pros**: Always up-to-date
- **Cons**: Too many versions, no quality control
- **Reason for rejection**: Would create version fatigue and unstable releases

### Option 3: Manual Publishing with Automation Helpers
- **Pros**: Full control, selective releases
- **Cons**: Still requires manual intervention, monitoring gaps
- **Reason for rejection**: Doesn't solve the core automation problem

## Consequences

### Positive
- ✅ **Zero Manual Publishing**: Fully automated from tag to deployment
- ✅ **Real-time Updates**: Dependencies update within minutes of publish
- ✅ **Quality Enforcement**: Can't publish broken packages
- ✅ **Complete Visibility**: Full metrics on publish status and health
- ✅ **Consistent Process**: Same workflow across all packages

### Negative
- ⚠️ **Complexity**: Multiple moving parts require understanding
- ⚠️ **Token Management**: Requires PAT_TOKEN maintenance
- ⚠️ **Workflow Debugging**: GitHub Actions debugging can be challenging

### Risks & Mitigations
- **Risk**: PAT token expiration
  - **Mitigation**: Token rotation reminders, long-lived tokens
- **Risk**: Workflow failures blocking releases
  - **Mitigation**: Manual publish fallback, comprehensive monitoring
- **Risk**: Accidental publishes from tags
  - **Mitigation**: Clear tagging conventions, quality gates

## Validation

### Success Criteria
- [x] All 11+ packages have automated publish workflows (Unified Package Workflow)
- [x] Repository dispatch notifications working (96%+ success rate)
- [x] Auto-update workflow creates PRs successfully with submodule updates
- [x] Quality gates prevent broken publishes (build, test, lint, typecheck)
- [x] Monitoring shows real publish metrics and automation health
- [x] Dual-mode architecture working (local npm link + pipeline publishing)
- [x] Smart dependency manager handles mode detection automatically
- [x] NPM authentication consistent across local and CI environments (ADR-016)
- [x] Git submodule references updated automatically with package publishes

### Testing Approach
- Created AUTOMATION.md test files in all packages
- Verified workflow triggers and execution
- Confirmed repository_dispatch events fire
- Validated end-to-end update flow
- Tested quality gate enforcement

### Validation Results
**Test Date**: May 28, 2025
**Outcome**: ✅ All H1B packages + metaGOTHIC packages ready for automation

**H1B Analysis Packages (11 packages)**:
| Package | Workflow | Dispatch | Auto-Update | Status |
|---------|----------|----------|-------------|--------|
| All 11  | ✅       | ✅       | ✅          | OPERATIONAL |

**metaGOTHIC Foundation Packages (9 packages)**:
| Package | Implementation | Tests | Docs | Ready to Publish |
|---------|---------------|-------|------|------------------|
| claude-client | ✅ | 19 tests | ✅ | ✅ |
| prompt-toolkit | ✅ | 32 tests | ✅ | ✅ |
| sdlc-config | ✅ | 39 tests | ✅ | ✅ |
| sdlc-engine | ✅ | 20 tests | ✅ | ✅ |
| sdlc-content | ✅ | 56 tests | ✅ | ✅ Published |
| ui-components | ✅ | React tests | ✅ | ✅ |
| context-aggregator | ✅ | 14 tests | ✅ | ✅ |
| graphql-toolkit | ✅ | 52 tests | ✅ | ✅ |
| github-graphql-client | ✅ | Comprehensive | ✅ | ✅ |

**Total Ecosystem**: 20 packages (11 operational + 9 ready for publishing)

## References

- **Implementation**: `.github/workflows/` in each package repository
- **Monitoring**: `/scripts/monitor-ci-health.sh`
- **Documentation**: `/docs/package-operations-guide.md`
- **Validation**: `/docs/automation-validation-status.md`

## Changelog

- **2025-05-25**: Initial implementation and validation
- **2025-05-26**: Enhanced with npm config standardization
- **2025-05-27**: Documentation created from implementation state
