# Meta GOTHIC Framework Backlog

This document tracks current and future work items for the Meta GOTHIC Framework. When asking "what's next?", consult this backlog for prioritized work items.

## Current Status

**As of June 8, 2025:**
- ✅ **Cosmo Router Migration**: Successfully migrated from Apollo to Cosmo
- ✅ **Federation v2**: All services using Federation v2 protocol
- ✅ **GitHub Integration**: Real GitHub data flowing through federation
- ✅ **Git Service**: Fixed workspace root issue, now detecting uncommitted changes
- ✅ **Archive Cleanup**: Removed all _archive folders and outdated documentation
- ✅ **TypeScript Migration**: All JavaScript files converted to TypeScript
- ✅ **Service Modernization**: Claude and Git services now use Cosmo federation
- ✅ **Logger Implementation**: Replaced all console.log with structured logging
- ✅ **Service Stability**: Fixed GitHub adapter crash, added health monitoring to Claude service
- ✅ **Pre-warm Sessions**: Implemented pre-warming for Claude sessions
- ✅ **Federation v2 Fixed**: Cosmo Router properly composing and routing all services
- 🔧 **Current Architecture**: Clean Cosmo-based federation, fully TypeScript

## Architecture Overview

```
UI Dashboard (http://localhost:3001)
    ↓
Cosmo Router (http://localhost:4000/graphql)
├── Claude Service (http://localhost:3002/graphql) - AI agent operations
├── Git Service (http://localhost:3004/graphql) - Git operations
└── GitHub Adapter (http://localhost:3005/graphql) - GitHub API integration

All managed by PM2 with `npm start`
```

## ✅ COMPLETED: Service Modernization

### Completed Tasks
- ✅ **Claude Service**: Converted to Cosmo federation, removed Apollo dependencies
- ✅ **Git Service**: Converted to Cosmo federation, removed Apollo dependencies  
- ✅ **Gothic Gateway**: Removed all TypeScript source files (using Cosmo Router binary)
- ✅ **TypeScript Migration**: All JavaScript files converted to TypeScript

## ✅ COMPLETED: Federation v2 Implementation

### Achievement
**Successfully implemented Federation v2 with Cosmo Router**

### What's Working
- ✅ Cosmo Router running and composing supergraph properly
- ✅ All services federated with shared types
- ✅ GraphQL queries routing correctly through the gateway
- ✅ Health checks working across all services
- ✅ Real-time subscriptions via SSE

### Implementation Details
- Using `wgc` tool for supergraph composition
- Services expose federated schemas at `/graphql`
- Router configuration properly handles all subgraphs
- Shared `ServiceHealthStatus` type working across services

**Documentation**: See [federation-setup-guide.md](./federation-setup-guide.md) for details

## 🚨 TOP PRIORITY: Claude Console Tab Management UI

### Goal
**Implement tabbed interface for Claude console with intelligent pre-warmed session management**

### Why This Is Critical
- Enables multiple concurrent Claude sessions without page navigation
- Improves developer workflow with context preservation via forking
- Leverages pre-warmed sessions for instant responsiveness
- Reduces friction when working with multiple tasks

### Epic: Multi-Session Tab Interface

**Task 1: Tab Container Component**
- [ ] Create SessionTabContainer component using existing Tabs components:
  - Use `<Tabs>`, `<TabsList>`, `<TabsTrigger>`, `<TabsContent>` from ui/tabs.tsx
  - Extend TabsList to support horizontal scrolling for overflow
- [ ] Modify TabsTrigger to include:
  - Session name/title
  - Status indicator (dot with color based on SessionStatus enum)
  - Close button using `<X className="h-3 w-3 ml-2" />` from lucide-react
- [ ] Add new tab button in TabsList:
  - Use `<Button variant="ghost" size="icon">` with `<Plus className="h-4 w-4" />`
  - Position at end of tab list
