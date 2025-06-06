# Service Naming Strategy for Meta-Gothic Framework

## Overview

This document establishes a consistent naming strategy for all services in the Meta-Gothic framework to improve clarity, maintainability, and understanding of the architecture.

## Current State Analysis

### Existing Services
1. **claude-service** - AI operations with Claude
2. **repo-agent-service** - Git repository operations
3. **github-mesh** - GitHub API wrapper (being renamed)
4. **meta-gothic-app** - Federation gateway

### Inconsistencies
- Mixed patterns: `-service` suffix vs `-mesh` vs `-app`
- Unclear hierarchy (which is the gateway?)
- Technology leaking into names (mesh)

## Proposed Naming Strategy

### Option 1: Function-Based Names (Recommended)

**Pattern**: `[domain]-service` for all services, `[framework]-gateway` for gateway

```
Services:
- ai-service         (formerly claude-service)
- git-service        (formerly repo-agent-service)  
- github-service     (formerly github-mesh)

Gateway:
- gothic-gateway     (formerly meta-gothic-app)
```

**Pros**:
- Clear function-based naming
- Technology agnostic
- Consistent `-service` suffix
- Gateway clearly identified

**Cons**:
- "ai-service" less specific than "claude"
- Requires more extensive renaming

### Option 2: Current Pattern with Consistency

**Pattern**: Keep current names but standardize suffixes

```
Services:
- claude-service     (no change)
- repo-agent-service (no change)
- github-adapter     (formerly github-mesh)

Gateway:
- gothic-gateway     (formerly meta-gothic-app)
```

**Pros**:
- Minimal changes required
- Preserves specific tool names (Claude)
- Gateway clearly identified

**Cons**:
- "repo-agent" still unclear
- Mixed naming patterns remain

### Option 3: Role-Based Names

**Pattern**: `[role]-[domain]` for clarity

```
Services:
- ai-operations      (formerly claude-service)
- git-operations     (formerly repo-agent-service)
- github-adapter     (formerly github-mesh)

Gateway:
- api-gateway        (formerly meta-gothic-app)
```

**Pros**:
- Very clear roles
- No ambiguity about function
- Clean, professional names

**Cons**:
- Loses specific tool identity
- More generic feeling

## Recommended Approach: Option 2 Enhanced

Based on analysis, I recommend **Option 2 with enhancements**:

### Final Service Names

```yaml
# Core Services
claude-service:      # AI operations with Claude
  package: "@meta-gothic/claude-service"
  port: 3002
  description: "AI-powered development assistance"

repository-service:  # Git operations (renamed from repo-agent)
  package: "@meta-gothic/repository-service"  
  port: 3004
  description: "Git repository management and operations"

github-adapter:      # GitHub API adapter (renamed from github-mesh)
  package: "@meta-gothic/github-adapter"
  port: 3005
  description: "GitHub API integration adapter"

# Gateway
gothic-gateway:      # Federation gateway (renamed from meta-gothic-app)
  package: "@meta-gothic/gateway"
  port: 3000
  description: "GraphQL federation gateway"
```

### Rationale

1. **claude-service**: Keep as-is
   - Specific tool identity is valuable
   - Well-established in codebase
   - Clear purpose

2. **repository-service**: Rename from `repo-agent-service`
   - "repository" clearer than "repo-agent"
   - Removes redundant "agent" term
   - Aligns with function

3. **github-adapter**: Rename from `github-mesh`
   - Removes technology from name
   - "adapter" pattern is clear
   - Future-proof for gRPC migration

4. **gothic-gateway**: Rename from `meta-gothic-app`
   - Clearly identifies as gateway
   - Shorter, cleaner name
   - Removes ambiguous "app" suffix

## Implementation Plan

### Phase 1: Documentation Update
1. Update all documentation with new names
2. Create migration guide
3. Update architecture diagrams

### Phase 2: GitHub Adapter Rename (Immediate)
1. Rename `github-mesh` → `github-adapter`
2. Update all references
3. Test federation

### Phase 3: Gateway Rename (Next Sprint)
1. Rename `meta-gothic-app` → `gothic-gateway`
2. Update all configuration
3. Update client connections

### Phase 4: Repository Service Rename (Future)
1. Rename `repo-agent-service` → `repository-service`
2. Update all references
3. Maintain backward compatibility

## Naming Conventions

### Package Names
- Pattern: `@meta-gothic/[service-name]`
- Examples: `@meta-gothic/claude-service`, `@meta-gothic/gateway`

### Directory Structure
```
services/
├── claude-service/
├── repository-service/
├── github-adapter/
└── gothic-gateway/
```

### Process Names (PM2)
- Use same as directory name
- Examples: `claude-service`, `gothic-gateway`

### Log Files
- Pattern: `[service-name]-[type].log`
- Examples: `claude-service-error.log`, `gateway-access.log`

### Environment Variables
- Pattern: `[SERVICE]_[VARIABLE]`
- Examples: `CLAUDE_SERVICE_PORT`, `GATEWAY_CORS_ORIGIN`

### GraphQL Schema Names
- Subgraph names match service names
- Examples: `claude`, `repository`, `github`

## Benefits

1. **Clarity**: Each service's purpose is immediately clear
2. **Consistency**: Unified naming pattern across all services
3. **Scalability**: Easy to add new services following pattern
4. **Discoverability**: Developers can easily find services
5. **Future-proof**: Names don't include implementation details

## Migration Timeline

1. **Immediate**: 
   - Rename `github-mesh` → `github-adapter`
   - Update documentation

2. **Next Sprint**:
   - Rename `meta-gothic-app` → `gothic-gateway`
   - Update all client configurations

3. **Future**:
   - Consider renaming `repo-agent-service` → `repository-service`
   - Evaluate need for further standardization

## Conclusion

This naming strategy provides:
- Clear service identification
- Consistent patterns
- Technology-agnostic names
- Easy understanding of architecture

The phased approach allows gradual migration without disrupting operations.