# Service Architecture Guide

This guide documents the service architecture, patterns, and conventions used in the Meta GOTHIC Framework.

## Service Overview

### Core Services

#### Claude Service (Port 3002)
**Purpose**: AI agent operations and session management

**Key Features**:
- Claude AI integration for code analysis
- Session management with pre-warming
- Command execution in isolated environments
- Real-time output streaming via SSE
- Intelligent context management

**Entities**:
- `ClaudeSession`: Active AI sessions
- `AgentRun`: Execution history and artifacts
- `CommandExecution`: Shell command results

#### Git Service (Port 3004)
**Purpose**: Git repository operations and file system management

**Key Features**:
- Repository scanning and status
- Commit and push operations
- File change detection
- Branch management
- Submodule handling

**Entities**:
- `Repository`: Git repository metadata
- `GitStatus`: Current repository state
- `CommitInfo`: Commit history and details

#### GitHub Adapter (Port 3005)
**Purpose**: GitHub API integration and webhook handling

**Key Features**:
- Repository information
- Workflow management
- Issue and PR operations
- GitHub GraphQL API proxy
- Webhook event processing

**Entities**:
- `GitHubRepository`: GitHub repo metadata
- `Workflow`: GitHub Actions workflows
- `PullRequest`: PR information

### Service Communication

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
┌──────▼──────┐     ┌─────────────┐     ┌─────────────┐
│    Router   │────▶│  Services   │────▶│  External   │
│  (Gateway)  │     │             │     │    APIs     │
└─────────────┘     └─────────────┘     └─────────────┘
       │
┌──────▼──────┐
│   Events    │
│    (SSE)    │
└─────────────┘
```

## Shared Patterns

### Health Checks

All services implement a standardized health check:

```typescript
// Shared health status type
type ServiceHealthStatus {
  status: String!        // "ok" | "degraded" | "error"
  timestamp: String!     // ISO 8601 timestamp
  service: String!       // Service identifier
  version: String!       // Service version
  uptime: Float!        // Seconds since start
  memoryUsage: MemoryUsage
  errorCount: Int       // Recent errors (optional)
  activeRequests: Int   // Current load (optional)
}

// Implementation
const health = {
  status: errorCount > 10 ? 'degraded' : 'ok',
  timestamp: new Date().toISOString(),
  service: 'claude-service',
  version: process.env.npm_package_version || '1.0.0',
  uptime: process.uptime(),
  memoryUsage: getMemoryUsage(),
  errorCount: recentErrors.length,
  activeRequests: activeRequests.size,
};
```

### Logging

Standardized logging across all services:

```typescript
import { createLogger } from '@chasenocap/logger';

const logger = createLogger('service-name');

// Log levels
logger.debug('Detailed information', { data });
logger.info('General information', { action });
logger.warn('Warning condition', { issue });
logger.error('Error occurred', { error, context });

// Structured logging
logger.info('Request processed', {
  requestId,
  userId,
  duration: Date.now() - startTime,
  status: 'success',
});
```

### Error Handling

Consistent error format:

```typescript
// Base error class
export class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

// Common error types
export class ValidationError extends ServiceError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class NotFoundError extends ServiceError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}

export class UnauthorizedError extends ServiceError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}
```

### Context Pattern

All services use a consistent context pattern:

```typescript
export interface ServiceContext {
  // Authentication
  user?: User;
  isAuthenticated: boolean;
  
  // Logging
  logger: Logger;
  requestId: string;
  
  // Data sources
  dataSources: {
    [key: string]: DataSource;
  };
  
  // Service info
  serviceName: string;
  serviceVersion: string;
}

export function createContext(req: Request): ServiceContext {
  return {
    user: req.user,
    isAuthenticated: !!req.user,
    logger: createLogger('service-name'),
    requestId: req.headers['x-request-id'] || generateId(),
    dataSources: createDataSources(),
    serviceName: 'service-name',
    serviceVersion: '1.0.0',
  };
}
```

## Service-Specific Patterns

### Claude Service Patterns

#### Session Management
```typescript
// Pre-warmed sessions for faster startup
class PreWarmSessionManager {
  private pool: SessionPool;
  
  async getSession(): Promise<ClaudeSession> {
    return this.pool.acquire() || this.createNewSession();
  }
  
  async releaseSession(session: ClaudeSession) {
    if (session.isHealthy()) {
      this.pool.release(session);
    } else {
      await session.cleanup();
    }
  }
}
```

#### Context Window Management
```typescript
// Smart context management
class SmartContextManager {
  async optimizeContext(
    files: string[],
    query: string
  ): Promise<string[]> {
    // Rank files by relevance
    const ranked = await this.rankByRelevance(files, query);
    
    // Fit within token limit
    return this.fitWithinLimit(ranked, MAX_TOKENS);
  }
}
```

### Git Service Patterns

#### Repository Scanning
```typescript
// Efficient repository discovery
async function scanRepositories(
  rootPath: string
): Promise<Repository[]> {
  const repos = [];
  
  // Parallel scanning with worker threads
  const workers = createWorkerPool(4);
  const directories = await fs.readdir(rootPath);
  
  await Promise.all(
    directories.map(dir =>
      workers.execute('scanDirectory', { path: dir })
    )
  );
  
  return repos;
}
```

#### Batch Operations
```typescript
// Batch git operations
async function batchCommit(
  repositories: string[],
  message: string
): Promise<BatchResult> {
  const results = await Promise.allSettled(
    repositories.map(repo =>
      commitRepository(repo, message)
    )
  );
  
  return {
    successful: results.filter(r => r.status === 'fulfilled'),
    failed: results.filter(r => r.status === 'rejected'),
  };
}
```

### GitHub Adapter Patterns

#### API Rate Limiting
```typescript
// GitHub API rate limit handling
class GitHubClient {
  private rateLimiter = new RateLimiter({
    maxRequests: 5000,
    window: '1h',
  });
  