- [ ] Implement tab state management:
  - Track sessions in array with id, name, status, createdAt
  - Use React Context for tab state (similar to existing TabsContext pattern)
- [ ] Style modifications using Tailwind:
  - Adjust TabsList padding and height for better fit
  - Add max-width per tab with text truncation
  - Show scrollbar on overflow with 10 tab limit

**Task 2: Session Management Integration**
- [ ] Modify console to use session from active tab
- [ ] Update PreWarmSessionManager to maintain pool of sessions
- [ ] Implement session claiming logic for new tabs
- [ ] Add session status indicators on tabs (active/processing/idle)
- [ ] Handle session lifecycle per tab
- [ ] Configure working directory:
  - Set console CWD to meta-gothic-framework root (`/Users/josh/Documents/meta-gothic-framework`)
  - Detect project root dynamically using process.cwd() or config
  - Ensure this doesn't conflict with Change Review's repository-specific paths
  - Document that commit generation uses isolated sessions with repo-specific paths

**Task 3: Pre-warmed Session Flow**
- [ ] On initial load, claim pre-warmed session for default tab
- [ ] Immediately start warming another session
- [ ] Show pre-warm availability indicator
- [ ] On "+" click: claim pre-warmed if available, else create new
- [ ] Always maintain at least one pre-warmed session

**Task 4: Fork Session Feature**
- [ ] Add Fork button to console toolbar:
  - Use `<Button variant="outline" size="sm">` with `<GitBranch className="h-4 w-4 mr-2" />` icon
  - Position in existing console toolbar
- [ ] Implement context cloning:
  - Call new `forkSession` mutation with parent sessionId
  - Server-side: copy full context and history to new session
- [ ] Create new tab with forked session:
  - Add tab with name format: "Fork of [parent-name]"
  - Include small fork indicator icon in tab
- [ ] Auto-focus newly forked tab:
  - Use Tabs `onValueChange` to switch to new tab ID
- [ ] Visual indicators:
  - Small `<GitBranch className="h-3 w-3" />` icon in forked tabs
  - Tooltip showing parent session name

**Task 5: State Persistence**
- [ ] Save tab state to localStorage
- [ ] Restore tabs on page refresh
- [ ] Persist session IDs and basic metadata
- [ ] Handle stale sessions gracefully

**Task 6: UI/UX Polish**
- [ ] Tab naming:
  - Default: "Session {number}" or first meaningful command
  - Double-click tab to edit name inline
  - Use `<Input className="h-6 text-sm" />` for inline editing
- [ ] Drag to reorder (consider react-sortable-hoc if needed)
- [ ] Keyboard shortcuts using useEffect with keydown listeners:
  - Cmd/Ctrl+T: Create new tab
  - Cmd/Ctrl+W: Close current tab
  - Cmd/Ctrl+Tab: Cycle tabs
  - Cmd/Ctrl+1-9: Jump to tab by number
- [ ] Resource indicators in tabs:
  - Small token count using `<Badge variant="secondary" className="ml-1">`
  - Memory usage as tooltip
- [ ] Background activity indicators:
  - Pulsing dot for active processing
  - Use Tailwind animation classes: `animate-pulse`
  - Different colors: green (idle), yellow (processing), red (error)

### Acceptance Criteria
- [ ] Users can create multiple Claude sessions in tabs
- [ ] Pre-warmed sessions provide instant tab creation
- [ ] Forking preserves full context in new tab
- [ ] Tabs persist across page refreshes
- [ ] Clean session cleanup on tab close

### Implementation Notes

**Component Library Versions (Current as of June 2025):**
- Tailwind CSS: v3.4.1 (LTS)
- lucide-react: v0.316.0 (latest stable)
- clsx: v2.1.0 (for conditional classes)
- No external component libraries - using custom components

**Key Components to Use:**
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `ui/tabs.tsx`
- `Button` from `ui/button.tsx` (variants: default, outline, ghost)
- `Badge` from `ui/badge.tsx` for status indicators
- `Input` from `ui/input.tsx` for inline editing
- Icons from `lucide-react`: `Plus`, `X`, `GitBranch`, `AlertCircle`

