# Health Query Migration Plan

## Overview

This document provides a step-by-step migration plan to resolve the health query naming collision in the meta-gothic-framework by implementing unique, service-specific health query names.

## Migration Strategy

We'll implement **Solution 1** from the collision solution document: renaming health queries at the service level to `claudeHealth` and `repoAgentHealth`.

## Phase 1: Update Service Schemas

### Step 1.1: Update Claude Service Schema

**File**: `/services/claude-service/schema/schema.graphql`

```diff
type Query {
  """List all active Claude sessions"""
  sessions: [ClaudeSession!]!
  
  """Get details of a specific session"""
  session(id: ID!): ClaudeSession
  
-  """Check service health and Claude availability"""
-  health: HealthStatus!
+  """Check Claude service health and availability"""
+  claudeHealth: ClaudeHealthStatus!
  
  """Get performance metrics for operations"""
  performanceMetrics(operation: String, lastMinutes: Int): PerformanceReport!
}

-type HealthStatus {
+type ClaudeHealthStatus {
  """Whether service is healthy"""
  healthy: Boolean!
  
  """Service version"""
  version: String!
  
  """Claude CLI availability"""
  claudeAvailable: Boolean!
  
  """Claude CLI version if available"""
  claudeVersion: String
  
  """Number of active sessions"""
  activeSessions: Int!
  
  """System resource usage"""
  resources: ResourceUsage!
}
```

### Step 1.2: Update Repo Agent Service Schema

**File**: `/services/repo-agent-service/schema/schema.graphql`

```diff
type Query {
-  """Health check endpoint"""
-  health: Health!
+  """Check Repo Agent service health"""
+  repoAgentHealth: RepoAgentHealthStatus!
  
  """Get the current git status of a repository"""
  gitStatus(path: String!): GitStatus!
  
  # ... other queries
}

-type Health {
+type RepoAgentHealthStatus {
  """Service health status"""
  status: String!
  
  """Current timestamp"""
  timestamp: String!
  
  """Service version"""
  version: String
  
  """Additional service information"""
-  details: HealthDetails!
+  details: RepoHealthDetails!
}

-type HealthDetails {
+type RepoHealthDetails {
  """Number of repositories being monitored"""
  repositoryCount: Int!
  
  """Git version"""
  gitVersion: String!
  
  """System information"""
  system: SystemInfo!
}
```

## Phase 2: Update Resolvers

### Step 2.1: Update Claude Service Health Resolver

**File**: `/services/claude-service/src/resolvers/queries/health.ts`

```typescript
// Update the export and function name
export const claudeHealthResolver = {
  claudeHealth: async (_: any, __: any, context: GraphQLContext) => {
    const logger = context.logger.child({ resolver: 'claudeHealth' });
    
    try {
      // Implementation remains the same
      const manager = context.dataSources.claudeManager;
      const isAvailable = await manager.checkClaudeAvailability();
      const version = await manager.getClaudeVersion();
      const sessions = manager.getAllSessions();
      
      // Get system resources
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      return {
        healthy: true,
        version: '1.0.0',
        claudeAvailable: isAvailable,
        claudeVersion: version,
        activeSessions: sessions.length,
        resources: {
          memoryUsage: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          cpuUsage: 0, // Would need proper CPU monitoring
          activeProcesses: sessions.filter(s => s.status === 'ACTIVE').length
        }
      };
    } catch (error) {
      logger.error('Health check failed', { error });
      return {
        healthy: false,
        version: '1.0.0',
        claudeAvailable: false,
        claudeVersion: null,
        activeSessions: 0,
        resources: {
          memoryUsage: 0,
          cpuUsage: 0,
          activeProcesses: 0
        }
      };
    }
  }
};
```

### Step 2.2: Update Repo Agent Service Health Resolver

**File**: `/services/repo-agent-service/src/resolvers/queries/health.ts`

```typescript
// Update the resolver name
export const repoAgentHealthResolver = {
  repoAgentHealth: async (_: any, __: any, { logger }: GraphQLContext) => {
    try {
      const gitVersion = await getGitVersion();
      const repoCount = await getRepositoryCount();
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        details: {
          repositoryCount: repoCount,
          gitVersion,
          system: {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            freeMemory: os.freemem(),
            totalMemory: os.totalmem()
          }
        }
      };
    } catch (error) {
      logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        details: {
          repositoryCount: 0,
          gitVersion: 'unknown',
          system: {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            freeMemory: 0,
            totalMemory: 0
          }
        }
      };
    }
  }
};
```

### Step 2.3: Update Resolver Index Files

**Claude Service** - `/services/claude-service/src/resolvers/queries/index.ts`:
```typescript
export { sessionsResolver } from './sessions';
export { sessionResolver } from './session';
export { claudeHealthResolver } from './health';  // Changed from healthResolver
export { performanceMetricsResolver } from './performanceMetrics';
```

**Repo Agent Service** - `/services/repo-agent-service/src/resolvers/queries/index.ts`:
```typescript
export { repoAgentHealthResolver } from './health';  // Changed from healthResolver
export { gitStatusResolver } from './gitStatus';
// ... other exports
```

## Phase 3: Update Gateway Cache Configuration

**File**: `/services/meta-gothic-app/src/gateway.ts`

