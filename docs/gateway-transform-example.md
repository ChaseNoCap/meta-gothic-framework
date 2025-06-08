# Gateway-Level Transform Implementation Example

## Overview

This document provides a complete code example for implementing health query renaming at the gateway level using GraphQL Tools transforms, as an alternative to modifying service schemas.

## Implementation

### Updated gateway.ts with Field Transforms

```typescript
import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { stitchSchemas } from '@graphql-tools/stitch';
import { schemaFromExecutor } from '@graphql-tools/wrap';
import { buildHTTPExecutor } from '@graphql-tools/executor-http';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { RenameTypes, RenameRootFields } from '@graphql-tools/wrap';
import { createLogger } from '@chasenocap/logger';
// ... other imports

async function start() {
  logger.info('Starting Meta-GOTHIC GraphQL Gateway...');

  try {
    // Create executors for each service
    const claudeExecutor = buildHTTPExecutor({
      endpoint: 'http://127.0.0.1:3002/graphql',
      headers: (executorRequest) => {
        const context = executorRequest?.context as any;
        return context?.headers || {};
      },
    });

    const repoAgentExecutor = buildHTTPExecutor({
      endpoint: 'http://127.0.0.1:3004/graphql',
      headers: (executorRequest) => {
        const context = executorRequest?.context as any;
        return context?.headers || {};
      },
    });

    // Build subschemas with field renaming transforms
    const claudeSubschema = {
      schema: await schemaFromExecutor(claudeExecutor),
      executor: claudeExecutor,
      transforms: [
        // Rename the health query field
        new RenameRootFields((operation, fieldName, fieldConfig) => {
          if (operation === 'Query' && fieldName === 'health') {
            return 'claudeHealth';
          }
          return fieldName;
        }),
        // Also rename the return type to match
        new RenameTypes((name) => {
          if (name === 'HealthStatus') return 'ClaudeHealthStatus';
          if (['Query', 'Mutation', 'Subscription'].includes(name)) return name;
          return `Claude_${name}`;
        }),
      ],
    };

    const repoAgentSubschema = {
      schema: await schemaFromExecutor(repoAgentExecutor),
      executor: repoAgentExecutor,
      transforms: [
        // Rename the health query field
        new RenameRootFields((operation, fieldName, fieldConfig) => {
          if (operation === 'Query' && fieldName === 'health') {
            return 'repoAgentHealth';
          }
          return fieldName;
        }),
        // Also rename the return type to match
        new RenameTypes((name) => {
          if (name === 'Health') return 'RepoAgentHealthStatus';
          if (name === 'HealthDetails') return 'RepoHealthDetails';
          if (['Query', 'Mutation', 'Subscription'].includes(name)) return name;
          return `Repo_${name}`;
        }),
      ],
    };

    // Create GitHub schema (no changes needed)
    const githubTypeDefs = `
      # ... existing GitHub types ...
    `;

    const githubResolvers = createGitHubResolvers(GITHUB_TOKEN);
    const githubSchema = makeExecutableSchema({
      typeDefs: githubTypeDefs,
      resolvers: githubResolvers,
    });

    // Optional: Add a unified health query
    const healthAggregationTypeDefs = `
      type ServiceHealth {
        name: String!
        healthy: Boolean!
        endpoint: String!
        version: String
        message: String
      }

      type SystemHealth {
        healthy: Boolean!
        services: [ServiceHealth!]!
        timestamp: String!
        uptime: Float!
      }

      extend type Query {
        """Unified system health check across all services"""
        systemHealth: SystemHealth!
      }
    `;

    const healthAggregationResolvers = {
      Query: {
        systemHealth: async (_, __, context) => {
          const results = [];
          
          try {
            // Query Claude service health using renamed field
            const claudeHealth = await context.claudeService.request(`
              query { 
                health { 
                  healthy 
                  version 
                  claudeAvailable 
                } 
              }
            `);
            
            results.push({
              name: 'claude-service',
              healthy: claudeHealth.data?.health?.healthy || false,
              endpoint: 'http://localhost:3002',
              version: claudeHealth.data?.health?.version,
              message: claudeHealth.data?.health?.claudeAvailable 
                ? 'Claude CLI available' 
                : 'Claude CLI not available'
            });
          } catch (error) {
            results.push({
              name: 'claude-service',
              healthy: false,
              endpoint: 'http://localhost:3002',
              message: `Error: ${error.message}`
            });
          }

          try {
            // Query Repo Agent service health using renamed field
            const repoHealth = await context.repoService.request(`
              query { 
                health { 
                  status 
                  version 
                  details { 
                    gitVersion 
                  } 
                } 
              }
            `);
            
            results.push({
              name: 'repo-agent-service',
              healthy: repoHealth.data?.health?.status === 'healthy',
              endpoint: 'http://localhost:3004',
              version: repoHealth.data?.health?.version,
              message: `Git ${repoHealth.data?.health?.details?.gitVersion || 'unknown'}`
            });
          } catch (error) {
            results.push({
              name: 'repo-agent-service',
              healthy: false,
              endpoint: 'http://localhost:3004',
              message: `Error: ${error.message}`
            });
          }

          // GitHub is always "healthy" if we can reach it
          results.push({
            name: 'github-api',
            healthy: !!GITHUB_TOKEN,
            endpoint: 'https://api.github.com',
            message: GITHUB_TOKEN ? 'Authenticated' : 'No token provided'
          });

          return {
            healthy: results.every(r => r.healthy),
            services: results,
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
          };
        }
      }
    };

    const healthAggregationSchema = makeExecutableSchema({
      typeDefs: healthAggregationTypeDefs,
      resolvers: healthAggregationResolvers,
    });

    // Stitch all schemas together
    const gatewaySchema = stitchSchemas({
      subschemas: [
        claudeSubschema,
        repoAgentSubschema,
        { schema: githubSchema },
        { schema: healthAggregationSchema }
      ],
    });

    // Update cache configuration with new type names
    if (ENABLE_CACHE) {
      try {
        const { useResponseCache } = await import('@graphql-yoga/plugin-response-cache');
        plugins.push(
          useResponseCache({
            session: () => null,
            ttl: 5000,
            ttlPerType: {
              // Updated type names after transformation
              ClaudeHealthStatus: 5000,
              Claude_Session: 60000,
              Claude_AgentRun: 30000,
              
              RepoAgentHealthStatus: 5000,
              Repo_GitStatus: 30000,
              Repo_Repository: 60000,
              Repo_Commit: 300000,
              
              GitHubUser: 300000,
              GitHubRepository: 60000,
              GitHubWorkflowRun: 10000,
              
              SystemHealth: 2000,
              ServiceHealth: 2000
            },
          })
        );
      } catch (error) {
        logger.warn('Could not enable response caching', { error });
      }
    }

    // ... rest of gateway setup
  } catch (error) {
    logger.error('Failed to start gateway', error as Error);
    process.exit(1);
  }
}
```

