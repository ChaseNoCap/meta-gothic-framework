import { EventEmitter } from 'eventemitter3';

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AggregatedMetrics {
  operation: string;
  count: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  p95Duration: number;
  p99Duration: number;
}

class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 10000; // Keep last 10k metrics in memory

  recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
    
    // Prevent memory leak
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Emit event for real-time monitoring
    this.emit('metric', metric);
  }

  async measure<T>(
    operation: string, 
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      this.recordMetric({
        operation,
        duration,
        timestamp: new Date(),
        metadata: { ...metadata, success: true }
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.recordMetric({
        operation,
        duration,
        timestamp: new Date(),
        metadata: { ...metadata, success: false, error: String(error) }
      });
      
      throw error;
    }
  }

  getMetrics(
    operation?: string,
    startTime?: Date,
    endTime?: Date
  ): PerformanceMetrics[] {
    let filtered = this.metrics;

    if (operation) {
      filtered = filtered.filter(m => m.operation === operation);
    }

    if (startTime) {
      filtered = filtered.filter(m => m.timestamp >= startTime);
    }

    if (endTime) {
      filtered = filtered.filter(m => m.timestamp <= endTime);
    }

    return filtered;
  }

  getAggregatedMetrics(
    operation?: string,
    lastMinutes = 60
  ): AggregatedMetrics[] {
    const cutoff = new Date(Date.now() - lastMinutes * 60 * 1000);
    const metrics = this.getMetrics(operation, cutoff);

    // Group by operation
    const grouped = metrics.reduce((acc, metric) => {
      if (!acc[metric.operation]) {
        acc[metric.operation] = [];
      }
      acc[metric.operation].push(metric);
      return acc;
    }, {} as Record<string, PerformanceMetrics[]>);

    // Calculate aggregates
    return Object.entries(grouped).map(([op, metrics]) => {
      const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
      const count = durations.length;
      
      if (count === 0) {
        return {
          operation: op,
          count: 0,
          totalDuration: 0,
          averageDuration: 0,
          minDuration: 0,
          maxDuration: 0,
          p95Duration: 0,
          p99Duration: 0
        };
      }

      const totalDuration = durations.reduce((sum, d) => sum + d, 0);
      const p95Index = Math.floor(count * 0.95);
      const p99Index = Math.floor(count * 0.99);

      return {
        operation: op,
        count,
        totalDuration,
        averageDuration: totalDuration / count,
        minDuration: durations[0],
        maxDuration: durations[count - 1],
        p95Duration: durations[p95Index] || durations[count - 1],
        p99Duration: durations[p99Index] || durations[count - 1]
      };
    });
  }

  compareParallelVsSequential(): {
    parallel: AggregatedMetrics[];
    sequential: AggregatedMetrics[];
    speedup: number;
  } {
    const parallel = this.getAggregatedMetrics('parallel-commit-generation');
    const sequential = this.getAggregatedMetrics('sequential-commit-generation');

    const parallelAvg = parallel[0]?.averageDuration || 0;
    const sequentialAvg = sequential[0]?.averageDuration || 0;
    
    const speedup = sequentialAvg > 0 ? sequentialAvg / parallelAvg : 0;

    return {
      parallel,
      sequential,
      speedup
    };
  }

  clear(): void {
    this.metrics = [];
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Helper function to measure GraphQL resolver performance
export async function measureResolver<T>(
  resolverName: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  return performanceMonitor.measure(`resolver:${resolverName}`, fn, metadata);
}