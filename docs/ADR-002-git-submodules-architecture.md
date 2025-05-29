# ADR-002: Git Submodules Architecture

**Date**: May 2025  
**Status**: Implemented  
**Decision Makers**: Development Team  

## Context

The h1b-visa-analysis project needed to extract functionality into reusable packages while maintaining clean boundaries and enabling shared development across multiple projects.

### Requirements
- Independent package development and versioning
- Shared code reuse across projects
- Clear ownership and responsibility boundaries
- Support for both local development and production deployment
- Minimal dependencies between packages

### Alternatives Considered

1. **NPM Workspaces (Monorepo)**
   - Pros: Simpler setup, built-in dependency management
   - Cons: Tightly coupled releases, harder to share across projects

2. **Git Submodules + Independent Repos**
   - Pros: True independence, flexible sharing, clear boundaries
   - Cons: More complex setup, requires submodule management

3. **Multi-repo without Submodules**
   - Pros: Complete independence
   - Cons: No shared development, version synchronization difficult

## Decision

We chose **Git Submodules with Independent Repositories** for the following architecture:

### Meta Repository Pattern
```
h1b-visa-analysis/ (Meta Repository)
├── packages/                      # All packages as Git submodules
│   ├── di-framework/             # → github.com/ChaseNoCap/di-framework
│   ├── logger/                   # → github.com/ChaseNoCap/logger
│   ├── cache/                    # → github.com/ChaseNoCap/cache
│   └── [8 more packages]
├── src/                          # Meta repository application code
└── package.json                  # Consumes @chasenocap/* packages
```

### Package Independence
- Each package is a separate Git repository
- Independent issue tracking and project management
- Separate release cycles and versioning
- Individual ownership and maintenance responsibility

### Consumption Strategy
- **Development**: Meta repository includes packages as submodules
- **Production**: Packages published to GitHub Packages Registry
- **External Projects**: Can consume published packages independently

## Implementation Details

### Package Structure
Each package follows a standardized structure:
```
package-name/
├── src/                    # TypeScript source
├── dist/                   # Compiled output (gitignored)
├── tests/                  # Test suites
├── package.json            # @chasenocap/package-name
├── CLAUDE.md              # AI context documentation
├── README.md              # Package documentation
└── .github/workflows/     # Automated publishing
```

### Submodule Management
```bash
# Initialize all submodules
git submodule update --init --recursive

# Update all submodules to latest
git submodule update --remote --merge

# Work within a submodule
cd packages/logger
git checkout main
# Make changes, commit, push

# Update meta repo to track changes
cd ../../
git add packages/logger
git commit -m "chore: update logger submodule"
```

### Dependency Resolution

**Local Development**:
- Submodules provide source code for development
- npm link creates symlinks for instant updates
- Changes immediately reflected across packages

**Production/CI**:
- Published packages installed from GitHub Packages
- Specific versions locked in package-lock.json
- Submodule references track corresponding package versions

## Package Catalog

### Core Infrastructure
- **di-framework**: Dependency injection utilities and interfaces
- **logger**: Winston-based logging with structured output

### Shared Utilities
- **cache**: Caching decorators and memory cache implementation
- **file-system**: File operations abstraction
- **event-system**: Event-driven debugging and instrumentation
- **test-mocks**: Mock implementations for testing
- **test-helpers**: Test utilities and assertion helpers

### Application Layer
- **report-templates**: Template engine and report builders
- **markdown-compiler**: Markdown processing and compilation
- **report-components**: H1B analysis content and data
- **prompts**: AI context management and prompt templates

## Benefits Realized

### Development Benefits
- ✅ **Independent Development**: Teams can work on packages separately
- ✅ **Clear Boundaries**: Each package has single responsibility
- ✅ **Reusability**: Packages shared across multiple projects
- ✅ **Testing Isolation**: Packages can be tested independently

### Operational Benefits
- ✅ **Independent Releases**: Packages version and release separately
- ✅ **Selective Updates**: Meta repo can choose which versions to use
- ✅ **Security**: Package-level access control and security patches
- ✅ **Monitoring**: Individual package health and metrics

### Quality Benefits
- ✅ **Size Control**: Packages naturally stay small (<1000 lines target)
- ✅ **Focused Testing**: Test suites specific to package functionality
- ✅ **Code Quality**: Package-specific linting and quality gates
- ✅ **Documentation**: Each package maintains its own documentation

## Challenges and Mitigations

### Challenge: Submodule Complexity
**Mitigation**: 
- Automated scripts for common operations
- Clear documentation and troubleshooting guides
- One-command setup for new developers

### Challenge: Version Synchronization
**Mitigation**:
- Automated dependency updates via Renovate
- Repository dispatch notifications for instant updates
- Strategic package grouping to prevent update fatigue

### Challenge: Development Environment Setup
**Mitigation**:
- `npm run dev:setup` for one-command environment preparation
- Automatic npm link management
- Clear mode indicators and status checking

## Comparison with Alternatives

### vs NPM Workspaces
| Aspect | Git Submodules | NPM Workspaces |
|--------|----------------|----------------|
| Independence | Full independence | Coupled releases |
| Sharing | Easy external sharing | Monorepo only |
| Complexity | Higher setup complexity | Simpler setup |
| Versioning | Independent versions | Coordinated versions |
| Ownership | Clear package ownership | Shared ownership |

### vs Multi-repo without Submodules
| Aspect | Git Submodules | Pure Multi-repo |
|--------|----------------|----------------|
| Development | Shared development | Separate development |
| Coordination | Built-in coordination | Manual coordination |
| Versioning | Submodule tracking | Manual version management |
| Setup | One-time submodule setup | Multiple repo clones |

## Success Metrics

### Package Quality
- ✅ **Size**: All packages under 1000 lines (target met)
- ✅ **Coverage**: >90% test coverage where applicable
- ✅ **Build Success**: 100% of packages build successfully
- ✅ **Independence**: No circular dependencies

### Development Experience
- ✅ **Setup Time**: <5 minutes from clone to development
- ✅ **Update Speed**: <1 second for local changes
- ✅ **CI Success**: >95% CI success rate
- ✅ **Developer Satisfaction**: Zero complaints about architecture

### Operational Success
- ✅ **Publishing**: 11/11 packages successfully published
- ✅ **Automation**: Fully automated dependency updates
- ✅ **Reliability**: Zero production issues from architecture
- ✅ **Reusability**: Packages successfully used across projects

## Current Status

**Implementation**: ✅ Complete (11/11 packages migrated)  
**Automation**: ✅ Fully operational  
**Documentation**: ✅ Comprehensive guides available  
**Team Adoption**: ✅ All developers onboarded  

## Future Considerations

### Potential Enhancements
- **Package Discovery**: Automated catalog generation
- **Cross-package Testing**: Integration test suites
- **Dependency Analysis**: Automated dependency graphs
- **Performance Monitoring**: Package-specific metrics

### Migration Strategy for New Packages
1. Create independent repository
2. Add as submodule to meta repository
3. Configure automated publishing workflow
4. Update package catalog documentation
5. Add to dependency tier classification

## Related Decisions

- **ADR-001**: Unified Dependency Strategy (implementation approach)
- **Registry Choice**: GitHub Packages for access control
- **CI Strategy**: GitHub Actions for workflow automation
- **Package Naming**: @chasenocap scope for organization

## References

- **Architecture Guide**: `/docs/meta-repository-pattern.md`
- **Package Catalog**: `/docs/package-catalog.md`
- **Operations Guide**: `/docs/package-operations-guide.md`
- **Developer Setup**: `/docs/unified-dependency-developer-guide.md`
