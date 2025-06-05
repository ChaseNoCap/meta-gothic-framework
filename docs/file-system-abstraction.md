# File System Abstraction Implementation

## Overview

We've implemented a comprehensive file system abstraction layer across the metaGOTHIC framework, replacing all direct `fs` and `path` module usage with the `IFileSystem` interface from `@chasenocap/file-system`.

## Architecture

### Core Components

1. **IFileSystem Interface** - Standard interface for all file operations
2. **NodeFileSystem** - Node.js implementation of IFileSystem  
3. **EventEmittingFileSystem** - Decorator that adds logging and event emission
4. **Shared File System Module** - Centralized access point for all services

### Shared Module Structure

```typescript
// services/shared/file-system/index.ts
export function getFileSystem(options?: {
  eventBus?: IEventBus;
  logger?: ILogger;
  correlationId?: string;
}): IFileSystem
```

- Returns basic NodeFileSystem when no options provided (for simple cases)
- Returns EventEmittingFileSystem wrapper when eventBus/logger provided
- Caches default instance for performance

## Implementation Details

### 1. Event-Emitting File System

The `EventEmittingFileSystem` wrapper adds:

- **Logging**: Debug/trace logs for all operations
- **Event Emission**: Events for file operations (read, write, delete, etc.)
- **Performance Tracking**: Duration metrics for each operation
- **Error Handling**: Consistent error logging and event emission

Events emitted:
- `file.read.completed` / `file.read.failed`
- `file.write.completed` / `file.write.failed`
- `file.delete.completed` / `file.delete.failed`
- `file.exists.checked`
- `file.directory.created` / `file.directory.create.failed`
- `file.directory.removed` / `file.directory.remove.failed`
- `file.directory.listed` / `file.directory.list.failed`
- `file.stats.retrieved`

### 2. Service Updates

All services now use the file system abstraction:

#### Claude Service
- **RunStorage**: File-based storage for agent runs
  - Uses event-emitting file system for all file operations
  - Logs all storage operations
  - Emits events for monitoring

- **index-yoga.ts**: Schema loading and logger configuration
  - Uses file system for path operations
  - Consistent with other services

#### Repo Agent Service  
- **GitServiceWithEvents**: Repository scanning and path operations
  - Uses event-emitting file system
  - Integrates with existing event bus
  
- **submodules.ts**: Reading .gitmodules files
  - Uses event-emitting file system
  - Better error handling for file operations

- **scanAllRepositories.ts**: Directory traversal
  - Replaced fs.readdir with listDirectory
  - Uses isFile/isDirectory methods
  - Event emission for all operations

#### Meta Gothic App
- **gateway.ts**: Logger configuration
- **eventBus files**: Log directory path resolution

### 3. Benefits Achieved

1. **Testability**: All file operations can now be mocked
2. **Observability**: File operations emit events for monitoring
3. **Consistency**: Same interface across all services
4. **Performance**: Operations tracked with duration metrics
5. **Error Handling**: Centralized error handling and logging

## Usage Examples

### Basic Usage (No Events)
```typescript
import { getFileSystem } from '../shared/file-system/index.js';

const fileSystem = getFileSystem();
const content = await fileSystem.readFile('/path/to/file');
```

### With Events and Logging
```typescript
const fileSystem = getFileSystem({ 
  eventBus: context.eventBus,
  logger: context.logger,
  correlationId: context.correlationId
});

// This will:
// 1. Log the operation
// 2. Emit file.read.completed event
// 3. Track duration
const content = await fileSystem.readFile('/path/to/file');
```

### Service Integration
```typescript
export class GitServiceWithEvents {
  private fileSystem: IFileSystem;

  constructor(
    workspaceRoot: string,
    eventBus?: IEventBus,
    logger?: ILogger,
    correlationId?: string
  ) {
    this.fileSystem = getFileSystem({ eventBus, logger, correlationId });
  }

  async scanPath(path: string) {
    const fullPath = this.fileSystem.join(this.workspaceRoot, path);
    const exists = await this.fileSystem.exists(fullPath);
    // All operations logged and emit events
  }
}
```

## Event Monitoring

File system events can be monitored through the event logs:

```bash
# Count file operations
grep "file\." logs/events/*.log | wc -l

# View file read operations
jq 'select(.type | startswith("file.read"))' logs/events/*.json

# Monitor file operation performance
jq 'select(.type == "file.read.completed") | .payload.duration' logs/events/*.json
```

## Migration Checklist

✅ **Completed**:
- Replace all `fs` imports with file system abstraction
- Replace all `path` imports with file system methods
- Add event emission to file operations
- Update RunStorage to use abstraction
- Update GitServiceWithEvents 
- Update resolver queries
- Update index files
- Update eventBus files
- Create EventEmittingFileSystem wrapper
- Document implementation

## Future Enhancements

1. **Caching Layer**: Add caching for frequently read files
2. **Streaming Support**: Add streaming methods for large files
3. **Watch Support**: File watching with events
4. **Metrics Dashboard**: Visualize file operation metrics
5. **Performance Optimization**: Batch operations support

## Best Practices

1. **Always use context**: Pass eventBus/logger when available
2. **Handle errors**: File operations can fail, handle appropriately
3. **Use appropriate methods**: Use isFile/isDirectory instead of stats when possible
4. **Path operations**: Always use fileSystem.join() instead of string concatenation
5. **Event monitoring**: Use events to track file system health