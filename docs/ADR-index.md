# Architecture Decision Records (ADR) Index

This index provides a comprehensive overview of all architectural decisions made for the metaGOTHIC framework.

## ADR Status Legend
- **Accepted**: ✅ Decision implemented and proven
- **Proposed**: 📋 Decision documented but not yet implemented
- **Deprecated**: ⚠️ Decision no longer recommended
- **Superseded**: 🔄 Replaced by another ADR

## Core Infrastructure ADRs

### ADR-001: Unified Dependency Strategy ✅
**Status**: Accepted  
**Summary**: Defines the dependency update strategy using Git submodules and automated workflows  
**Key Decisions**:
- Git submodules for package management
- Automated dependency updates via repository_dispatch
- Tag-based publishing triggers

### ADR-002: Git Submodules Architecture ✅
**Status**: Accepted  
**Summary**: Documents the Git submodules approach for managing package repositories  
**Key Decisions**:
- Each package in independent repository
- Meta repository aggregates via submodules
- Dual development modes (npm link vs install)

### ADR-003: Automated Publishing Infrastructure ✅
**Status**: Accepted  
**Summary**: Establishes the automated package publishing pipeline  
**Key Decisions**:
- GitHub Actions for CI/CD
- GitHub Packages as registry
- Unified workflow template
- Real-time notifications

### ADR-004: CI/CD Dashboard Data Collection ✅
**Status**: Accepted  
**Summary**: Systematic approach to collect and persist CI/CD metrics across repositories  
**Key Decisions**:
- GitHub Actions for data collection
- JSON file persistence
- Real-time dashboard updates

### ADR-017: Hybrid Package Development Approach ✅
**Status**: Accepted  
**Summary**: Hybrid approach for metaGOTHIC package development  
**Key Decisions**:
- Start with established ecosystem patterns
- Add domain-specific features incrementally
- Maintain compatibility while extending functionality

## Framework Architecture ADRs

### ADR-005: GraphQL-First Architecture 📋
**Status**: Proposed  
**Summary**: Defines GraphQL as the primary API paradigm with strategic REST endpoints  
**Key Decisions**:
- GraphQL for service communication
- REST for webhooks and health checks
- Smart GitHub API routing
- Multi-layer caching strategy

### ADR-006: GOTHIC Pattern Architecture 📋
**Status**: Proposed  
**Summary**: Establishes GOTHIC (GitHub Orchestrated Tooling for Hierarchical Intelligent Containers) as the foundational pattern  
**Key Decisions**:
- GitHub-native development
- Hierarchical package organization
- AI-first design principles
- Container-based deployment

### ADR-007: Meta Repository Pattern ✅
**Status**: Accepted  
**Summary**: Documents the proven meta repository pattern for package management  
**Key Decisions**:
- Independent package repositories
- Git submodules for aggregation
- Flexible development workflows
- Automated synchronization

### ADR-008: Event-Driven Architecture 📋
**Status**: Proposed  
**Summary**: Defines event-driven communication between services  
**Key Decisions**:
- Redis Pub/Sub for real-time events
- Redis Streams for persistence
- GraphQL subscription bridge
- Event-based cache invalidation

### ADR-009: Multi-Layer Caching Strategy 📋
**Status**: Proposed  
**Summary**: Establishes three-layer caching architecture for performance  
**Key Decisions**:
- DataLoader for request-level
- LRU cache for application memory
- Redis for distributed cache
- Event-driven invalidation

### ADR-010: Progressive Context Loading 📋
**Status**: Proposed  
**Summary**: Defines intelligent context loading for AI interactions  
**Key Decisions**:
- Hierarchical context levels
- Token optimization strategies
- Query-based loading
- SDLC phase awareness

### ADR-011: SDLC State Machine 📋
**Status**: Proposed  
**Summary**: Implements formal SDLC phase management with validation  
**Key Decisions**:
- Configurable phase definitions
- Automated validation gates
- AI-integrated guidance
- Progress tracking metrics

### ADR-012: Fastify Over Express ✅
**Status**: Accepted  
**Summary**: Choose Fastify as web framework for superior performance and TypeScript support  
**Key Decisions**:
- 2.5x performance improvement over Express
- Native TypeScript support
- Rich plugin ecosystem
- Works well with GraphQL Yoga

### ADR-014: GraphQL Federation Architecture ✅
**Status**: Accepted (Updated for Yoga)  
**Summary**: Implement federated GraphQL across three services using GraphQL Yoga and Mesh  
**Key Decisions**:
- Service independence with unified API
- GraphQL Yoga for all services
- GraphQL Mesh for gateway
- Real-time subscription support

