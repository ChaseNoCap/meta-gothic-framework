# Meta GOTHIC Framework Backlog

This document tracks future work items for the Meta GOTHIC Framework. When asking "what's next?", consult this backlog for prioritized work items.

> **Note**: ADR references in this document may refer to the original numbered ADRs (ADR-001 through ADR-022) that existed at the time of writing. These have since been consolidated into six topic-based ADRs. See [ADR-index.md](./ADR-index.md) for the current consolidated structure.

## Current Status

**As of January 6, 2025:**
- Meta GOTHIC Framework: 8 packages created, UI dashboard operational
- GraphQL infrastructure fully migrated to Yoga + Mesh
- Ready for infrastructure package integration to enable full observability

## How to Use This Backlog

1. **Prioritization**: Items are listed in priority order within each section
2. **Status**: Each item should have a clear status (Not Started, In Progress, Blocked, Complete)
3. **Refinement**: Work items should be refined before starting implementation
4. **Updates**: Mark items complete and add new discoveries as work progresses

## 🚨 Current Priority: Full Cosmo Stack Migration with SSE & gRPC

> **CURRENT SPRINT**: Migrate to WunderGraph Cosmo Stack
> **SPRINT GOAL**: Replace Apollo Gateway with Cosmo Router, implement SSE for subscriptions, and use gRPC for GitHub integration
> 
> **SPRINT JUSTIFICATION**: 
> - Need WebSocket federation support for real-time features
> - SSE provides better compatibility and simpler implementation
> - gRPC offers superior performance for GitHub API integration
> - Cosmo provides better monitoring and debugging tools
> - Hot configuration updates without downtime
>
> **ARCHITECTURE TARGET**:
> ```
> gothic-gateway (Cosmo Router)
> ├── claude-service (GraphQL + SSE)
> ├── git-service (GraphQL + SSE)
> └── github-adapter (gRPC)
> ```
>
> **IMMEDIATE TASKS**:
> - [ ] Install and configure Cosmo Router
> - [ ] Update services for SSE subscription support
> - [ ] Convert GitHub service to gRPC with Protocol Buffers
> - [ ] Migrate clients to use SSE
> - [ ] Set up Cosmo monitoring and observability
> - [ ] Deploy with parallel running strategy

## 📋 Service Naming Standardization

### Immediate Actions (Before Cosmo Migration)

**Task 0: Standardize Service Names** (Priority: CRITICAL)
- [ ] Rename `github-mesh` → `github-adapter`
- [ ] Rename `meta-gothic-app` → `gothic-gateway`
- [ ] Rename `repo-agent-service` → `git-service`
- [ ] Update all references in configuration files
- [ ] Update documentation with new names
- [ ] Test federation with new names

**Rationale**: Clean, consistent naming before major migration reduces confusion and technical debt.

## 📋 Cosmo Stack Migration Sprint Details

### Phase 1: Infrastructure Setup (Week 1)

**Task 1: Install Cosmo Stack** (Priority: CRITICAL)
- [ ] Install Cosmo CLI and create workspace
- [ ] Create federated graph configuration
- [ ] Set up Cosmo Router with SSE support
- [ ] Configure subscription protocols (SSE primary, WebSocket fallback)
- [ ] Register all subgraphs with Cosmo
- [ ] Test router with existing services

**Task 2: Configure Monitoring** (Priority: HIGH)
- [ ] Set up Prometheus metrics endpoint
- [ ] Configure OpenTelemetry tracing
- [ ] Create Grafana dashboards for Cosmo metrics
- [ ] Set up slow query logging
- [ ] Configure health checks for all subgraphs

### Phase 2: Service Migration (Week 2)

**Task 3: Update Claude Service for SSE** (Priority: CRITICAL)
- [ ] Add @graphql-yoga/plugin-sse dependency
- [ ] Configure SSE endpoint at /graphql/stream
- [ ] Update subscription resolvers with heartbeat support
- [ ] Add proper SSE headers and keep-alive
- [ ] Test subscriptions through Cosmo Router
- [ ] Implement graceful SSE disconnection handling

**Task 4: Update Git Service for SSE** (Priority: HIGH)
- [ ] Mirror Claude service SSE setup
- [ ] Handle long-running git operations
- [ ] Add chunking for large diffs
- [ ] Test file watching subscriptions
- [ ] Ensure non-blocking event loop

