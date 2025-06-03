# Logging Setup Guide

## Quick Start

### 1. Add Infrastructure Packages
```bash
# Add as Git submodules
git submodule add https://github.com/ChaseNoCap/logger packages/logger
git submodule add https://github.com/ChaseNoCap/cache packages/cache
git submodule add https://github.com/ChaseNoCap/event-system packages/event-system
git submodule add https://github.com/ChaseNoCap/file-system packages/file-system

# Install dependencies
cd packages/logger && npm install && npm run build
cd ../cache && npm install && npm run build
cd ../event-system && npm install && npm run build
cd ../file-system && npm install && npm run build
```

### 2. Create Log Directory Structure
```bash
# Create organized log directories
mkdir -p logs/{services/{claude-service,repo-agent-service,gateway},graphql/{queries,mutations,subscriptions},ai-operations/{claude-sessions,commit-generation,token-usage},performance/traces,audit}

# Create .gitignore for logs
echo "*" > logs/.gitignore
echo "!.gitignore" >> logs/.gitignore
echo "!README.md" >> logs/.gitignore
```

### 3. Configure Service Logging

#### Gateway Logger Setup
```typescript
// services/meta-gothic-app/src/gateway.ts
import { createLogger } from '@chasenocap/logger';

const logger = createLogger({
  service: 'gateway',
  logDir: path.join(process.cwd(), 'logs/services/gateway'),
  level: process.env.LOG_LEVEL || 'info',
  enableFileLogging: process.env.NODE_ENV !== 'test',
  dailyRotate: {
    maxFiles: '30d',
    maxSize: '20m'
  }
});

// Add correlation ID middleware
app.use((req, res, next) => {
  req.correlationId = generateId();
  req.logger = logger.child({ correlationId: req.correlationId });
  req.logger.info('Request started', {
    method: req.method,
    path: req.path,
    headers: req.headers
  });
  next();
});
```

#### Claude Service Logger
```typescript
// services/claude-service/src/index-yoga.ts
import { createLogger } from '@chasenocap/logger';

const logger = createLogger({
  service: 'claude-service',
  logDir: path.join(process.cwd(), '../../logs/services/claude-service'),
  additionalTransports: [
    // Special transport for AI operations
    new winston.transports.DailyRotateFile({
      filename: 'ai-operations-%DATE%.log',
      dirname: path.join(process.cwd(), '../../logs/ai-operations'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});
```

### 4. Add Event Tracking

```typescript
// services/claude-service/src/resolvers/mutations/executeCommand.ts
import { Emits, EventBus } from '@chasenocap/event-system';

class ClaudeMutations {
  constructor(private eventBus: EventBus) {}

  @Emits('claude.session.started', 'claude.session.completed', 'claude.session.failed')
  async executeCommand(input: ClaudeExecuteInput, context: Context) {
    const startTime = Date.now();
    const { logger } = context;
    
    logger.info('Claude command execution started', {
      sessionId: input.sessionId,
      command: input.command,
      workingDirectory: input.workingDirectory
    });

    try {
      const result = await this.claudeService.execute(input);
      
      logger.info('Claude command completed', {
        sessionId: input.sessionId,
        duration: Date.now() - startTime,
        tokenUsage: result.tokenUsage,
        success: true
      });
      
      return result;
    } catch (error) {
      logger.error('Claude command failed', {
        sessionId: input.sessionId,
        duration: Date.now() - startTime,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}
```

### 5. Add Caching with Logging

```typescript
// services/repo-agent-service/src/resolvers/queries/gitStatus.ts
import { Cacheable, InvalidateCache } from '@chasenocap/cache';

class RepoQueries {
  @Cacheable({ 
    ttl: 60000, 
    key: (args) => args.path,
    onHit: (key) => logger.debug('Cache hit', { operation: 'gitStatus', key }),
    onMiss: (key) => logger.debug('Cache miss', { operation: 'gitStatus', key })
  })
  async gitStatus(path: string, context: Context) {
    const { logger } = context;
    logger.info('Fetching git status', { path });
    
    const status = await git.status(path);
    
    logger.info('Git status fetched', {
      path,
      isDirty: status.isDirty,
      fileCount: status.files.length
    });
    
    return status;
  }
}
```

### 6. Performance Tracking

```typescript
import { Traces } from '@chasenocap/event-system';

class ExpensiveOperations {
  @Traces({ 
    slowThreshold: 1000,
    onSlow: (duration, args) => {
      logger.warn('Slow operation detected', {
        operation: 'generateCommitMessages',
        duration,
        args
      });
    }
  })
  async generateCommitMessages(input: BatchCommitMessageInput) {
    // Operation implementation
  }
}
```

## Log Analysis Commands

### Query by Correlation ID
```bash
# Find all logs for a specific request
find logs -name "*.log" -type f -exec grep -l "correlationId.*abc123" {} \; | xargs cat | jq

# Get request timeline
grep -r "correlationId.*abc123" logs/ | sort -k1,1 | jq -s 'sort_by(.timestamp)'
```

### Monitor AI Operations
```bash
# Watch Claude sessions in real-time
tail -f logs/ai-operations/claude-sessions/*.log | jq

# Calculate daily token usage
cat logs/ai-operations/token-usage/$(date +%Y-%m-%d)-summary.json | jq '.totalTokens'

# Find slow AI operations
jq 'select(.duration > 5000 and .operation == "claude.execute")' logs/performance/*.json
```

### Performance Analysis
```bash
# Find slowest GraphQL queries
jq 'select(.type == "graphql.query" and .duration > 100)' logs/graphql/queries/**/*.json | jq -s 'sort_by(.duration) | reverse | .[0:10]'

# Cache hit rate
echo "scale=2; $(grep -c "Cache hit" logs/services/*/app-*.log) / $(grep -c "Cache.*" logs/services/*/app-*.log) * 100" | bc
```

## Production Considerations

1. **Log Shipping**: Configure rsyslog or Fluentd to ship logs to centralized storage
2. **Monitoring**: Set up alerts for error rates and performance degradation
3. **Security**: Ensure sensitive data is not logged (API keys, passwords)
4. **Compliance**: Implement log retention policies based on requirements
5. **Performance**: Use async logging to prevent blocking operations