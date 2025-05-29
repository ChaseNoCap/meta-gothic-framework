# ADR-001: Unified Dependency Strategy

**Date**: May 2025  
**Status**: Implemented  
**Decision Makers**: Development Team  

## Context

The h1b-visa-analysis project manages 11 Git submodule packages published to GitHub Packages. We needed a dependency strategy that supports both rapid local development and reliable production integration.

### Previous State
- Manual publishing processes
- Slow development feedback loops
- Inconsistent dependency management
- No automated integration testing

### Requirements
- Instant feedback during local development
- Reliable integration testing for production
- Automated publishing and dependency updates
- Zero configuration for developers

## Decision

We implemented a **dual-mode dependency strategy**:

### Local Development Mode (Default)
- Uses `npm link` for instant cross-package updates
- Changes reflected in <1 second across all packages
- No publishing required during development
- Automatic mode detection based on environment

### Pipeline Mode (Tag-triggered)
- Tag commits trigger automated publishing
- Full integration testing with published packages
- Quality gates prevent broken releases
- Automated dependency updates via Renovate

### Automation Infrastructure
- **Smart dependency manager** (`scripts/smart-deps.js`)
- **Automatic mode detection** based on CI/tag presence
- **Tag-based publishing workflows** across all packages
- **Repository dispatch notifications** for instant updates
- **Renovate integration** with strategic package grouping

## Implementation

### Core Components
1. **smart-deps.js**: Automatic mode detection and npm link management
2. **Unified workflows**: Standardized publishing across all 11 packages
3. **Auto-update system**: Repository dispatch → Renovate → PR creation
4. **Quality gates**: Tests, builds, and linting required for publishing

### Package Tiers
```javascript
const PACKAGE_TIERS = {
  core: ['di-framework', 'logger'],          // Immediate updates
  shared: ['cache', 'file-system', '...'],   // 5-minute batching  
  app: ['report-templates', 'prompts']       // 15-minute coordination
};
```

### Developer Workflow
```bash
# Local development (automatic)
npm run dev  # Everything linked and watching

# Integration testing (tag-triggered)
git tag package@1.2.3
git push origin main --tags
```

## Consequences

### Positive
- ✅ **Developer Experience**: Instant updates during development
- ✅ **Production Reliability**: Full integration testing via tags
- ✅ **Zero Configuration**: Automatic mode detection
- ✅ **Quality Enforcement**: Broken packages cannot be published
- ✅ **Automation**: End-to-end dependency management

### Negative
- ⚠️ **Complexity**: Two different modes require understanding
- ⚠️ **Tool Dependencies**: Relies on npm link behavior
- ⚠️ **Mode Switching**: Occasionally need to manually switch modes

### Mitigations
- Comprehensive documentation and troubleshooting guides
- Clear mode indicators in terminal output
- Simple commands for mode switching
- Automatic recovery from most link issues

## Validation Results

### Comprehensive Testing (May 2025)
- ✅ **Local Development**: <1 second updates confirmed
- ✅ **Tag Publishing**: logger@1.0.2 and di-framework@1.0.1 published successfully
- ✅ **Quality Gates**: cache package correctly failed without tests
- ✅ **Auto-Updates**: 11 auto-update branches created automatically
- ✅ **End-to-End**: Complete pipeline validated in production

## Current Status

**Infrastructure**: ✅ Production-ready  
**Adoption**: ✅ 11/11 packages implemented  
**Automation**: ✅ Fully operational  
**Documentation**: ✅ Complete with troubleshooting guides  

## Related Decisions

- **Package Architecture**: Git submodules vs NPM workspaces (chose submodules)
- **Registry Choice**: GitHub Packages vs npmjs.org (chose GitHub for access control)
- **CI Strategy**: GitHub Actions vs alternatives (chose GitHub Actions for integration)
- **Quality Gates**: Required tests vs optional (chose required for core packages)

## References

- Implementation: `/docs/unified-dependency-strategy.md`
- Developer Guide: `/docs/unified-dependency-developer-guide.md`
- Troubleshooting: `/docs/unified-dependency-troubleshooting.md`
- Operations: `/docs/package-operations-guide.md`