**Task 5: Convert GitHub Service to gRPC** (Priority: HIGH)
- [ ] Create protobuf definitions for GitHub API entities
- [ ] Implement gRPC service in Go using HashiCorp's go-plugin
- [ ] Integrate Octokit for GitHub API calls
- [ ] Set up bidirectional streaming for large responses
- [ ] Configure gRPC health checks and monitoring
- [ ] Benchmark performance vs REST wrapper (target: 30% improvement)
- [ ] Enable connection pooling and multiplexing

### Phase 3: Client Migration (Week 3)

**Task 6: Update Apollo Client for SSE** (Priority: CRITICAL)
- [ ] Install graphql-sse client
- [ ] Create SSE link for subscriptions
- [ ] Update split link configuration
- [ ] Handle heartbeat messages client-side
- [ ] Implement automatic reconnection
- [ ] Test all subscription components

**Task 7: Native EventSource Option** (Priority: MEDIUM)
- [ ] Create EventSource wrapper for simple subscriptions
- [ ] Add authentication via query parameters
- [ ] Implement error handling and retry
- [ ] Document when to use vs graphql-sse client

### Phase 4: Deployment Strategy (Week 4)

**Task 8: Parallel Running Setup** (Priority: CRITICAL)
- [ ] Configure both Apollo Gateway and Cosmo Router
- [ ] Set up feature flags for router selection
- [ ] Create routing rules for gradual migration
- [ ] Monitor performance differences
- [ ] Document rollback procedures

**Task 9: Production Deployment** (Priority: HIGH)
- [ ] Update PM2 configuration for Cosmo
- [ ] Create deployment scripts
- [ ] Set up blue-green deployment
- [ ] Configure edge caching rules
- [ ] Plan maintenance window

### Phase 5: Optimization (Week 5)

**Task 10: Performance Tuning** (Priority: MEDIUM)
- [ ] Configure request batching
- [ ] Optimize query planning cache
- [ ] Set up field-level caching
- [ ] Implement DataLoader patterns
- [ ] Measure and document improvements

## 📋 Type Alignment Sprint Details

### Phase 1: Foundation Setup (Priority: HIGHEST)

**Task 1: Create Base TypeScript Configuration** ✅ COMPLETED
- [x] Create `/tsconfig.base.json` with strictest settings
- [x] Include all recommended strict checks:
  - `"strict": true`
  - `"noUncheckedIndexedAccess": true`
  - `"noImplicitOverride": true`
  - `"noPropertyAccessFromIndexSignature": true`
  - `"exactOptionalPropertyTypes": true`
- [x] Set target to ES2022 for consistency
- [x] Document configuration choices
- [x] Update root tsconfig.json to extend base
- [x] Add project references for all services

**Task 2: Create Shared Types Package** ✅ COMPLETED
- [x] Create `services/shared/types/` directory structure
- [x] Set up package.json with proper exports
- [x] Create initial type files:
  - `context.ts` - Base context interfaces
  - `common.ts` - Common enums and utility types
  - `results.ts` - Standard result/error patterns
  - `metadata.ts` - Shared metadata types
  - `guards.ts` - Type guard utilities
- [x] Configure TypeScript build process
- [x] Fix all TypeScript strict mode errors
- [x] Successfully build package

### Phase 2: Service Migrations (Priority: HIGHEST)

**Task 3: Migrate Claude Service Types** ✅ COMPLETED
- [x] Update `tsconfig.json` to extend base config
- [x] Replace local Context interface with shared type
- [x] Move RunStatus enum to shared types (created mapping for Claude-specific statuses)
- [x] Update all imports to use shared types
- [x] Fix any type errors from stricter settings
- [x] Add shared types dependency to package.json
- [x] Service builds and runs successfully

**Task 4: Migrate Repo Agent Service Types** ✅ COMPLETED
- [x] Update `tsconfig.json` to extend base config
- [x] Replace local Context interface with shared type (extends GraphQLContext)
- [x] Consolidate result types with shared patterns (identified candidates)
- [x] Update all imports to use shared types
- [x] Fix any type errors from stricter settings
- [x] Add shared types dependency to package.json
- [x] Fix logger configuration to use correct parameter names
- [x] Service builds and runs successfully

