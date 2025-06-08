# Meta GOTHIC Framework Backlog

This document tracks current and future work items for the Meta GOTHIC Framework. When asking "what's next?", consult this backlog for prioritized work items.

## Current Status

**As of June 7, 2025:**
- ✅ **Cosmo Router Migration**: Successfully migrated from Apollo to Cosmo
- ✅ **Federation v2**: All services using Federation v2 protocol
- ✅ **GitHub Integration**: Real GitHub data flowing through federation
- ✅ **Git Service**: Fixed workspace root issue, now detecting uncommitted changes
- ✅ **Archive Cleanup**: Removed all _archive folders and outdated documentation
- ✅ **TypeScript Migration**: All JavaScript files converted to TypeScript
- ✅ **Service Modernization**: Claude and Git services now use Cosmo federation
- 🔧 **Current Architecture**: Clean Cosmo-based federation, fully TypeScript

## Architecture Overview

```
UI Dashboard (http://localhost:3001)
    ↓
Cosmo Router (http://localhost:4000/graphql)
├── Claude Service (http://localhost:3002/graphql) - AI agent operations
├── Git Service (http://localhost:3003/graphql) - Git operations
└── GitHub Adapter (http://localhost:3005/graphql) - GitHub API integration

All managed by PM2 with `npm start`
```

## ✅ COMPLETED: Service Modernization

### Completed Tasks
- ✅ **Claude Service**: Converted to Cosmo federation, removed Apollo dependencies
- ✅ **Git Service**: Converted to Cosmo federation, removed Apollo dependencies  
- ✅ **Gothic Gateway**: Removed all TypeScript source files (using Cosmo Router binary)
- ✅ **TypeScript Migration**: All JavaScript files converted to TypeScript

## 🚨 TOP PRIORITY: Federation Field Naming Pattern Implementation

### Goal
**Fix gateway field routing by implementing proper federation field naming patterns**

### Why This Is Critical
- Gateway cannot route queries due to field name mismatches
- UI health checks are failing
- Blocking all GraphQL-dependent functionality
- Sets the pattern for all future federation work

### Tasks
- [x] Clean service schemas to use generic field names
- [x] Generate new gateway configuration with proper composition
- [x] Update UI to query the composed schema correctly
- [x] Document the pattern for future services

**✅ COMPLETED**: Successfully implemented shared `ServiceHealthStatus` type across all services. The wgc tool now properly composes the federated schema!

**See detailed implementation plan**: [federation-field-naming-implementation.md](./federation-field-naming-implementation.md)

## 🔧 SECOND PRIORITY: SSE Implementation for Real-time Subscriptions

### Goal
**Implement Server-Sent Events (SSE) support for real-time subscriptions in the Cosmo Router setup**

### Why This Matters
- Current federation works but lacks real-time subscription support
- SSE provides better compatibility than WebSockets for our use case
- Essential for Claude session output streaming and file watching

### Tasks

**Task 1: Implement SSE in Claude Service**
- [ ] Add SSE endpoint at `/graphql/stream`
- [ ] Convert subscriptions to use SSE transport
- [ ] Implement heartbeat mechanism (30s intervals)
- [ ] Test with command output streaming

**Task 2: Implement SSE in Git Service**
- [ ] Add SSE endpoint for file watching
- [ ] Stream git status changes
- [ ] Support command output streaming

**Task 3: Configure Cosmo Router for SSE**
- [ ] Update router configuration for SSE support
- [ ] Set up subscription routing
- [ ] Test federated subscriptions

**Task 4: Update UI Client**
- [ ] Add graphql-sse client
- [ ] Update Apollo Client configuration
- [ ] Test all subscription features

## 🧹 Technical Debt Cleanup

### High Priority Tech Debt

**Task 1: Consolidate Router Binaries**
- [ ] Determine which router binary to keep (root vs gateway)
- [ ] Remove duplicate router binary
- [ ] Update all references

**Task 2: Fix GraphQL Version Conflicts**
- [ ] Ensure all services use same GraphQL version
- [ ] Consider using workspace-level resolution
- [ ] Test federation after alignment

**Task 3: Complete TypeScript Strict Mode**
- [ ] Fix remaining strict mode errors in UI components
- [ ] Enable strict mode across all packages
- [ ] Update shared types as needed