Update the TTL configuration to use new type names:

```typescript
ttlPerType: {
  // Claude types
- Claude_Health: 5000,
+ Claude_ClaudeHealthStatus: 5000,
  Claude_Session: 60000,
  Claude_AgentRun: 30000,
  
  // Repo types
+ Repo_RepoAgentHealthStatus: 5000,
  Repo_GitStatus: 30000,
  Repo_Repository: 60000,
  Repo_Commit: 300000,
  
  // GitHub types
  GitHubUser: 300000,
  GitHubRepository: 60000,
  GitHubWorkflowRun: 10000,
},
```

## Phase 4: Update Client Queries

### Step 4.1: Update Health Check Queries

Any client code that queries health endpoints needs updating:

**Before:**
```graphql
query HealthCheck {
  health {
    healthy
    version
  }
}
```

**After:**
```graphql
query ServiceHealthCheck {
  claudeHealth {
    healthy
    version
    claudeAvailable
  }
  
  repoAgentHealth {
    status
    version
  }
}
```

### Step 4.2: Update Monitoring/Dashboard Code

Update any monitoring dashboards or health check scripts:

```typescript
// Example monitoring script update
async function checkServices() {
  const query = `
    query SystemHealth {
      claudeHealth {
        healthy
        claudeAvailable
        activeSessions
      }
      
      repoAgentHealth {
        status
        details {
          repositoryCount
          gitVersion
        }
      }
    }
  `;
  
  const result = await graphqlClient.request(query);
  
  return {
    claude: result.claudeHealth.healthy && result.claudeHealth.claudeAvailable,
    repoAgent: result.repoAgentHealth.status === 'healthy',
    overall: result.claudeHealth.healthy && result.repoAgentHealth.status === 'healthy'
  };
}
```

## Phase 5: Testing

### Step 5.1: Unit Tests

Update resolver tests to use new query names:

```typescript
// Claude service test
describe('claudeHealth resolver', () => {
  it('should return health status', async () => {
    const result = await resolvers.Query.claudeHealth(null, {}, mockContext);
    expect(result).toHaveProperty('healthy');
    expect(result).toHaveProperty('claudeAvailable');
  });
});

// Repo agent service test
describe('repoAgentHealth resolver', () => {
  it('should return health status', async () => {
    const result = await resolvers.Query.repoAgentHealth(null, {}, mockContext);
    expect(result).toHaveProperty('status');
    expect(result.status).toBe('healthy');
  });
});
```

### Step 5.2: Integration Tests

Test the gateway with all services running:

```bash
# Start all services
npm run start-yoga-services

# Test unified health query
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ claudeHealth { healthy } repoAgentHealth { status } }"
  }'
```

### Step 5.3: GraphQL Playground Testing

1. Open http://localhost:3000/graphql
2. Run the introspection query to verify new field names
3. Test health queries:

```graphql
query TestNewHealthQueries {
  claudeHealth {
    healthy
    version
    claudeAvailable
    claudeVersion
    activeSessions
    resources {
      memoryUsage
      cpuUsage
      activeProcesses
    }
  }
  
  repoAgentHealth {
    status
    timestamp
    version
    details {
      repositoryCount
      gitVersion
      system {
        platform
        nodeVersion
      }
    }
  }
}
```

## Phase 6: Deployment

### Step 6.1: Deployment Order

1. **Deploy Services First**: Deploy claude-service and repo-agent-service with new schemas
2. **Verify Services**: Ensure services are healthy with new endpoints
3. **Deploy Gateway**: Deploy updated gateway (no changes needed if using stitching)
4. **Update Clients**: Deploy any client applications with updated queries

### Step 6.2: Rollback Plan

If issues occur:

1. **Quick Rollback**: Revert service deployments to previous version
2. **Temporary Alias**: Add resolver aliases at service level:
   ```typescript
   resolvers: {
     Query: {
       claudeHealth: healthResolver,
       health: healthResolver  // Temporary backward compatibility
     }
   }
   ```

## Phase 7: Documentation Updates

### Update API Documentation

1. Update GraphQL schema documentation
2. Update API usage examples
3. Update monitoring setup guides

### Update README Files

**Service READMEs:**
```markdown
## Health Check

Query the service health:

\```graphql
query {
  claudeHealth {  # Changed from 'health'
    healthy
    claudeAvailable
  }
}
\```
```

## Migration Timeline

### Day 1: Development
- Morning: Update schemas and resolvers
- Afternoon: Update tests and documentation

### Day 2: Testing
- Morning: Run integration tests
- Afternoon: Test with monitoring tools

### Day 3: Deployment
- Morning: Deploy to staging
- Afternoon: Monitor and verify
- Evening: Deploy to production

## Success Criteria

1. ✅ No GraphQL schema conflicts in gateway logs
2. ✅ All health endpoints return expected data
3. ✅ Monitoring dashboards show all services
4. ✅ No client errors from health queries
5. ✅ GraphQL introspection shows unique field names

## Long-term Benefits

1. **Clear Service Identification**: Query names indicate which service
2. **No Naming Conflicts**: Eliminated current and future collisions  
3. **Better Monitoring**: Can query specific service health
4. **Federation Ready**: Clean names if migrating to Federation later
5. **Developer Experience**: Clear, self-documenting API