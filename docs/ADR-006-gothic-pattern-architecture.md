# ADR-006: GOTHIC Pattern Architecture

**Date**: 2025-01-27  
**Status**: Proposed  
**Decision Makers**: metaGOTHIC Framework Team  

## Context

The metaGOTHIC framework requires a cohesive architectural pattern that integrates GitHub-native development practices with AI-guided assistance while maintaining professional software development lifecycle (SDLC) standards. The pattern must support both human developers and AI agents working collaboratively.

### Current State
- H1B Analysis project uses meta repository pattern with 11 packages
- Successful automation infrastructure with GitHub Actions
- No existing AI-guided development framework
- Manual SDLC phase transitions and context management

### Problem Statement
We need an architectural pattern that:
1. Leverages GitHub as the primary development platform
2. Orchestrates complex multi-service architectures
3. Provides intelligent tooling for developers
4. Maintains hierarchical organization of code and responsibilities
5. Integrates AI assistance naturally into the development workflow
6. Scales from small projects to enterprise repositories

### Requirements
- **Platform-native**: Deep GitHub integration (repos, actions, packages, APIs)
- **AI-first**: Natural integration with Claude and other AI assistants
- **Developer-friendly**: Familiar tools and patterns for developers
- **Scalable**: Works for both small and large projects
- **Observable**: Built-in monitoring and health metrics
- **Containerized**: Consistent environments across development and production

## Decision

Adopt the **GOTHIC** (GitHub Orchestrated Tooling for Hierarchical Intelligent Containers) pattern as the foundational architecture for metaGOTHIC.

### Chosen Solution

GOTHIC is a comprehensive architectural pattern that combines five key principles:

#### 1. **GitHub-Native Foundation**
- All code lives in GitHub repositories
- GitHub Actions drive CI/CD automation
- GitHub Packages host all artifacts
- GitHub APIs provide programmatic access
- GitHub webhooks enable real-time updates

#### 2. **Orchestrated Automation**
- SDLC state machine manages development phases
- GraphQL-first APIs enable complex queries
- Event-driven architecture for loose coupling
- Smart dependency management (npm link vs publish)
- Progressive context loading for AI efficiency

#### 3. **Tooling Excellence**
- Terminal UI for immersive development experience
- Intelligent file tree for context selection
- Kanban boards for AI-assisted planning
- Real-time monitoring dashboards
- Integrated debugging and profiling

#### 4. **Hierarchical Organization**
- Meta repository pattern for package management
- Layered GraphQL schemas (raw → business → AI-enhanced)
- Tiered package structure (core → shared → app)
- SDLC phase hierarchy (requirements → deployment)
- Context hierarchy (system → package → feature)

#### 5. **Intelligent Integration**
- Claude subprocess with session management
- XML prompt templates for structured guidance
- Token-optimized context aggregation
- GraphQL subscriptions for real-time AI responses
- Knowledge base for best practices

### Implementation Approach

```yaml
# GOTHIC Architecture Layers

## Platform Layer (GitHub)
- Repository Structure:
  - Meta repository (orchestrator)
  - Package repositories (Git submodules)
  - Service repositories (3 core services)

## Infrastructure Layer
- GraphQL Gateway (Apollo Federation)
- Message Bus (Redis Pub/Sub)
- Cache Layer (Redis + DataLoader)
- Container Orchestration (Docker Compose)

## Service Layer
- meta-gothic-app (Port 3000)
  - React UI with Apollo Client
  - GraphQL Gateway
  - WebSocket subscriptions
  
- repo-agent-service (Port 3001)
  - GitHub API operations
  - Smart GraphQL/REST routing
  - Webhook processing
  
- claude-service (Port 3002)
  - AI subprocess management
  - Streaming responses
  - Context optimization

## Package Layer (NPM)
- Core Packages:
  - @chasenocap/graphql-toolkit
  - @chasenocap/github-graphql-client
  - @chasenocap/claude-client
  
- SDLC Packages:
  - @chasenocap/sdlc-engine
  - @chasenocap/sdlc-config
  - @chasenocap/sdlc-content
  
- UI/UX Packages:
  - @chasenocap/ui-components
  - @chasenocap/prompt-toolkit
  - @chasenocap/context-aggregator

## Intelligence Layer
- Prompt Templates (XML)
- Context Strategies
- SDLC Guidance
- Best Practices KB
```

## Alternatives Considered

### Option 1: Microservices with REST APIs
- **Pros**: Simple, well-understood, good tooling
- **Cons**: Chatty interfaces, no real-time updates, complex aggregations
- **Reason for rejection**: GraphQL provides better developer experience for complex queries

### Option 2: Monolithic Application
- **Pros**: Simple deployment, no network overhead, easier debugging
- **Cons**: Poor scalability, tight coupling, difficult to maintain
- **Reason for rejection**: Violates separation of concerns and limits AI integration points

### Option 3: Event Sourcing Architecture
- **Pros**: Complete audit trail, time-travel debugging, eventual consistency
- **Cons**: Complex implementation, steep learning curve, operational overhead
- **Reason for rejection**: Unnecessary complexity for current requirements

## Consequences

### Positive
- ✅ **Platform Integration**: Deep GitHub integration leverages existing ecosystem
- ✅ **AI-Ready**: Natural integration points for AI assistants
- ✅ **Developer Experience**: Familiar tools with enhanced capabilities
- ✅ **Scalability**: Hierarchical structure supports growth
- ✅ **Observability**: Built-in monitoring and health metrics
- ✅ **Flexibility**: GraphQL allows evolution without breaking changes

### Negative
- ⚠️ **Learning Curve**: Developers need to understand GraphQL and GOTHIC principles
- ⚠️ **Initial Complexity**: More setup compared to simple architectures
- ⚠️ **GitHub Dependency**: Tightly coupled to GitHub platform

### Risks & Mitigations
- **Risk**: GitHub API rate limits impact functionality
  - **Mitigation**: Multi-layer caching, smart query routing, token rotation
  
- **Risk**: GraphQL complexity leads to performance issues
  - **Mitigation**: Query depth limiting, cost analysis, DataLoader batching
  
- **Risk**: AI context windows exceed limits
  - **Mitigation**: Progressive loading, token optimization, context aggregation

## Validation

### Success Criteria
- [ ] All 3 services communicate via GraphQL
- [ ] Real-time updates work via subscriptions
- [ ] AI assistant can navigate full SDLC
- [ ] Dashboard shows real metrics (not N/A)
- [ ] Developers report improved productivity

### Testing Approach
- Integration tests across all services
- Load testing for GraphQL endpoints
- AI interaction testing with various contexts
- End-to-end SDLC workflow validation

## References

- [Meta Repository Pattern](./meta-repository-pattern.md)
- [GraphQL-First Architecture](./ADR-005-graphql-first-architecture.md)
- [Git Submodules Architecture](./ADR-002-git-submodules-architecture.md)
- [metaGOTHIC Backlog](./backlog.md#metaGOTHIC-implementation-roadmap)

## Changelog

- **2025-01-27**: Initial draft defining GOTHIC pattern