# Health Query Collision Solution

## Problem Analysis

The meta-gothic-framework currently has a naming collision where both the Claude service and Repo Agent service define a `health` query at the root Query type:

```graphql
# Claude Service
type Query {
  health: HealthStatus!  # Different return type
}

# Repo Agent Service
type Query {
  health: Health!  # Different return type
}
```

When schema stitching combines these schemas, it cannot resolve which `health` query to use, causing potential conflicts or unexpected behavior.

## Current Gateway Behavior

The gateway attempts to handle type conflicts by prefixing type names:

```typescript
// Prefixes Claude types with "Claude_"
new RenameTypes((name) => {
  if (['Query', 'Mutation', 'Subscription'].includes(name)) return name;
  return `Claude_${name}`;
}),

// Prefixes Repo types with "Repo_"
new RenameTypes((name) => {
  if (['Query', 'Mutation', 'Subscription'].includes(name)) return name;
  return `Repo_${name}`;
}),
```

However, this only renames **types**, not **fields** on the root Query type, so the `health` field collision remains.

## Proposed Solutions

### Solution 1: Service-Level Field Renaming (Recommended)

The cleanest solution is to rename the health queries at the service level to be unique and descriptive:

**Claude Service Schema:**
```graphql
type Query {
  """Check Claude service health and availability"""
  claudeHealth: ClaudeHealthStatus!
  
  # ... other queries
}

type ClaudeHealthStatus {
  """Whether service is healthy"""
  healthy: Boolean!
  
  """Service version"""
  version: String!
  
  """Claude CLI availability"""
  claudeAvailable: Boolean!
  
  # ... other fields
}
```

**Repo Agent Service Schema:**
```graphql
type Query {
  """Check Repo Agent service health"""
  repoAgentHealth: RepoAgentHealthStatus!
  
  # ... other queries
}

type RepoAgentHealthStatus {
  """Service health status"""
  status: String!
  
  """Current timestamp"""
  timestamp: String!
  
  """Service version"""
  version: String
  
  # ... other fields
}
```

### Solution 2: Gateway-Level Field Transformation

If modifying service schemas is not desired, use field-level transforms at the gateway:

```typescript
import { RenameRootFields } from '@graphql-tools/wrap';

const claudeSubschema = {
  schema: await schemaFromExecutor(claudeExecutor),
  executor: claudeExecutor,
  transforms: [
    // Rename root fields
    new RenameRootFields(
      (operation, fieldName) => {
        if (operation === 'Query' && fieldName === 'health') {
          return 'claudeHealth';
        }
        return fieldName;
      }
    ),
    // Keep type prefixing
    new RenameTypes((name) => {
      if (['Query', 'Mutation', 'Subscription'].includes(name)) return name;
      return `Claude_${name}`;
    }),
  ],
};

const repoAgentSubschema = {
  schema: await schemaFromExecutor(repoAgentExecutor),
  executor: repoAgentExecutor,
  transforms: [
    // Rename root fields
    new RenameRootFields(
      (operation, fieldName) => {
        if (operation === 'Query' && fieldName === 'health') {
          return 'repoAgentHealth';
        }
        return fieldName;
      }
    ),
    // Keep type prefixing
    new RenameTypes((name) => {
      if (['Query', 'Mutation', 'Subscription'].includes(name)) return name;
      return `Repo_${name}`;
    }),
  ],
};
```

### Solution 3: Unified Health Query (Alternative)

Create a unified health query at the gateway level that aggregates all service health:

```typescript
// In gateway.ts, add to githubTypeDefs
const githubTypeDefs = `
  # ... existing types ...
  
  type ServiceHealth {
    name: String!
    healthy: Boolean!
    endpoint: String!
    version: String
    details: JSON
  }
  
  type SystemHealth {
    overall: Boolean!
    services: [ServiceHealth!]!
    timestamp: String!
  }
  
  extend type Query {
    # ... existing queries ...
    systemHealth: SystemHealth!
  }
`;

// Add resolver
const githubResolvers = {
  Query: {
    // ... existing resolvers ...
    systemHealth: async (_, __, { dataSources }) => {
      const [claudeHealth, repoHealth] = await Promise.all([
        dataSources.claude.query('{ health { healthy version claudeAvailable } }'),
        dataSources.repo.query('{ health { status version } }')
      ]);
      
      return {
        overall: claudeHealth.healthy && repoHealth.status === 'healthy',
        services: [
          {
            name: 'claude-service',
            healthy: claudeHealth.healthy,
            endpoint: 'http://localhost:3002',
            version: claudeHealth.version,
            details: claudeHealth
          },
          {
            name: 'repo-agent-service', 
            healthy: repoHealth.status === 'healthy',
            endpoint: 'http://localhost:3004',
            version: repoHealth.version,
            details: repoHealth
          }
        ],
        timestamp: new Date().toISOString()
      };
    }
  }
};
```

## Recommended Approach

**Solution 1 (Service-Level Renaming)** is recommended because:

1. **Clarity**: Field names clearly indicate which service they belong to
2. **Simplicity**: No complex gateway transformations needed
3. **Discoverability**: GraphQL introspection shows clear, descriptive names
4. **Maintainability**: Easier to understand and debug
5. **Future-Proof**: Works well if migrating to Federation later

## Implementation Benefits

### Before (Collision):
```graphql
query {
  health {  # Which service? Unclear!
    ...
  }
}
```

### After (Clear Naming):
```graphql
query {
  claudeHealth {
    healthy
    claudeAvailable
    activeSessions
  }
  
  repoAgentHealth {
    status
    gitVersion
    repositoryCount
  }
}
```

## Query Examples

### Check All Service Health
```graphql
query CheckAllServices {
  claudeHealth {
    healthy
    version
    claudeAvailable
    activeSessions
  }
  
  repoAgentHealth {
    status
    version
    details {
      repositoryCount
      gitVersion
    }
  }
  
  # GitHub doesn't need health - it's external
}
```

### Monitor Critical Services
```graphql
query MonitorCritical {
  claude: claudeHealth {
    healthy
    claudeAvailable
  }
  
  repo: repoAgentHealth {
    status
  }
}
```

## Best Practices for Future Queries

To avoid similar collisions:

1. **Prefix Service-Specific Queries**: Use service name prefixes for clarity
   - `claudeSessions`, `claudeExecuteCommand`
   - `repoGitStatus`, `repoScanRepositories`

2. **Use Descriptive Names**: Avoid generic names like `status`, `info`, `data`

3. **Document Query Purpose**: Use GraphQL descriptions to clarify intent

4. **Consider Namespacing**: Group related queries under namespace types:
   ```graphql
   type Query {
     claude: ClaudeQueries!
     repo: RepoQueries!
     github: GitHubQueries!
   }
   ```

This approach prevents all naming collisions but requires more complex client queries.