**Task 5: Migrate Meta Gothic App Types** ✅ COMPLETED
- [x] Update `tsconfig.json` to extend base config
- [x] Replace local Context interface with shared type (GitHubResolverContext uses GraphQLContext)
- [x] Standardize event handler types (fixed BaseEvent imports)
- [x] Update all imports to use shared types
- [x] Fix any type errors from stricter settings:
  - Fixed environment variable access with bracket notation
  - Fixed logger configuration to use correct parameters
  - Fixed event type imports to use shared event-types.ts
  - Fixed correlationId return type with proper optional handling
  - Service builds and runs successfully

### Phase 3: Package Standardization (Priority: HIGH)

**Task 6: Fix Context Aggregator Strict Mode**
- [ ] Enable strict mode in context-aggregator
- [ ] Fix all resulting type errors
- [ ] Update module resolution to NodeNext
- [ ] Ensure all tests pass with strict mode

**Task 7: Standardize UI Components** ⚠️ PARTIALLY COMPLETE
- [x] Align module resolution strategy (bundler)
- [x] Update `tsconfig.json` to extend base config
- [x] Preserve browser-specific settings (DOM libs, jsx, bundler resolution)
- [ ] Fix strict mode type errors (253 errors found - significant work required)
- Note: UI package has many type errors due to stricter settings, may need gradual migration

**Task 8: Update Remaining Packages** ✅ COMPLETED
- [x] claude-client - Already strict, updated to extend base config
- [x] prompt-toolkit - Already strict, updated to extend base config
- [x] graphql-toolkit - Updated to extend base config, kept ESNext module
- [x] sdlc-config - Updated to extend base config, kept NodeNext resolution
- [x] sdlc-engine - Updated to extend base config, kept NodeNext resolution
- [x] sdlc-content - Updated to extend base config, kept NodeNext resolution
- [x] event-system - Updated to extend base config
- [x] file-system - Updated to extend base config
- [x] logger - Updated to extend base config

### Phase 4: Project References Setup (Priority: HIGH)

**Task 9: Configure TypeScript Project References**
- [ ] Update root `tsconfig.json` with references
- [ ] Configure build order dependencies
- [ ] Set up composite projects
- [ ] Test incremental builds
- [ ] Document reference architecture

**Task 10: Optimize Build Performance**
- [ ] Enable incremental compilation
- [ ] Configure proper output directories
- [ ] Set up build caching
- [ ] Measure and document build times

### Phase 5: Automation & Monitoring (Priority: MEDIUM)

**Task 11: CI/CD Type Checking**
- [ ] Add type checking step to GitHub Actions
- [ ] Configure to run on all PRs
- [ ] Set up type coverage reporting
- [ ] Add badges to README

**Task 12: Type Health Monitoring**
- [ ] Install and configure type-coverage tool
- [ ] Set up regular type coverage reports
- [ ] Create dashboard for type health metrics
- [ ] Set up alerts for type coverage drops

**Task 13: Developer Tooling**
- [ ] Create type checking scripts
- [ ] Add pre-commit hooks for type validation
- [ ] Set up VS Code workspace settings
- [ ] Document type checking workflow

## 🚀 Current Sprint: Performance Monitoring Implementation

### Sprint Goal: Configurable Performance Monitoring System
**Status**: IN PROGRESS (Task 6 from Infrastructure Integration)  
**Sprint Justification**: 
- Need detailed performance insights without adding unnecessary overhead
- Current monitoring is basic and not configurable
- Different environments need different levels of monitoring
- AI operations need specific metrics (token usage, costs)

### Completed Tasks:

**Task 6: Performance Monitoring Implementation** ✅ COMPLETED
- [x] Created comprehensive PerformanceMonitor class with configurable metrics
- [x] Implemented @Monitor decorator with configuration support
- [x] Added performance event types to event system
- [x] Created configuration presets (Default, Development, Production, Debug)
- [x] Added support for various metric types:
  - Resource metrics (CPU, memory)
  - Data size metrics (context, result)
  - AI/ML metrics (token usage, costs)
  - GraphQL metrics (complexity, field count)
  - Cache metrics (hit rate)
  - Network metrics (external calls)
  - File system metrics (reads, writes)
