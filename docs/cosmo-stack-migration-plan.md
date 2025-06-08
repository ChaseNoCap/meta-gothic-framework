# Cosmo Stack Migration Plan

## Executive Summary

The migration to WunderGraph Cosmo has revealed that Cosmo Router requires cloud connectivity for proper federation support. We have three viable paths forward:

1. **Use Cosmo Cloud Service** (Recommended for production)
2. **Implement Custom SSE Federation** (Recommended for local development)
3. **Use GraphQL Mesh with SSE** (Alternative approach)

## Current State

### Completed Work
- ✅ Services renamed for consistency
- ✅ SSE endpoints implemented in Claude and Git services
- ✅ Cosmo Router binary downloaded and tested
- ✅ Federation configuration files created
- ✅ All services updated and working with new names

### Blockers
- ❌ Cosmo Router requires cloud account for federation
- ❌ Local-only mode doesn't support full federation features
- ❌ Schema composition requires wgc CLI with authentication

## Recommended Path: Hybrid Approach

### Development Environment (Custom SSE Gateway)
1. Use GraphQL Yoga as gateway with custom federation
2. Implement SSE transport for subscriptions
3. Keep existing Apollo federation for queries/mutations
4. Simple, fast, no external dependencies

### Production Environment (Cosmo Cloud)
1. Register for WunderGraph Cloud account
2. Set up managed Cosmo Router
3. Full federation support with monitoring
4. Professional-grade infrastructure

## Implementation Plan

### Phase 1: Local Development Gateway (1-2 days)
```typescript
// Create custom gateway with SSE support
const gateway = new GraphQLGateway({
  services: [
    { name: 'claude', url: 'http://localhost:3002/graphql' },
    { name: 'git', url: 'http://localhost:3004/graphql' },
    { name: 'github', url: 'http://localhost:3005/graphql' }
  ],
  subscriptions: {
    transport: 'sse',
    endpoints: {
      claude: 'http://localhost:3002/graphql/stream',
      git: 'http://localhost:3004/graphql/stream'
    }
  }
});
```

### Phase 2: Client Migration (2-3 days)
- Update Apollo Client to use SSE for subscriptions
- Implement reconnection logic
- Test all subscription features
- Update UI components

### Phase 3: Production Setup (1 week)
- Set up WunderGraph Cloud account
- Configure Cosmo Router
- Implement monitoring and alerting
- Create deployment pipeline

### Phase 4: gRPC Migration (2 weeks)
- Design Protocol Buffer schemas for GitHub API
- Implement gRPC service in Go/Node.js
- Create GraphQL to gRPC bridge
- Performance testing and optimization

## Technical Decisions

### Why SSE over WebSockets?
- Simpler implementation
- Better proxy/firewall compatibility
- Built-in reconnection
- Lower overhead for one-way communication

### Why Keep Apollo for Development?
- Proven, stable technology
- Easy local setup
- Good developer experience
- Smooth migration path

### Why Cosmo for Production?
- Advanced federation features
- Built-in monitoring
- Performance optimization
- Professional support

## Next Immediate Steps

1. **Create Custom Dev Gateway** (Priority: HIGH)
   - Implement in `gothic-gateway/src/gateway-sse.ts`
   - Support both HTTP and SSE transports
   - Maintain Apollo compatibility

2. **Test SSE Subscriptions** (Priority: HIGH)
   - Create test suite for all subscriptions
   - Verify heartbeat mechanism
   - Test reconnection scenarios

3. **Update Documentation** (Priority: MEDIUM)
   - Developer setup guide
   - SSE client examples
   - Troubleshooting guide

## Risk Mitigation

1. **Fallback Strategy**: Keep Apollo Gateway running in parallel
2. **Gradual Migration**: Route traffic incrementally
3. **Testing**: Comprehensive test suite before production
4. **Monitoring**: Real-time alerts for any issues

## Success Criteria

- [ ] All subscriptions working via SSE
- [ ] No performance degradation
- [ ] Improved monitoring capabilities
- [ ] Simplified deployment process
- [ ] Better developer experience

## Timeline

- Week 1: Local development gateway
- Week 2: Client migration and testing
- Week 3: Production setup (if using Cosmo Cloud)
- Week 4: gRPC implementation start
- Week 5-6: gRPC completion and optimization
