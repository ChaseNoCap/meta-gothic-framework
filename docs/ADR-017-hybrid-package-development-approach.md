# ADR-004: Hybrid Package Development Approach for metaGOTHIC

## Status
Accepted

## Context
When beginning development of the metaGOTHIC framework packages, we needed to choose between:
1. **Pure Standard Pattern**: Start with existing package template exactly
2. **Pure Greenfield**: Build from scratch with all custom requirements
3. **Hybrid Approach**: Start with standard pattern, add enhancements incrementally

The metaGOTHIC packages have unique requirements (GraphQL integration, streaming, AI-specific features) but should maintain consistency with the existing H1B package ecosystem.

## Decision
We adopt a **Hybrid Package Development Approach** for all metaGOTHIC packages:

1. **Foundation Phase**: Start with established ecosystem patterns
   - Use existing package structure (logger/di-framework as template)
   - Follow TypeScript, ESLint, testing, and build configurations
   - Maintain dependency injection and error handling patterns
   - Use established tier metadata and publishing workflows

2. **Enhancement Phase**: Add domain-specific features incrementally
   - Layer on unique requirements (GraphQL, streaming, AI features)
   - Extend base interfaces without breaking compatibility
   - Add specialized utilities and configuration
   - Maintain package size and single responsibility guidelines

## Rationale

### Benefits Observed from claude-client Implementation
- **Speed**: Completed in 1 day vs estimated 5-6 days
- **Quality**: 19 passing tests, clean TypeScript compilation
- **Consistency**: Follows all ecosystem patterns automatically
- **Maintainability**: Familiar structure for developers
- **Integration**: Works seamlessly with existing DI container

### Technical Advantages
- **Risk Reduction**: Known patterns reduce implementation risk
- **Quality Assurance**: Inherit proven build/test/lint configurations
- **Developer Experience**: Consistent structure across all packages
- **Documentation**: Standard documentation patterns with domain additions

### Process Benefits
- **Incremental Development**: Can validate foundation before adding complexity
- **Easier Reviews**: Reviewers understand standard patterns
- **Faster Onboarding**: New developers recognize familiar structures
- **Evolution**: Can enhance features without breaking foundations

## Implementation Guidelines

### Phase 1: Foundation (Required for All Packages)
```bash
# Standard package structure
package.json          # Following ecosystem dependencies and scripts
tsconfig.json         # Standard TypeScript configuration
eslint.config.js      # ESLint v9 flat config
vitest.config.ts      # Standard test configuration
src/
  interfaces/         # TypeScript interfaces
  implementations/    # Main implementations
  types/             # Type definitions
  utils/             # Utilities and tokens
  index.ts           # Public exports
tests/
  unit/              # Unit tests
  integration/       # Integration tests (if needed)
README.md            # Usage documentation
CLAUDE.md            # Development guidance
```

### Phase 2: Domain Enhancement (Package-Specific)
- **Add unique interfaces**: Extend base patterns for domain needs
- **Implement specialized features**: Build on foundation without breaking it
- **Enhance configurations**: Add domain-specific config while maintaining defaults
- **Extend testing**: Add domain-specific tests while maintaining core coverage

### Phase 3: Integration (Ecosystem-Wide)
- **DI Integration**: Ensure seamless container integration
- **Publishing**: Follow established automated publishing patterns
- **Documentation**: Enhance docs while maintaining standard sections

## Examples

### claude-client Success Pattern
- Started with logger package structure
- Added Claude-specific interfaces (IClaudeClient, IClaudeSession)
- Enhanced with streaming utilities (ClaudeStreamProcessor)
- Maintained DI patterns and error handling
- Result: Full-featured package in 1 day

### Next Package Applications
- **prompt-toolkit**: Start with standard structure + XML processing
- **sdlc-engine**: Start with standard structure + state machine
- **graphql-toolkit**: Start with standard structure + GraphQL utilities

## Consequences

### Positive
- **Proven Speed**: 5x faster development (1 day vs 5 days)
- **Quality Consistency**: Automatic inheritance of quality patterns
- **Lower Risk**: Known patterns reduce chances of architectural mistakes
- **Easier Maintenance**: Familiar structure for all team members
- **Better Integration**: Seamless ecosystem compatibility

### Negative
- **Initial Overhead**: Must understand existing patterns first
- **Some Constraints**: Domain features must work within established patterns
- **Documentation Effort**: Must document both standard and custom features

### Mitigation
- **Pattern Documentation**: Maintain clear guides for hybrid development
- **Template Updates**: Evolve templates based on learnings from implementations
- **Escape Hatches**: Allow breaking patterns when absolutely necessary

## Review Schedule
- Review after completing 3 metaGOTHIC packages (33% milestone)
- Assess speed, quality, and maintainability metrics
- Update approach based on findings

## Related ADRs
- ADR-001: Unified Dependency Strategy
- ADR-002: Git Submodules Architecture  
- ADR-003: Automated Publishing Infrastructure

## Implementation Date
May 27, 2025

## Success Metrics
- **Development Speed**: Target 1-2 days per package (vs original 5-6 day estimate)
- **Quality**: 90%+ test coverage, clean builds
- **Consistency**: All packages follow established patterns
- **Integration**: Seamless DI and ecosystem integration