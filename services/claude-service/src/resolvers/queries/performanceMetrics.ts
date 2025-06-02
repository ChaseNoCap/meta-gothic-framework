import { Context } from '../../types/context.js';
import { performanceMonitor } from '../../utils/performance.js';

export async function performanceMetrics(
  _parent: unknown,
  args: { operation?: string; lastMinutes?: number },
  _context: Context
) {
  const lastMinutes = args.lastMinutes || 60;
  const endTime = new Date();
  const startTime = new Date(Date.now() - lastMinutes * 60 * 1000);

  // Get aggregated metrics
  const aggregated = performanceMonitor.getAggregatedMetrics(
    args.operation,
    lastMinutes
  );

  // Get parallel comparison
  const comparison = performanceMonitor.compareParallelVsSequential();

  // Calculate total operations
  const totalOperations = aggregated.reduce((sum, op) => sum + op.count, 0);

  // Calculate success rates
  const operations = aggregated.map(op => {
    const metrics = performanceMonitor.getMetrics(op.operation, startTime, endTime);
    const successCount = metrics.filter(m => m.metadata?.success === true).length;
    const successRate = op.count > 0 ? (successCount / op.count) * 100 : 0;

    return {
      ...op,
      successRate
    };
  });

  // Build parallel comparison if data exists
  let parallelComparison = null;
  if (comparison.parallel.length > 0 && comparison.sequential.length > 0) {
    const parallel = comparison.parallel[0];
    const sequential = comparison.sequential[0];
    
    // Calculate efficiency (how close to theoretical max speedup)
    const theoreticalSpeedup = 5; // Based on concurrency limit
    const efficiency = comparison.speedup > 0 
      ? (comparison.speedup / theoreticalSpeedup) * 100 
      : 0;

    parallelComparison = {
      parallel: {
        ...parallel,
        successRate: calculateSuccessRate(parallel.operation, startTime, endTime)
      },
      sequential: {
        ...sequential,
        successRate: calculateSuccessRate(sequential.operation, startTime, endTime)
      },
      speedup: comparison.speedup,
      efficiency
    };
  }

  return {
    operations,
    parallelComparison,
    timeRange: {
      start: startTime.toISOString(),
      end: endTime.toISOString(),
      durationMinutes: lastMinutes
    },
    totalOperations
  };
}

function calculateSuccessRate(operation: string, startTime: Date, endTime: Date): number {
  const metrics = performanceMonitor.getMetrics(operation, startTime, endTime);
  const successCount = metrics.filter(m => m.metadata?.success === true).length;
  return metrics.length > 0 ? (successCount / metrics.length) * 100 : 0;
}