## Query Examples After Transformation

### Individual Service Health Checks

```graphql
# Check Claude service health
query ClaudeHealthCheck {
  claudeHealth {
    healthy
    version
    claudeAvailable
    claudeVersion
    activeSessions
    resources {
      memoryUsage
      cpuUsage
    }
  }
}

# Check Repo Agent service health
query RepoHealthCheck {
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

### Combined Health Check

```graphql
query CombinedHealthCheck {
  # Individual service health
  claudeHealth {
    healthy
    claudeAvailable
  }
  
  repoAgentHealth {
    status
  }
  
  # Aggregated system health
  systemHealth {
    healthy
    uptime
    services {
      name
      healthy
      message
    }
  }
}
```

## Testing the Transform

### 1. Verify Field Renaming

```bash
# Start services with original schemas
npm run start-yoga-services

# Query the gateway to see renamed fields
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ __schema { queryType { fields { name } } } }"
  }' | jq '.data.__schema.queryType.fields[] | select(.name | contains("Health"))'
```

Expected output should show:
- `claudeHealth`
- `repoAgentHealth`
- `systemHealth`

But NOT `health` (the collision is resolved).

### 2. Test Renamed Queries

```javascript
// Test script
const { request } = require('graphql-request');

async function testHealthQueries() {
  const endpoint = 'http://localhost:4000/graphql';
  
  try {
    // This should work - uses renamed fields
    const result = await request(endpoint, `{
      claudeHealth {
        healthy
        version
      }
      repoAgentHealth {
        status
        version
      }
    }`);
    
    console.log('✅ Health queries successful:', result);
  } catch (error) {
    console.error('❌ Health query failed:', error);
  }
  
  try {
    // This should fail - original field name
    const result = await request(endpoint, `{
      health {
        healthy
      }
    }`);
    
    console.log('❌ Original health query should have failed but didn\'t');
  } catch (error) {
    console.log('✅ Original health query correctly failed');
  }
}

testHealthQueries();
```

## Advantages of Gateway Transform

1. **No Service Changes**: Services remain unchanged
2. **Centralized Logic**: All renaming logic in one place
3. **Easy Rollback**: Just remove transforms to revert
4. **Flexible**: Can add more complex transformations

## Disadvantages

1. **Hidden Complexity**: Field names differ from service schemas
2. **Debugging Harder**: Mismatch between service and gateway
3. **Documentation**: Must document the transformations
4. **Performance**: Slight overhead from transforms

## Recommendation

While this gateway-level approach works, **modifying the service schemas directly is still recommended** for:
- Better clarity and maintainability
- Easier debugging
- Self-documenting schemas
- No hidden transformations

Use gateway transforms only when:
- You cannot modify service schemas
- Services are third-party or legacy
- Temporary fix while planning service updates
- Complex schema migrations