  async request(query: string) {
    await this.rateLimiter.acquire();
    
    try {
      return await this.client.request(query);
    } catch (error) {
      if (error.status === 429) {
        await this.handleRateLimit(error);
        return this.request(query); // Retry
      }
      throw error;
    }
  }
}
```

## Event System

### Event Bus Architecture

```typescript
// Shared event types
export enum EventType {
  // Session events
  SESSION_STARTED = 'session.started',
  SESSION_ENDED = 'session.ended',
  COMMAND_EXECUTED = 'command.executed',
  
  // Git events
  REPOSITORY_CHANGED = 'repository.changed',
  COMMIT_CREATED = 'commit.created',
  
  // GitHub events
  WEBHOOK_RECEIVED = 'webhook.received',
  WORKFLOW_TRIGGERED = 'workflow.triggered',
}

// Event emitter pattern
class ServiceEventBus extends EventEmitter {
  emit(event: EventType, data: any) {
    this.logger.debug('Event emitted', { event, data });
    super.emit(event, data);
  }
}
```

### SSE Event Streaming

```typescript
// Stream events to clients
async function* streamEvents(
  sessionId: string
): AsyncGenerator<Event> {
  const queue = new EventQueue();
  
  // Subscribe to events
  eventBus.on('command.output', (data) => {
    if (data.sessionId === sessionId) {
      queue.push(data);
    }
  });
  
  // Yield events
  while (true) {
    const event = await queue.take();
    yield event;
  }
}
```

## Performance Patterns

### Caching

```typescript
// Service-level caching
const cache = new SimpleCache<string, any>({
  ttl: 300, // 5 minutes
  maxSize: 1000,
});

// Decorator pattern
@Cacheable({ ttl: 300 })
async function expensiveOperation(id: string) {
  return await database.complexQuery(id);
}
```

### Connection Pooling

```typescript
// Database connection pooling
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// HTTP connection reuse
const httpAgent = new Agent({
  keepAlive: true,
  maxSockets: 50,
});
```

## Security Patterns

### Input Validation

```typescript
// Zod schemas for validation
import { z } from 'zod';

const CreateSessionSchema = z.object({
  projectPath: z.string().min(1),
  instruction: z.string().min(1).max(10000),
  model: z.enum(['claude-3-opus', 'claude-3-sonnet']),
});

// In resolver
const validated = CreateSessionSchema.parse(input);
```

### Authorization

```typescript
// Field-level authorization
const resolvers = {
  Query: {
    sensitiveData: async (parent, args, context) => {
      if (!context.user?.hasPermission('read:sensitive')) {
        throw new UnauthorizedError('Insufficient permissions');
      }
      return getSensitiveData();
    },
  },
};
```

## Monitoring and Observability

### Metrics Collection

```typescript
// Service metrics
interface ServiceMetrics {
  requestCount: Counter;
  requestDuration: Histogram;
  errorCount: Counter;
  activeConnections: Gauge;
}

// Collect metrics
metrics.requestDuration.observe(
  { method: 'createSession', status: 'success' },
  duration
);
```

### Health Monitoring

```typescript
// Automated health checks
class HealthMonitor {
  async checkHealth(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkExternalAPIs(),
      this.checkMemoryUsage(),
    ]);
    
    return {
      status: this.calculateOverallStatus(checks),
      checks: this.formatChecks(checks),
    };
  }
}
```

## Development Guidelines

### Service Creation Checklist

- [ ] Implement health endpoint
- [ ] Set up structured logging
- [ ] Add error handling
- [ ] Create GraphQL schema
- [ ] Implement resolvers
- [ ] Add SSE support (if needed)
- [ ] Configure in router
- [ ] Add to PM2 ecosystem
- [ ] Document in this guide
- [ ] Add monitoring

### Testing Strategy

```typescript
// Unit tests for business logic
describe('SessionManager', () => {
  it('should create new session', async () => {
    const session = await manager.createSession(config);
    expect(session.id).toBeDefined();
  });
});

// Integration tests for GraphQL
describe('Mutations', () => {
  it('should execute createSession mutation', async () => {
    const result = await graphql({
      schema,
      query: CREATE_SESSION,
      variables: { input },
    });
    expect(result.errors).toBeUndefined();
  });
});
```

### Deployment Considerations

1. **Environment Variables**
   - Use `.env` files for local development
   - Document all required variables
   - Provide sensible defaults

2. **Resource Limits**
   - Set memory limits in PM2
   - Configure connection pools
   - Implement circuit breakers

3. **Graceful Shutdown**
   ```typescript
   process.on('SIGTERM', async () => {
     logger.info('Shutting down gracefully');
     await server.close();
     await cleanup();
     process.exit(0);
   });
   ```

## References

- [ADR-Federation-Architecture.md](./ADR-Federation-Architecture.md)
- [federation-implementation-guide.md](./federation-implementation-guide.md)
- [backlog.md](./backlog.md)