### ADR-016: Local NPM Authentication ✅
**Status**: Accepted  
**Summary**: Environment variable-based authentication for GitHub Packages access  
**Key Decisions**:
- NPM_TOKEN environment variable for all authentication
- .npmrc files use ${NPM_TOKEN} placeholder
- Same token approach for local development and CI/CD
- Personal Access Token with read:packages and write:packages scopes

### ADR-019: Migrate from Mercurius to GraphQL Yoga ✅
**Status**: Accepted  
**Summary**: Migrate all services from Mercurius to GraphQL Yoga for better ecosystem compatibility  
**Key Decisions**:
- GraphQL Yoga for all services
- Enable GraphQL Mesh integration
- Excellent performance (2.32ms avg)
- Full WebSocket support

### ADR-020: OpenAPI to GraphQL Transformation Pattern 📋
**Status**: Proposed (Future Use)  
**Summary**: Pattern for exposing REST APIs through GraphQL using OpenAPI specs  
**Key Decisions**:
- Use GraphQL Mesh's OpenAPI handler for REST→GraphQL transformation
- Recommended for APIs with good OpenAPI specs
- Not used for GitHub (see ADR-021)
- Reserved for future integrations

### ADR-021: Direct GitHub REST API Wrapping ✅
**Status**: Accepted  
**Summary**: Wrap GitHub REST API directly in GraphQL resolvers for simplicity  
**Key Decisions**:
- Direct fetch() calls in resolvers instead of complex OpenAPI
- Custom GraphQL types for GitHub entities
- Mutations for workflow triggering and cancellation
- Simpler implementation than OpenAPI approach

## Cross-Cutting Architectural Themes

### 1. **Package Independence**
- ADR-001, ADR-002, ADR-003, ADR-006 all emphasize independent packages
- Enables parallel development and clear ownership
- Proven successful in production

### 2. **Automation First**
- ADR-001, ADR-003 establish automation patterns
- ADR-007, ADR-008 extend to service communication
- Reduces manual overhead and errors

### 3. **AI Integration**
- ADR-006 (GOTHIC) establishes AI-first principles
- ADR-010 optimizes for AI token limits
- ADR-011 integrates AI guidance into SDLC

### 4. **Performance Optimization**
- ADR-005 uses GraphQL to reduce API calls
- ADR-009 implements sophisticated caching
- ADR-010 minimizes token usage

### 5. **Developer Experience**
- ADR-007 provides flexible development modes
- ADR-011 guides through SDLC phases
- All ADRs prioritize clear patterns

## Implementation Priority

### Phase 1: Foundation (Proven Patterns)
1. Continue using ADR-001, ADR-002, ADR-003, ADR-004, ADR-007
2. These patterns are proven and operational

### Phase 2: Core Infrastructure (GraphQL & Events)
1. Implement ADR-005 (GraphQL-First)
2. Implement ADR-008 (Event-Driven)
3. Create graphql-toolkit and github-graphql-client packages

### Phase 3: Performance & Intelligence
1. Implement ADR-009 (Caching)
2. Implement ADR-010 (Context Loading)
3. Optimize for scale and cost

### Phase 4: Developer Guidance
1. Implement ADR-011 (SDLC State Machine)
2. Integrate with AI assistants
3. Add metrics and reporting

## Decision Relationships

```
ADR-006 (GOTHIC Pattern)
    ├── ADR-005 (GraphQL-First)
    │   ├── ADR-012 (Fastify Framework)
    │   ├── ADR-019 (GraphQL Yoga)
    │   ├── ADR-014 (Federation Architecture)
    │   └── ADR-021 (GitHub REST Wrapping)
    ├── ADR-007 (Meta Repository)
    ├── ADR-008 (Event-Driven)
    ├── ADR-009 (Caching)
    ├── ADR-010 (Context Loading)
    └── ADR-011 (SDLC State Machine)

ADR-001 (Dependencies)
    ├── ADR-002 (Git Submodules)
    └── ADR-003 (Publishing)

Technology Stack Dependencies:
ADR-012 (Fastify) → ADR-019 (GraphQL Yoga) → ADR-014 (Federation with Mesh)
ADR-014 (Federation) + ADR-019 (Yoga) → Full GraphQL Mesh Capabilities
ADR-021 (Direct REST Wrapping) → GitHub API via GraphQL
ADR-020 (OpenAPI Pattern) → Future REST API integrations
```

## References

- [metaGOTHIC Backlog](./backlog.md)