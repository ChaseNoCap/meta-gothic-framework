# Claude Service Monitoring & Error Handling Guide

## Overview

This guide covers the monitoring, logging, and error handling setup for the Claude service to ensure reliable operation and quick debugging of issues.

## Key Issues Resolved

### 1. RunStorage Initialization Bug
**Problem**: The RunStorage constructor was receiving parameters in the wrong order, causing the logger object to be passed as the storage directory path.

**Solution**: Fixed the initialization in both `index.ts` and `ClaudeSessionManagerWithEvents.ts` to properly pass parameters:
```typescript
const runStorage = new RunStorage(
  runStorageDir,  // string path first
  undefined,      // optional eventBus
  logger         // optional logger
);
```

### 2. Path Double-Concatenation
**Problem**: When loading existing runs, the file path was being concatenated twice.

**Solution**: Fixed in `RunStorage.ts` - `listDirectory` already returns full paths, so no need to join again.

### 3. Missing Global Error Handlers
**Problem**: No handlers for unhandled exceptions and promise rejections.

**Solution**: Added comprehensive error handlers in `index.ts`:
```typescript
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  healthMonitor.recordError(error);
  setTimeout(() => process.exit(1), 1000); // Allow time to flush logs
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  healthMonitor.recordError(reason);
});
```

## Monitoring Features

### 1. Health Monitor
A dedicated health monitoring system that tracks:
- Service uptime
- Memory usage (heap, RSS)
- Active request count
- Recent errors (5-minute window)
- Automatic health checks every 30 seconds

### 2. Enhanced Health Endpoint
The `/health` endpoint now returns detailed metrics:
```json
{
  "status": "ok",  // or "degraded" if errors > 5
  "service": "claude-service",
  "uptime": 300,
  "memory": {
    "heapUsed": "45MB",
    "rss": "120MB"
  },
  "activeRequests": 2,
  "recentErrors": 0
}
```

### 3. Request Tracking
- Increments counter on request start
- Decrements on completion (success or error)
- Helps identify hanging requests

### 4. Error Recording
- Captures all errors with timestamps
- Maintains 5-minute sliding window
- Triggers warnings if error rate is high

## Logging Structure

### Log Locations
- **Combined logs**: `logs/claude-service/claude-service-combined.log`
- **Error logs**: `logs/claude-service/claude-service-error.log`
- **Output logs**: `logs/claude-service/claude-service-out.log`
- **Health monitor logs**: `logs/claude-service/health-monitor.log`

### Log Levels
- **info**: Service lifecycle events, health checks, session management
- **warn**: Degraded performance, high memory usage, recoverable errors
- **error**: Failures, exceptions, critical issues
- **debug**: Detailed execution flow, useful for troubleshooting

### Structured Logging
All logs include:
- Timestamp
- Service name
- Log level
- Correlation ID (for request tracking)
- Contextual data

## Error Handling Patterns

### 1. GraphQL Request Handling
```typescript
try {
  // Parse request
  const parsed = JSON.parse(body);
  // ... execute query
} catch (parseError) {
  logger.error('Failed to parse GraphQL request', parseError);
  res.writeHead(400, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ errors: [{ message: 'Invalid JSON' }] }));
}
```

### 2. Claude Process Management
- Proper error handling for spawn failures
- Timeout management (20 minutes for complex operations)
- Clean process termination on errors
- Session state updates on failures

### 3. SSE Connection Management
- Client disconnect handling
- Iterator cleanup
- Response state checking before writes
- Heartbeat mechanism

### 4. Pre-warm Session Handling
- Graceful handling of initialization failures
- Timeout protection
- Status event emissions for monitoring

## Monitoring Scripts

### 1. Health Monitor Script (`monitor-health.sh`)
Automated monitoring that:
- Checks health endpoint every 30 seconds
- Monitors PM2 process status
- Automatically restarts on failures
- Logs all actions

Usage:
```bash
./services/claude-service/monitor-health.sh &
```

### 2. PM2 Monitoring
```bash
# View current status
pm2 status

# View logs
pm2 logs claude-service --lines 50

# Monitor in real-time
pm2 monit

# View detailed info
pm2 describe claude-service
```

## Debugging Common Issues

### Service Keeps Restarting
1. Check error logs for crash cause:
   ```bash
   tail -f services/claude-service/logs/claude-service-error.log
   ```

2. Look for initialization errors:
   ```bash
   grep "Failed to initialize" services/claude-service/logs/*.log
   ```

3. Check PM2 restart count:
   ```bash
   pm2 describe claude-service | grep -E "restarts|restart time"
   ```

### Memory Issues
1. Check current memory usage:
   ```bash
   curl http://localhost:3002/health | jq '.memory'
   ```

2. Monitor memory over time:
   ```bash
   grep "Health check" logs/claude-service-*.log | grep memory
   ```

3. Look for memory leak warnings:
   ```bash
   grep "High memory usage" logs/claude-service-*.log
   ```

### Request Timeouts
1. Check active requests:
   ```bash
   curl http://localhost:3002/health | jq '.activeRequests'
   ```

2. Look for timeout errors:
   ```bash
   grep -i timeout logs/claude-service-*.log
   ```

3. Check Claude process spawning:
   ```bash
   grep "Claude process" logs/claude-service-*.log
   ```

## Best Practices

### 1. Error Recovery
- Always provide fallback behavior
- Log errors with context
- Update health metrics
- Clean up resources

### 2. Resource Management
- Close file handles
- Kill child processes
- Clear timeouts/intervals
- Remove event listeners

### 3. Graceful Shutdown
- Stop accepting new requests
- Complete active requests
- Clean up sessions
- Flush logs
- Exit cleanly

### 4. Performance Monitoring
- Track request duration
- Monitor memory growth
- Count active operations
- Set resource limits

## Alerting Recommendations

### Critical Alerts
- Service offline for > 2 minutes
- Memory usage > 500MB
- Error rate > 10/minute
- Restart count > 5/hour

### Warning Alerts
- Memory usage > 300MB
- Error rate > 5/minute
- Response time > 30s
- Restart count > 2/hour

## Future Improvements

1. **Metrics Collection**
   - Integrate with Prometheus/Grafana
   - Add custom metrics
   - Track Claude API usage

2. **Distributed Tracing**
   - Add OpenTelemetry support
   - Trace requests across services
   - Visualize service dependencies

3. **Auto-scaling**
   - Dynamic worker management
   - Load-based scaling
   - Resource optimization

4. **Enhanced Recovery**
   - Circuit breaker pattern
   - Retry with backoff
   - Request queuing

## Summary

The Claude service now has comprehensive monitoring and error handling:
- ✅ Global error handlers prevent crashes
- ✅ Health monitoring tracks service state
- ✅ Structured logging aids debugging
- ✅ Request tracking identifies issues
- ✅ Graceful shutdown preserves data
- ✅ Automated monitoring enables quick recovery

This ensures the service remains stable and issues can be quickly identified and resolved.