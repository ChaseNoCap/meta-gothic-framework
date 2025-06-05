# Performance Monitoring Guide

## Overview

The metaGOTHIC framework includes a comprehensive, configurable performance monitoring system that allows fine-grained control over what metrics are collected. This prevents unnecessary overhead while providing detailed insights when needed.

## Key Features

- **Configurable Metrics**: Enable/disable specific metrics based on your needs
- **Multiple Presets**: Default, Development, Production, and Debug configurations
- **Decorator-based**: Simple `@Monitor` decorator for any method
- **Event-driven**: Integrates with the event system for real-time monitoring
- **GraphQL Integration**: Automatic tracking of GraphQL operations

## Usage

### Basic Usage with @Monitor Decorator

```typescript
import { PerformanceMonitor } from '@meta-gothic/shared/performance';

export class MyService {
  @PerformanceMonitor.monitor('mutation')
  async createHandoff(input: HandoffInput): Promise<HandoffResult> {
    // Your method implementation
  }
}
```

### With Custom Configuration

```typescript
import { PerformanceMonitor, DEVELOPMENT_PERFORMANCE_CONFIG } from '@meta-gothic/shared/performance';

export class MyService {
  @PerformanceMonitor.monitor('mutation', {
    slowThreshold: 2000,
    config: {
      ...DEVELOPMENT_PERFORMANCE_CONFIG,
      ai: {
        enabled: true,
        tokenUsage: {
          enabled: true,
          input: true,
          output: true,
          cost: true
        }
      }
    }
  })
  async generateCommitMessages(input: BatchCommitMessageInput): Promise<BatchCommitMessageResult> {
    // AI-powered operation
  }
}
```

## Configuration Options

### Basic Metrics (Always Enabled)
- `duration`: Operation duration
- `operationName`: Name of the operation
- `operationType`: Type (query, mutation, subscription, etc.)
- `success`: Whether operation succeeded

### Resource Metrics
```typescript
resources: {
  enabled: true,
  memory: {
    enabled: true,
    includeHeapUsed: true,
    includeHeapTotal: true,
    includeExternal: true,
    includeRSS: true,
    trackDelta: true // Track change from start to end
  },
  cpu: {
    enabled: true,
    includeUser: true,
    includeSystem: true
  }
}
```

### Data Size Metrics
```typescript
dataSize: {
  enabled: true,
  contextSize: true, // Size of input/args
  resultSize: true,  // Size of output
  compressionRatio: true
}
```

### AI/ML Metrics
```typescript
ai: {
  enabled: true,
  tokenUsage: {
    enabled: true,
    input: true,
    output: true,
    cost: true
  },
  modelPerformance: {
    enabled: true,
    latency: true,
    throughput: true
  }
}
```

### GraphQL Metrics
```typescript
graphql: {
  enabled: true,
  queryComplexity: true,
  fieldCount: true,
  depthAnalysis: true,
  resolverCount: true,
  errorRate: true
}
```

## Configuration Presets

### Default (Minimal Overhead)
- Basic metrics only
- Cache hit tracking
- GraphQL field count and error rate

### Development
- All basic metrics
- Full resource tracking (memory, CPU)
- Data size metrics
- Performance analysis
- No sampling

### Production
- Basic metrics
- 10% sampling rate
- Always sample slow operations
- Performance scoring
- Excludes health checks

### Debug
- Everything from Development
- Network tracking
- Database query details
- File system operations
- Lower slow query threshold

## Environment Variables

```bash
# Set performance mode
PERFORMANCE_MODE=production

# Or use custom JSON config
PERFORMANCE_CONFIG='{"sampling":{"enabled":true,"rate":0.5}}'
```

## Integration with Context

The performance monitoring system integrates with the GraphQL context:

```typescript
export interface Context {
  // Performance monitoring support
  performanceConfig?: PerformanceMonitoringConfig;
  tokenUsage?: {
    input: number;
    output: number;
    estimatedCost?: number;
  };
  cacheHit?: boolean;
  graphqlInfo?: {
    fieldCount: number;
    complexity: number;
  };
}
```

## Performance Events

The system emits these events:
- `performance.operation.started`
- `performance.operation.completed`
- `performance.slow.operation`

Subscribe to these events for real-time monitoring:

```typescript
eventBus.subscribe('performance.slow.operation', (event) => {
  console.warn(`Slow operation detected: ${event.payload.operationName}`);
  alertingService.sendAlert({
    type: 'slow-operation',
    details: event.payload
  });
});
```

## Sampling Strategies

Control which operations are monitored:

```typescript
sampling: {
  enabled: true,
  rate: 0.1, // Sample 10% of operations
  alwaysSampleSlow: true, // Always monitor slow operations
  excludePatterns: ['healthCheck', 'metrics'],
  includePatterns: ['mutation.*', 'heavyOperation.*']
}
```

## Performance Scoring

The system calculates a 0-100 performance score based on:
- Duration (up to 40 points penalty)
- Memory usage (up to 30 points penalty)
- CPU usage (up to 20 points penalty)
- Cache hits (up to 10 points bonus)

## Best Practices

1. **Start with Default Config**: Use minimal configuration in production unless debugging
2. **Enable Specific Metrics**: Only enable metrics you'll actually use
3. **Use Sampling**: In high-traffic production, use sampling to reduce overhead
4. **Monitor Slow Operations**: Always enable `alwaysSampleSlow` to catch performance issues
5. **Context-aware**: Pass performance data through context for decorator access

## Example: Different Configs for Different Operations

```typescript
// Minimal monitoring for simple queries
@PerformanceMonitor.monitor('query', { slowThreshold: 200 })
export async function sessions() { }

// Full monitoring for AI operations
@PerformanceMonitor.monitor('mutation', {
  config: { ...DEVELOPMENT_PERFORMANCE_CONFIG, ai: { enabled: true } }
})
export async function generateWithAI() { }

// Debug file operations
@PerformanceMonitor.monitor('query', {
  config: { ...DEBUG_PERFORMANCE_CONFIG }
})
export async function scanAllRepositories() { }
```

## Troubleshooting

### High Memory Usage
- Disable `includeExternal` and `includeRSS` in memory config
- Use `trackDelta: true` to see memory growth

### Too Much Logging
- Increase sampling rate
- Add patterns to `excludePatterns`
- Use production preset

### Missing Metrics
- Check if specific metric category is enabled
- Verify context is properly passed
- Ensure decorator is applied correctly