**Patterns to Follow:**
- Use existing TabsContext pattern for state management
- Follow Tailwind utility classes for styling
- Maintain accessibility with ARIA attributes
- Use `clsx` for conditional styling
- Icon sizing: h-3 w-3 (small), h-4 w-4 (default), h-5 w-5 (large)

**Working Directory Configuration:**
- Console sessions use project root: `/Users/josh/Documents/meta-gothic-framework`
- Change line 327 in ClaudeConsoleGraphQL.tsx from `/Users/josh/Documents` to project root
- This is safe because:
  - Commit message generation creates isolated sessions with repo-specific paths (line 751 in ClaudeSessionManagerWithEvents.ts)
  - Console and commit generation don't share sessions
  - Each commit generation gets its own session with `workingDir = input.path || process.cwd()`

## 🔧 SECOND PRIORITY: Test Framework Setup

### Goal
**Establish comprehensive testing infrastructure across all services**

### Why This Is Critical
- Zero test coverage is a massive technical risk
- Makes refactoring dangerous and unpredictable
- No confidence in changes or deployments
- Essential for long-term maintainability

### Tasks
- [ ] Set up Jest/Vitest testing framework
- [ ] Create test structure and conventions
- [ ] Write unit tests for critical business logic
- [ ] Add integration tests for GraphQL resolvers
- [ ] Set up CI/CD test automation
- [ ] Achieve minimum 60% coverage target

## 🔧 SECOND PRIORITY: SSE Implementation for Real-time Subscriptions

### Goal
**Implement Server-Sent Events (SSE) support for real-time subscriptions in the Cosmo Router setup**

### Why This Matters
- Current federation works but lacks real-time subscription support
- SSE provides better compatibility than WebSockets for our use case
- Essential for Claude session output streaming and file watching

### Tasks

**Task 1: Implement SSE in Claude Service**
- [x] Add SSE endpoint at `/graphql/stream`
- [x] Convert subscriptions to use SSE transport
- [x] Implement heartbeat mechanism (30s intervals)
- [x] Test with command output streaming
- [x] Add proper error handling and connection management
- [ ] Add connection pooling and rate limiting
- [ ] Implement message IDs for resumption support

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

## 🆕 Recently Discovered Technical Debt

### Critical Issues Found (June 8, 2025)
1. **Zero Test Coverage** - No tests exist across any service
2. **Hardcoded Configuration** - Ports and URLs hardcoded throughout
3. **Event System Duplication** - Multiple EventBus implementations
4. **Performance Issues** - Sequential repository scanning, disabled caching
5. **Incomplete Features** - IntelligentResumption and PreWarmSessionManager lack tests/docs

### Quick Wins Available
- [x] Replace console.log with logger (COMPLETED)
- [ ] Re-enable cache in generateCommitMessages.ts
- [ ] Add .env.example files
- [ ] Consolidate config files
- [ ] Remove duplicate router binaries

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
- [x] Replace all console.log with structured logger
- [x] Add proper error context and stack traces
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
- [x] Add detailed health checks to all services
- [x] Create uptime monitoring (health-monitor.ts in Claude service)
- [x] Add memory usage and request tracking
- [x] Implement automated health checking script
- [ ] Set up alerts for failures
- [ ] Build health dashboard UI

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

- The migration to Cosmo has been successful and Federation v2 is fully operational
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
# - Git Service: http://localhost:3004/graphql
# - GitHub Adapter: http://localhost:3005/graphql
```

## 🔗 Related Documentation

- [Cosmo Router Migration Guide](./cosmo-router-migration-guide.md)
- [Federation Setup Guide](./federation-setup-guide.md)
- [Local Development SSE Setup](./local-development-sse-setup.md)
- [Service Naming Strategy](./service-naming-strategy-revised.md)