- [x] Implemented sampling strategies for production
- [x] Added performance scoring algorithm
- [x] Created GraphQL performance plugin
- [x] Updated resolvers with @Monitor decorators:
  - createHandoff with 1s threshold
  - generateCommitMessages with AI metrics
  - sessions query with production config
  - scanAllRepositories with file system tracking
- [x] Extended Context interfaces to support performance data
- [x] Created comprehensive documentation in performance-monitoring-guide.md

### Performance Monitoring Features Implemented:
1. **Configurable Metrics Collection** - Enable/disable specific metrics
2. **Environment-based Presets** - Different configs for dev/prod/debug
3. **Sampling Support** - Reduce overhead in production
4. **Decorator Pattern** - Easy to apply to any method
5. **Event Integration** - Emits performance events for real-time monitoring
6. **GraphQL Plugin** - Automatic tracking of GraphQL operations
7. **Context Flow** - Performance data flows through GraphQL context

### Next Task:

**Task 7: Create Observability Dashboard** (Next Priority)
- [ ] Real-time performance metrics visualization
- [ ] Active operations monitoring
- [ ] Performance trends and history
- [ ] Slow operation alerts
- [ ] Resource usage graphs
- [ ] AI token usage tracking
- [ ] Cache hit rate visualization

## 📋 Infrastructure Integration Sprint Details

### Week 1: Logging Foundation & Traceability

**Day 1-2: Add Infrastructure Packages**
```bash
# Add as Git submodules
git submodule add https://github.com/ChaseNoCap/logger packages/logger
git submodule add https://github.com/ChaseNoCap/cache packages/cache
git submodule add https://github.com/ChaseNoCap/event-system packages/event-system
git submodule add https://github.com/ChaseNoCap/file-system packages/file-system
```

**Day 3-4: Structured Logging Implementation**
- [ ] Configure Winston loggers in all services with correlation IDs
- [ ] Set up log directory structure:
  ```
  logs/
  ├── services/
  │   ├── claude-service/
  │   │   ├── app-2025-01-06.log
  │   │   ├── error-2025-01-06.log
  │   │   └── performance-2025-01-06.log
  │   ├── repo-agent-service/
  │   └── gateway/
  ├── graphql/
  │   ├── queries/
  │   ├── mutations/
  │   └── subscriptions/
  ├── ai-operations/
  │   ├── claude-sessions/
  │   └── commit-generation/
  └── system/
      ├── health-checks/
      └── performance/
  ```
- [ ] Implement child loggers for request context
- [ ] Add structured metadata (service, operation, user, timestamp)
- [ ] Create log aggregation views

**Day 5: Testing & Documentation**
- [ ] Test log rotation and retention
- [ ] Document logging standards
- [ ] Create log analysis scripts

### Week 2: Event-Driven Traceability

**Day 1-2: Event System Integration**
- [ ] Add @Emits decorators to key operations:
  ```typescript
  @Emits('claude.session.started', 'claude.session.completed', 'claude.session.failed')
  async executeCommand(input: ClaudeExecuteInput) { ... }
  
  @Emits('graphql.query.started', 'graphql.query.completed')
  async gitStatus(path: string) { ... }
  ```
- [ ] Create event type definitions
- [ ] Set up event logging middleware

**Day 3-4: Performance Monitoring**
- [ ] Add @Traces decorators for performance tracking:
  ```typescript
  @Traces({ slowThreshold: 100 })
  async generateCommitMessages(input: BatchCommitMessageInput) { ... }
  ```
- [ ] Log slow operations to performance logs
- [ ] Create performance dashboards
- [ ] Set up alerts for degradation

**Day 5: Real-time Updates**
- [ ] Connect events to WebSocket broadcasts
- [ ] Update dashboard for real-time monitoring
- [ ] Test event flow end-to-end

### Week 3: Production Observability Platform

**Day 1-2: Log Analysis Dashboard**
- [ ] Real-time log streaming view
- [ ] Correlation ID search and trace
- [ ] AI operation analytics
- [ ] Performance bottleneck identification

**Day 3-4: Event Stream Visualization**
- [ ] Live event flow diagram
- [ ] Event frequency heatmaps
- [ ] Subscription health monitoring
- [ ] Event replay capabilities

**Day 5: Integration Testing**
- [ ] End-to-end traceability tests
- [ ] Performance benchmarks
- [ ] Load testing with full logging

### Implementation Patterns

