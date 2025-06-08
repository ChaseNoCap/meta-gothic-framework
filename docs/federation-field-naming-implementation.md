# 🚨 TOP PRIORITY: Implement Federation Field Naming Pattern

**Priority**: P0 - CRITICAL  
**Type**: Technical Debt / Architecture  
**Affects**: Gateway, All Services, UI  
**Blocked by**: None  
**Blocks**: UI functionality, health checks, service monitoring  

## Problem Statement
The gateway cannot properly route GraphQL queries because of a mismatch between service field names and gateway expectations:
- Services expose: `health`
- Gateway expects: `claudeHealth`, `repoAgentHealth`
- This causes query failures and requires brittle workarounds

## Solution Overview
Implement the Clean Service Pattern for federation field naming as documented in ADR-Federation-Field-Naming.md

## Acceptance Criteria

### 1. Service Schema Updates ✅
- [ ] Claude service exposes `health: ClaudeHealthStatus!`
- [ ] Git service exposes `health: RepoAgentHealth!`
- [ ] GitHub adapter exposes `health: GitHubHealthStatus!` (if applicable)
- [ ] All services can start without resolver/schema mismatches
- [ ] Each service's health endpoint returns proper typed data

### 2. Gateway Configuration ✅
- [ ] Generate new gateway configuration using live service SDLs
- [ ] Configuration correctly composes the federated schema
- [ ] Gateway can route health queries to appropriate services
- [ ] Gateway starts without configuration errors
- [ ] Gateway responds to `__typename` queries successfully

### 3. Federation Composition ✅
- [ ] Create a reliable script to generate gateway configuration
- [ ] Script fetches SDLs from all running services
- [ ] Script handles federation v2 directives properly
- [ ] Script generates valid Cosmo Router configuration
- [ ] Script is documented and added to package.json scripts

### 4. UI Updates ✅
- [ ] Update apollo-client.ts to use proper field names from composed schema
- [ ] Update all GraphQL operations to match composed schema
- [ ] Health checks work through the gateway
- [ ] No GraphQL errors in browser console
- [ ] UI can query all services' health status

### 5. Testing ✅
- [ ] Manual test: All services start successfully
- [ ] Manual test: Gateway starts and serves GraphQL playground
- [ ] Manual test: Health query works for each service
- [ ] Manual test: UI displays health status correctly
- [ ] Document test queries for future validation

### 6. Documentation ✅
- [ ] Update service README files with schema patterns
- [ ] Document the federation field naming pattern
- [ ] Add examples of proper UI queries
- [ ] Update CLAUDE.md with federation patterns

## Implementation Steps

### Phase 1: Clean Service Schemas (30 min)
1. Ensure Claude service schema has only `health: ClaudeHealthStatus!`
2. Ensure Git service schema has only `health: RepoAgentHealth!`
3. Remove any field aliases or workarounds
4. Restart services and verify they start cleanly

### Phase 2: Gateway Configuration (1 hour)
1. Create `generate-federation-config.sh` script:
   ```bash
   #!/bin/bash
   # Fetch SDLs from all services
   # Compose federated schema
   # Generate Cosmo Router config
   ```
2. Run script to generate new configuration
3. Test gateway with new configuration
4. Verify GraphQL playground shows correct schema

### Phase 3: UI Updates (30 min)
1. Query gateway to understand composed schema field names
2. Update apollo-client.ts health check query
3. Update any other queries using old field names
4. Test UI health checks work properly

### Phase 4: Validation (30 min)
1. Full system restart
2. Verify all services healthy
3. Test sample queries through gateway
4. Confirm UI functionality

## Test Queries

```graphql
# Test gateway schema introspection
{
  __schema {
    queryType {
      fields {
        name
        type {
          name
        }
      }
    }
  }
}

# Test health queries (exact format depends on composition)
{
  health {
    ... on ClaudeHealthStatus {
      healthy
      claudeAvailable
    }
    ... on RepoAgentHealth {
      healthy
      gitVersion
    }
  }
}
```

## Success Metrics
- Zero GraphQL errors in service logs
- Zero GraphQL errors in browser console
- All health checks return data
- Gateway uptime > 99%
- No manual field mapping required

## Rollback Plan
1. Restore `config-working.json` to gateway
2. Add field aliases back to services
3. Revert UI queries to use old field names

## Notes
- This is blocking all UI functionality that depends on GraphQL
- Must be completed before any new feature development
- Sets the pattern for all future federation work

## References
- [ADR: Federation Field Naming Pattern](./ADR-Federation-Field-Naming.md)
- [Cosmo Router Documentation](https://cosmo-docs.wundergraph.com/router)
- [GraphQL Federation v2 Spec](https://www.apollographql.com/docs/federation/)