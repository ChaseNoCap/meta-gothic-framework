# ADR-Monitoring: CI/CD Dashboard and Metrics Collection

**Status**: Accepted  
**Date**: 2024-05-15 (Renamed 2025-01-06)  
**Original**: ADR-004

## Context

The metaGOTHIC framework consists of multiple packages across different repositories. We need a systematic way to collect, persist, and visualize CI/CD metrics to monitor the health and performance of our entire ecosystem.

## Decision

We will implement a dashboard data collection system that:

1. **Collects metrics during CI/CD runs** across all metaGOTHIC package repositories
2. **Persists data in a structured format** accessible to the dashboard
3. **Provides real-time and historical views** of build status, test results, and package health

### Data Collection Strategy

Each repository's CI/CD workflow will:
- Generate metrics during build/test/publish phases
- Structure data in a consistent JSON format
- Push data to a central location (initially the meta repository)

### Data Structure

```json
{
  "timestamp": "2024-05-15T10:30:00Z",
  "repository": "prompt-toolkit",
  "workflow": "ci",
  "status": "success",
  "metrics": {
    "duration": 145,
    "tests": {
      "total": 156,
      "passed": 156,
      "failed": 0,
      "coverage": 92.5
    },
    "build": {
      "size": 245678,
      "dependencies": 12
    }
  }
}
```

## Implementation

### Collection Phase
```yaml
# In each package's workflow
- name: Collect Metrics
  run: |
    echo "{
      \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"repository\": \"${{ github.repository }}\",
      \"metrics\": {
        \"tests\": $(jest --json | jq '.numTotalTests as $t | {total: $t, passed: .numPassedTests}'),
        \"coverage\": $(jest --coverage --json | jq '.coverageMap.total.lines.pct')
      }
    }" > metrics.json
```

### Storage Phase
```yaml
# Push to meta repository
- name: Update Dashboard Data
  uses: peter-evans/repository-dispatch@v2
  with:
    token: ${{ secrets.DISPATCH_TOKEN }}
    repository: ChaseNoCap/meta-gothic-framework
    event-type: update-dashboard
    client-payload: '{"metrics": ${{ toJson(fromJson(steps.collect.outputs.metrics)) }}}'
```

### Visualization Phase
The dashboard will:
- Aggregate data from all repositories
- Display real-time status cards
- Show historical trends
- Alert on failures or degraded performance

## Consequences

### Positive
- Centralized visibility across all packages
- Historical tracking of project health
- Early detection of quality issues
- Data-driven decision making

### Negative
- Additional CI/CD complexity
- Storage requirements grow over time
- Potential for data inconsistency

## Status

Implemented and operational. The dashboard successfully tracks:
- Build status across 8 packages
- Test coverage trends
- Deployment success rates
- Performance metrics over time

## Future Enhancements

1. **Prometheus Integration**: Export metrics for monitoring
2. **Alerting**: Automated notifications for failures
3. **Advanced Analytics**: ML-based anomaly detection
4. **Cost Tracking**: CI/CD resource usage and costs

## Performance Monitoring (Added 2025-06-04)

### Context
The metaGOTHIC services require comprehensive performance monitoring, especially for long-running Claude AI operations that can take 15+ minutes to complete. We need configurable metrics collection to avoid unnecessary overhead while capturing critical performance data.

### Decision

We will implement a configurable performance monitoring system using:

1. **GraphQL Plugin for Automatic Monitoring**: All GraphQL operations are automatically tracked
2. **Direct Monitor Usage for Sub-Operations**: Manual tracking for internal operations within resolvers
3. **Environment-Based Configuration**: Control metric collection via PERFORMANCE_MODE

### Implementation

#### 1. Base Monitoring (GraphQL Plugin)
```typescript
// Automatically tracks all GraphQL operations
plugins: [
  createPerformancePlugin({
    serviceName: 'claude-service',
    slowThreshold: 30000,  // 30 seconds for "slow" operations
    logger
  })
]
```

#### 2. Long-Running Operation Support
```typescript
// Configuration for Claude operations
thresholds: {
  slowOperationMs: 30000,       // 30 seconds for regular operations
  claudeSlowOperationMs: 60000, // 1 minute for Claude operations  
  maxOperationMs: 1800000,      // 30 minutes before considering "stale"
  highMemoryMB: 500,
  highCPUMs: 10000,
}
```

#### 3. Manual Tracking for Sub-Operations
```typescript
// Only for tracking expensive sub-operations within a resolver
const monitor = new PerformanceMonitor(context.eventBus, context.logger);
monitor.startOperation(opId, 'claudeExecution', 'api-call');
// ... long-running operation ...
monitor.endOperation(opId, undefined, { tokenCount: result.tokenUsage });
```

### Configuration Strategy

**Environment Modes:**
- `PERFORMANCE_MODE=production`: 10% sampling, minimal metrics
- `PERFORMANCE_MODE=development`: All metrics enabled, no sampling
- `PERFORMANCE_MODE=debug`: Everything enabled for troubleshooting

**Sampling for Long Operations:**
```typescript
sampling: {
  enabled: true,
  rate: 1.0,                    // Always sample Claude operations
  alwaysSampleSlow: true,       // Always capture slow ops
  includePatterns: ['claude.*', 'execute.*'] // Always sample Claude ops
}
```

### Rationale

1. **No Decorators on Functions**: TypeScript/JavaScript decorators only work on classes, not standalone functions. Our resolvers are functions, so we use a plugin approach instead.

2. **Long Operation Support**: Claude operations require different thresholds and cleanup strategies than typical API calls.

3. **Configurable Overhead**: Different environments need different levels of monitoring detail.

### Consequences

**Positive:**
- Automatic monitoring without modifying every resolver
- Configurable overhead based on environment
- Support for 15+ minute Claude operations
- Detailed metrics for AI operations (tokens, costs)

**Negative:**
- Cannot use decorator syntax on standalone functions
- Manual tracking needed for sub-operations
- Additional configuration complexity