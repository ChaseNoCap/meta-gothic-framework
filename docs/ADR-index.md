# Architecture Decision Records (ADR) Index

This index provides an overview of all architectural decisions for the metaGOTHIC framework. ADRs have been consolidated by topic area for easier navigation.

## Status Legend
- **✅ Implemented**: Decision implemented and proven in production
- **📋 Proposed**: Decision documented but not yet implemented
- **🚧 Partial**: Some aspects implemented, others pending

## Consolidated ADRs

### [ADR-Infrastructure](./ADR-Infrastructure.md) ✅
**Package Management and CI/CD**  
Covers Git submodules architecture, automated publishing, NPM authentication, and the meta repository pattern. Fully implemented with 8 packages in production.

**Key Decisions**:
- Git submodules for package independence
- Automated CI/CD with GitHub Actions
- Tag-based publishing to GitHub Packages
- Unified NPM_TOKEN authentication

### [ADR-GraphQL](./ADR-GraphQL.md) ✅
**API Architecture and Implementation**  
Documents GraphQL-first architecture, technology stack (Fastify + Yoga + Mesh), federation approach, and GitHub API integration. Fully migrated from Mercurius with excellent performance.

**Key Decisions**:
- GraphQL as primary API paradigm
- GraphQL Yoga for all services
- GraphQL Mesh for federation
- Direct REST wrapping for GitHub API

### [ADR-Architecture-Patterns](./ADR-Architecture-Patterns.md) 🚧
**Core Framework Patterns**  
Defines GOTHIC pattern, event-driven architecture, and multi-layer caching strategy. Conceptually defined with partial implementation.

**Key Decisions**:
- GOTHIC (GitHub Orchestrated Tooling for Hierarchical Intelligent Containers)
- Redis Pub/Sub for events (planned)
- Three-layer caching architecture
- Event-driven service communication

### [ADR-AI-Development](./ADR-AI-Development.md) 📋
**AI Integration and SDLC Patterns**  
Progressive context loading for token optimization and SDLC state machine for workflow management. Proposed patterns for future AI enhancement.

**Key Decisions**:
- Hierarchical context loading (1-4 levels)
- Token budget optimization
- SDLC phase state machine
- AI-assisted development workflows

### [ADR-Monitoring](./ADR-Monitoring.md) ✅
**CI/CD Dashboard and Metrics Collection**  
Systematic metrics collection across all repositories with centralized dashboard visualization. Fully operational.

**Key Decisions**:
- Metrics collection during CI/CD
- JSON-based data persistence
- Real-time dashboard updates
- Historical trend tracking

### [ADR-Future-Patterns](./ADR-Future-Patterns.md) 📋
**Reserved Patterns for Future Use**  
Documents patterns considered but not implemented, like OpenAPI transformation. Reserved for future integrations.

**Currently Contains**:
- OpenAPI to GraphQL transformation pattern
- Placeholder for future architectural patterns

## Quick Decision Reference

### Package Management
- **Independence**: Each package in separate repo → [Infrastructure](./ADR-Infrastructure.md)
- **Versioning**: Tag-based publishing → [Infrastructure](./ADR-Infrastructure.md)
- **Dependencies**: Automated updates → [Infrastructure](./ADR-Infrastructure.md)

### API Architecture  
- **Primary API**: GraphQL over REST → [GraphQL](./ADR-GraphQL.md)
- **Framework**: Fastify + Yoga → [GraphQL](./ADR-GraphQL.md)
- **External APIs**: Direct wrapping → [GraphQL](./ADR-GraphQL.md)

### Development Patterns
- **Architecture**: GOTHIC pattern → [Architecture Patterns](./ADR-Architecture-Patterns.md)
- **Communication**: Event-driven → [Architecture Patterns](./ADR-Architecture-Patterns.md)
- **AI Integration**: Progressive loading → [AI Development](./ADR-AI-Development.md)

### Operations
- **Monitoring**: CI/CD dashboard → [Monitoring](./ADR-Monitoring.md)
- **Caching**: Multi-layer strategy → [Architecture Patterns](./ADR-Architecture-Patterns.md)
- **Authentication**: NPM_TOKEN → [Infrastructure](./ADR-Infrastructure.md)

## Implementation Status Summary

### Fully Implemented ✅
- Git submodules package management
- Automated CI/CD pipelines
- GraphQL Yoga migration
- GraphQL federation with Mesh
- GitHub API integration
- CI/CD metrics dashboard

### Partially Implemented 🚧
- Event-driven architecture (GraphQL subscriptions working)
- Caching strategy (basic response caching)
- GOTHIC pattern (conceptual framework)

### Proposed/Future 📋
- Progressive context loading
- SDLC state machine
- Redis event bus
- Advanced caching layers
- OpenAPI transformation (for non-GitHub APIs)

## Navigation

- [View Implementation Backlog](./backlog.md)
- [Troubleshooting Guide](./troubleshooting/)
- [Migration Guides](./migration/)