**1. Correlation ID Flow**
```typescript
// Generate at gateway
const correlationId = generateId();
logger.child({ correlationId }).info('Request started');

// Pass through GraphQL context
context: { correlationId, logger: logger.child({ correlationId }) }

// Use in resolvers
context.logger.info('Executing git status', { path });
```

**2. Structured Log Format**
```json
{
  "timestamp": "2025-01-06T10:30:00Z",
  "level": "info",
  "service": "claude-service",
  "correlationId": "abc123",
  "operation": "executeCommand",
  "userId": "user123",
  "duration": 145,
  "metadata": {
    "sessionId": "session456",
    "model": "claude-3",
    "tokenCount": 1500
  }
}
```

**3. Event Naming Convention**
```
service.entity.action
- claude.session.started
- repo.commit.created
- github.workflow.triggered
- cache.entry.invalidated
```


## 📊 Logging & Traceability Requirements

### End-to-End Stack Traceability

**1. Request Lifecycle Tracking**
- Every request gets a unique correlation ID at the gateway
- Correlation ID flows through all services and operations
- All logs for a request can be queried by correlation ID
- Request timeline can be reconstructed from logs

**2. AI Operation Tracking**
```typescript
// Claude session tracking
logger.info('Claude session started', {
  sessionId,
  workingDirectory,
  correlationId,
  userId,
  timestamp
});

// Log every Claude interaction
logger.info('Claude command executed', {
  sessionId,
  command,
  tokenCount: { input: 1500, output: 500 },
  duration: 2500,
  success: true
});
```

**3. GraphQL Operation Logging**
- Log every query/mutation with timing
- Track resolver execution paths
- Log data fetching operations
- Monitor subscription lifecycle

**4. GitHub API Tracking**
- Log all GitHub API calls with response times
- Track rate limit consumption
- Log cache hits/misses
- Monitor webhook events

### Log Organization Structure

```
logs/
├── index.json                    # Log file index with metadata
├── services/
│   ├── claude-service/
│   │   ├── app-{date}.log       # General application logs
│   │   ├── error-{date}.log     # Error logs only
│   │   ├── performance-{date}.log # Performance metrics
│   │   └── sessions/            # Claude session logs
│   │       └── {sessionId}.log
│   ├── repo-agent-service/
│   │   ├── app-{date}.log
│   │   ├── git-operations-{date}.log
│   │   └── scans/               # Repository scan logs
│   └── gateway/
│       ├── access-{date}.log    # HTTP access logs
│       ├── graphql-{date}.log   # GraphQL operations
│       └── federation-{date}.log # Service routing
├── graphql/
│   ├── queries/
│   │   └── {date}/
│   │       └── {operationName}-{correlationId}.json
│   ├── mutations/
│   └── subscriptions/
├── ai-operations/
│   ├── claude-sessions/
│   │   └── {date}/
│   │       └── session-{id}.json
│   ├── commit-generation/
│   │   └── {date}/
│   │       └── batch-{id}.json
│   └── token-usage/
│       └── {date}-summary.json
├── performance/
│   ├── slow-queries-{date}.log
│   ├── cache-stats-{date}.json
│   └── traces/
│       └── {date}/
│           └── {correlationId}.json
└── audit/
    ├── user-actions-{date}.log
    ├── config-changes-{date}.log
    └── security-events-{date}.log
```

### Log Retention Policies

| Log Type | Retention | Rotation | Compression |
|----------|-----------|----------|-------------|
| Application logs | 30 days | Daily | After 7 days |
| Error logs | 90 days | Daily | After 3 days |
| Performance logs | 7 days | Daily | After 1 day |
| AI operation logs | 60 days | Daily | After 7 days |
| Audit logs | 1 year | Monthly | After 30 days |
| Session logs | 14 days | Per session | On completion |

### Native Tooling Integration

**1. Use OS Log Rotation**
```bash
# logrotate.conf for metaGOTHIC
/path/to/logs/services/*/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 node node
}
```

**2. Structured Query Tools**
```bash
# Query logs by correlation ID
jq 'select(.correlationId == "abc123")' logs/**/*.json

# Find slow operations
jq 'select(.duration > 1000)' logs/performance/*.json

# Track AI token usage
jq '.tokenCount' logs/ai-operations/**/*.json | jq -s add
```