### Medium Priority Tech Debt

**Task 1: Environment Variable Standardization**
- [ ] Use consistent naming (GITHUB_TOKEN everywhere)
- [ ] Document all required environment variables
- [ ] Create .env.example file

**Task 2: Improve Error Handling**
- [ ] Implement consistent error format across services
- [ ] Add proper error logging
- [ ] Improve user-facing error messages

**Task 3: Add Integration Tests**
- [ ] Test federation queries end-to-end
- [ ] Test mutation operations
- [ ] Add performance benchmarks

## 📊 Observability & Monitoring

### Goal
**Build comprehensive observability into the platform**

### Tasks

**Task 1: Structured Logging**
- [ ] Implement correlation IDs across all services
- [ ] Add request/response logging
- [ ] Create log aggregation views
- [ ] Set up log rotation

**Task 2: Performance Monitoring**
- [ ] Add timing metrics to all resolvers
- [ ] Track slow queries
- [ ] Monitor memory usage
- [ ] Create performance dashboard

**Task 3: Health Monitoring**
- [ ] Add detailed health checks to all services
- [ ] Create uptime monitoring
- [ ] Set up alerts for failures
- [ ] Build health dashboard

## 🚀 Feature Enhancements

### AI Operation Improvements

**Task 1: Enhanced Claude Integration**
- [ ] Add context window management
- [ ] Implement conversation memory
- [ ] Add cost tracking
- [ ] Support for different Claude models

**Task 2: Batch Operations**
- [ ] Batch commit message generation
- [ ] Parallel repository scanning
- [ ] Bulk git operations
- [ ] Progress tracking for long operations

### Developer Experience

**Task 1: CLI Tool**
- [ ] Create CLI for common operations
- [ ] Support for remote gateway connection
- [ ] Offline mode capability
- [ ] Shell completions

**Task 2: VS Code Extension**
- [ ] Direct integration with services
- [ ] Inline commit message generation
- [ ] Repository status in sidebar
- [ ] Quick actions palette

## 📅 Sprint Planning

### ✅ Completed Sprint: Service Modernization
- ✅ Cosmo migration for all services
- ✅ Removed all Apollo dependencies
- ✅ Converted all JavaScript to TypeScript
- ✅ Cleaned up legacy code

### Current Sprint: SSE Implementation (Starting Now)

### Sprint 2: SSE Implementation (1 week)
- Implement SSE in all services
- Configure router for subscriptions
- Update client for real-time features
- Test streaming operations

### Sprint 3: Observability (1 week)
- Add structured logging
- Implement performance monitoring
- Create monitoring dashboards
- Set up alerting

### Sprint 4: Developer Experience (1 week)
- Build CLI tool
- Start VS Code extension
- Improve documentation
- Add more examples

## 🎯 Success Metrics

### Technical Health
- [x] Zero Apollo dependencies
- [ ] 100% TypeScript strict mode compliance
- [x] All services using Federation v2
- [ ] Consistent GraphQL schema versions

### Performance
- [ ] GraphQL query response < 50ms
- [ ] Subscription latency < 100ms
- [ ] Memory usage stable under load
- [ ] No memory leaks in long-running sessions

### Developer Experience
- [ ] Clear, up-to-date documentation
- [ ] Comprehensive error messages
- [ ] Easy local development setup
- [ ] Consistent coding patterns

## 📝 Notes

- The migration to Cosmo has been successful but needs final cleanup
- Focus on removing technical debt before adding new features
- Maintain backwards compatibility during migrations
- Document all architectural decisions

## 🏁 Quick Start

```bash
# Start all services
npm start

# Start without monitoring UI
npm start -- --no-monitor

# Access points:
# - UI Dashboard: http://localhost:3001
# - Cosmo Router: http://localhost:4000/graphql
# - Claude Service: http://localhost:3002/graphql
# - Git Service: http://localhost:3003/graphql
# - GitHub Adapter: http://localhost:3005/graphql
```

## 🔗 Related Documentation

- [Cosmo Router Migration Guide](./cosmo-router-migration-guide.md)
- [Federation Setup Guide](./federation-setup-guide.md)
- [Local Development SSE Setup](./local-development-sse-setup.md)
- [Service Naming Strategy](./service-naming-strategy-revised.md)