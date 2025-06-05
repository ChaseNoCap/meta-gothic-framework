import { PerformanceMonitor } from './index.js';
import type { ILogger } from '@chasenocap/logger';

/**
 * Creates a cleanup job that periodically clears stale operations
 * from the performance monitor to prevent memory leaks
 */
export function createPerformanceCleanupJob(
  monitor: PerformanceMonitor,
  logger?: ILogger,
  intervalHours: number = 1
): NodeJS.Timer {
  const intervalMs = intervalHours * 60 * 60 * 1000;
  
  const cleanup = () => {
    try {
      const cleared = monitor.clearStaleOperations();
      
      if (cleared > 0) {
        logger?.info('Performance monitor cleanup completed', {
          clearedOperations: cleared,
          activeOperations: monitor.getActiveOperations().length
        });
      }
    } catch (error) {
      logger?.error('Performance monitor cleanup failed', error as Error);
    }
  };
  
  // Run immediately
  cleanup();
  
  // Then run periodically
  return setInterval(cleanup, intervalMs);
}

/**
 * Monitor health check - reports on current monitoring state
 */
export interface MonitorHealth {
  activeOperations: number;
  oldestOperationAge?: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
  };
  longRunningOperations: Array<{
    operationName: string;
    duration: number;
    startTime: number;
  }>;
}

export function getMonitorHealth(
  monitor: PerformanceMonitor,
  longRunningThreshold: number = 300000 // 5 minutes
): MonitorHealth {
  const activeOps = monitor.getActiveOperations();
  const now = Date.now();
  
  const longRunning = activeOps
    .filter(op => now - op.startTime > longRunningThreshold)
    .map(op => ({
      operationName: op.operationName,
      duration: now - op.startTime,
      startTime: op.startTime
    }));
  
  const oldestOp = activeOps.reduce((oldest, op) => 
    op.startTime < oldest.startTime ? op : oldest,
    { startTime: now }
  );
  
  const memUsage = process.memoryUsage();
  
  return {
    activeOperations: activeOps.length,
    oldestOperationAge: activeOps.length > 0 ? now - oldestOp.startTime : undefined,
    memoryUsage: {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal
    },
    longRunningOperations: longRunning
  };
}