**3. Log Streaming**
- Stream logs to CloudWatch/Datadog in production
- Use native syslog for system integration
- Support log forwarding via rsyslog

## 🔧 Technical Debt Items

### Critical Tech Debt
1. **Multiple Gateway Implementations**
   - **Issue**: 10+ different gateway files (yoga-mesh-gateway.ts, simple-gateway.ts, etc.)
   - **Impact**: Confusion about which to use, maintenance overhead
   - **Solution**: Consolidate to single configurable gateway
   - **Effort**: 1-2 days

2. **Experimental Files Cleanup**
   - **Issue**: Many test/experimental files (test-yoga.ts, benchmark-*.ts)
   - **Impact**: Cluttered codebase, unclear what's production-ready
   - **Solution**: Move to examples/ or test/ directories, or remove
   - **Effort**: 2-3 hours

3. **Service Startup Scripts**
   - **Issue**: Multiple startup scripts with similar functionality
   - **Impact**: Confusion about which script to use
   - **Solution**: Single unified startup script with options
   - **Effort**: 3-4 hours

4. **GraphQL Operations Duplication**
   - **Issue**: Similar operations defined in multiple files
   - **Impact**: Inconsistency, maintenance overhead
   - **Solution**: Centralize all GraphQL operations
   - **Effort**: 1 day

### Medium Priority Tech Debt
1. **Environment Variable Management**
   - **Issue**: GitHub token referenced as both GITHUB_TOKEN and VITE_GITHUB_TOKEN
   - **Impact**: Configuration confusion
   - **Solution**: Standardize on single variable name
   - **Effort**: 2-3 hours

2. **Error Handling Consistency**
   - **Issue**: Different error handling patterns across services
   - **Impact**: Inconsistent user experience
   - **Solution**: Implement unified error handling strategy
   - **Effort**: 1-2 days

3. **Type Generation Strategy**
   - **Issue**: Mix of manual and generated types
   - **Impact**: Type safety gaps
   - **Solution**: Full GraphQL code generation setup
   - **Effort**: 1 day

4. **Test Coverage**
   - **Issue**: Limited test coverage for new GraphQL endpoints
   - **Impact**: Regression risk
   - **Solution**: Add integration tests for all queries/mutations
   - **Effort**: 2-3 days

### Low Priority Tech Debt
1. **Documentation Updates**
   - **Issue**: README files reference old Mercurius setup
   - **Impact**: Developer confusion
   - **Solution**: Update all documentation
   - **Effort**: 1 day

2. **Performance Monitoring**
   - **Issue**: No production monitoring setup
   - **Impact**: Can't track real-world performance
   - **Solution**: Add Prometheus/Grafana
   - **Effort**: 2-3 days

3. **Caching Strategy**
   - **Issue**: Basic caching implementation
   - **Impact**: Suboptimal performance
   - **Solution**: Implement field-level caching policies
   - **Effort**: 1-2 days

## High Priority Items (After Type Alignment)

### 1. Infrastructure Integration for End-to-End Traceability
**Status**: Not Started (Previously Current Priority)  
**Effort**: 3 weeks  
**Priority**: HIGH  
**Description**: Integrate logging, caching, events, and file system packages for complete stack traceability
**Prerequisites**: Type alignment complete for consistent interfaces  

**Tasks**:
- [ ] Add infrastructure packages as Git submodules
- [ ] Configure structured logging across all services
- [ ] Implement event emissions for key operations
- [ ] Add caching decorators to expensive operations
- [ ] Set up centralized log organization in /logs
- [ ] Create log rotation and retention policies

## High Priority Items (After Infrastructure Integration)

### 1. Production Observability Platform
**Status**: Not Started  
**Effort**: 2-3 days  
**Priority**: HIGH  
**Description**: Build on infrastructure packages to create comprehensive observability
**Prerequisites**: Infrastructure packages integrated  

**Tasks**:
- [ ] **Log Analysis Dashboard**
  - [ ] Real-time log streaming view
  - [ ] Correlation ID search and trace
  - [ ] AI operation analytics
  - [ ] Performance bottleneck identification
  
- [ ] **Event Stream Visualization**
  - [ ] Live event flow diagram
  - [ ] Event frequency heatmaps
  - [ ] Subscription health monitoring
  - [ ] Event replay capabilities

- [ ] **Cache Analytics**
  - [ ] Hit rate visualization
  - [ ] TTL optimization suggestions
  - [ ] Memory usage tracking
  - [ ] Invalidation patterns

### 2. AI Operation Insights
**Status**: Not Started  
**Effort**: 3-4 days  
**Priority**: HIGH  
**Description**: Deep analytics for Claude operations
**Prerequisites**: Logging infrastructure complete  

**Tasks**:
- [ ] **Token Usage Analytics**
  - [ ] Cost tracking per operation
  - [ ] Token optimization suggestions
  - [ ] Usage trends and forecasting
  - [ ] Budget alerts

- [ ] **Session Performance**
  - [ ] Command execution timelines
  - [ ] Success/failure analysis
  - [ ] Context loading efficiency
  - [ ] Model performance comparison

- [ ] **Automated Reporting**
  - [ ] Daily AI usage summaries
  - [ ] Cost optimization reports
  - [ ] Performance regression alerts
  - [ ] Usage anomaly detection

## High Priority Items (Previously Planned)

### 1. Multi-Source Federation Implementation
**Status**: Not Started  
**Effort**: 3-4 days  
**Priority**: HIGH  
**Description**: Leverage GraphQL Mesh to federate non-GraphQL sources  
**Prerequisites**: Full Mesh gateway operational  
**ADRs**: ADR-019 (Multi-source capability)

**Tasks**:
- [ ] **GitHub REST API Federation**
  - [ ] Create OpenAPI spec for GitHub API subset
  - [ ] Configure REST data source in Mesh
  - [ ] Map REST endpoints to GraphQL types
  - [ ] Create relationships with existing types

- [ ] **NPM Registry Integration**
  - [ ] Add npm registry as GraphQL source
  - [ ] Link packages to repositories
  - [ ] Add version information to schema
  - [ ] Enable package search capabilities

- [ ] **Database Federation** (Future)
  - [ ] Plan direct database access
  - [ ] Design GraphQL schema mapping
  - [ ] Consider performance implications
  - [ ] Document security considerations

### 2. Advanced Mesh Features
**Status**: Not Started  
**Effort**: 2-3 days  
**Priority**: HIGH  
**Description**: Implement advanced GraphQL Mesh capabilities  
**Prerequisites**: Basic federation working  

**Tasks**:
- [ ] **Transform Plugins**
  - [ ] Field renaming and aliasing
  - [ ] Response transformations
  - [ ] Schema extensions
  - [ ] Custom directives

- [ ] **Caching Strategies**
  - [ ] Field-level cache policies
  - [ ] Entity cache invalidation
  - [ ] CDN integration
  - [ ] Edge caching setup

- [ ] **Security Features**
  - [ ] Rate limiting per operation
  - [ ] Query depth limiting
  - [ ] Field-level authorization
  - [ ] API key management


## Notes

- Type alignment must be completed first to ensure consistent interfaces across all packages
- Infrastructure packages enable comprehensive observability
- Focus on native tooling integration over custom solutions
- Maintain organized log structure for easy analysis
- Document all patterns for consistent implementation
- Strict TypeScript configuration will catch bugs early and improve developer experience

## 📋 Recommended Sprint Plan (Updated)

### Sprint 1: Type System Standardization (Current - 1 week)
Complete all Phase 1 and Phase 2 tasks from Type Alignment Sprint Details above.

### Sprint 2: Technical Debt Cleanup (1 week)
1. **Day 1-2**: Gateway Consolidation
   - Identify the best gateway implementation
   - Create unified gateway with configuration options
   - Remove duplicate implementations
   - Update startup scripts

2. **Day 3-4**: Codebase Cleanup
   - Move experimental files to examples/
   - Archive or remove unused code
   - Standardize environment variables
   - Update documentation

3. **Day 5**: Testing & Documentation
   - Add tests for consolidated gateway
   - Update README files
   - Create deployment guide
   - Document architectural decisions

### Sprint 3: Infrastructure Integration (2 weeks)
Complete infrastructure package integration as detailed in the Infrastructure Integration Sprint Details section.

### Sprint 4: Production Readiness (1 week)
1. **Day 1-2**: Monitoring & Observability
   - Set up Prometheus metrics
   - Create Grafana dashboards
   - Add distributed tracing
   - Implement health checks

2. **Day 3-4**: Security & Performance
   - Add authentication middleware
   - Implement rate limiting
   - Configure caching policies
   - Performance testing

3. **Day 5**: Deployment Preparation
   - Create Docker containers
   - Set up Kubernetes manifests
   - Configure CI/CD pipelines
   - Create runbooks

### Sprint 5: Feature Expansion (1 week)
1. Add npm registry integration
2. Implement advanced caching
3. Add more GitHub features
4. Create admin dashboard

## 🛠️ Technical Decisions Needed

### 1. Gateway Architecture
**Current State**: 10+ different gateway implementations
**Decision Needed**: Which approach to standardize on?
- **Option A**: Advanced Mesh Gateway with caching (most features)
- **Option B**: Simple Yoga gateway (easiest to understand)
- **Option C**: Configurable gateway with feature flags

**Recommendation**: Option C - Single gateway with configuration

### 2. Testing Strategy
**Current State**: Limited test coverage
**Decision Needed**: Testing approach and tools
- **Unit Tests**: Vitest for speed
- **Integration Tests**: Supertest + GraphQL queries
- **E2E Tests**: Playwright or Cypress

**Recommendation**: Vitest + Supertest, Playwright for critical paths

### 3. Deployment Target
**Options:**
- **Vercel**: Easy Next.js integration
- **AWS**: Full control, more complex
- **Google Cloud Run**: Serverless containers
- **Self-hosted**: Maximum control

**Recommendation**: Start with Vercel, plan for AWS migration

## 📊 Success Metrics

### Performance Goals
- [ ] Page load time < 1s
- [ ] Time to interactive < 2s
- [ ] GraphQL query time < 50ms
- [ ] Cache hit rate > 80%

### Developer Experience
- [ ] Type coverage 100%
- [ ] No manual type definitions
- [ ] Hot reload preserves state
- [ ] Clear error messages

### User Experience
- [ ] Real-time updates
- [ ] Optimistic UI updates
- [ ] Offline support
- [ ] Progressive enhancement

## 🎯 Current Working Setup

```bash
# Start all services (current working setup)
cd services
./start-yoga-services.sh

# Access points:
# - Dashboard: http://localhost:3001
# - Gateway: http://localhost:3000/graphql
# - Claude Service: http://localhost:3002/graphql
# - Repo Agent: http://localhost:3004/graphql

# For development with GitHub integration:
export GITHUB_TOKEN=your_github_token
export VITE_GITHUB_TOKEN=$GITHUB_TOKEN  # For UI
```

## 🏁 Current State Summary

### What's Working Well
- Complete GraphQL infrastructure with federation
- GitHub integration with pipeline control
- Enhanced dashboard with real-time updates
- Excellent performance (2.32ms average latency)
- Full TypeScript type safety

### What Needs Attention
- Technical debt from rapid development
- Too many experimental implementations
- No production monitoring
- Limited test coverage
- Documentation needs updates

### Recommended Path Forward
1. **Week 1**: Clean up technical debt
2. **Week 2**: Add production readiness features
3. **Week 3**: Build Production Observability Platform
4. **Week 4**: Deploy to production

The infrastructure is solid, but needs consolidation and hardening before adding more features.

## 📦 Deprioritized Items

### Caching & Optimization

**Status**: Deprioritized  
**Reason**: Given the local/app-like nature of the Meta GOTHIC Framework and low utilization concerns, extensive caching is not a priority. Basic caching for expensive GitHub API calls may be sufficient.

**Original Plan (Week 3 Items):**

**Day 1-2: Cache Implementation**
- [ ] Add @Cacheable to expensive operations:
  ```typescript
  @Cacheable({ ttl: 300000, key: 'owner:repo' })
  async getGitHubRepository(owner: string, repo: string) { ... }
  
  @Cacheable({ ttl: 60000, key: 'path' })
  async gitStatus(path: string) { ... }
  ```
- [ ] Configure cache invalidation strategies
- [ ] Log cache hits/misses

**Day 3-4: File System Abstraction**
- [ ] Replace all direct fs usage with file-system package
- [ ] Add file operation logging
- [ ] Implement mock file system for tests

**Note**: While caching has been deprioritized, file system abstraction may still be valuable for testing purposes and could be considered separately from performance optimization efforts.
