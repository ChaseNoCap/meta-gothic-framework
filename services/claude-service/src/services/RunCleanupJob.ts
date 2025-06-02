import { RunStorage } from './RunStorage.js';

export class RunCleanupJob {
  private intervalId: NodeJS.Timeout | null = null;
  private runStorage: RunStorage;
  private intervalHours: number;

  constructor(runStorage: RunStorage, intervalHours: number = 24) {
    this.runStorage = runStorage;
    this.intervalHours = intervalHours;
  }

  /**
   * Start the cleanup job
   */
  start(): void {
    if (this.intervalId) {
      console.warn('Cleanup job is already running');
      return;
    }

    // Run immediately on start
    this.runCleanup();

    // Schedule periodic cleanup
    this.intervalId = setInterval(() => {
      this.runCleanup();
    }, this.intervalHours * 60 * 60 * 1000);

    console.log(`Run cleanup job started - will run every ${this.intervalHours} hours`);
  }

  /**
   * Stop the cleanup job
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Run cleanup job stopped');
    }
  }

  /**
   * Execute cleanup
   */
  private async runCleanup(): Promise<void> {
    try {
      console.log('Starting run cleanup...');
      const startTime = Date.now();
      
      const deletedCount = await this.runStorage.deleteOldRuns();
      
      const duration = Date.now() - startTime;
      console.log(`Run cleanup completed - deleted ${deletedCount} old runs in ${duration}ms`);
      
      // Also log current statistics
      const stats = await this.runStorage.getRunStatistics();
      console.log('Current run statistics:', {
        total: stats.total,
        successRate: `${(stats.successRate * 100).toFixed(1)}%`,
        averageDuration: `${Math.round(stats.averageDuration)}ms`,
      });
    } catch (error) {
      console.error('Run cleanup failed:', error);
    }
  }

  /**
   * Run cleanup once (for manual triggers)
   */
  async runOnce(): Promise<number> {
    return await this.runStorage.deleteOldRuns();
  }
}

// Singleton instance
let cleanupJob: RunCleanupJob | null = null;

/**
 * Initialize and start the cleanup job
 */
export function initializeCleanupJob(runStorage: RunStorage, intervalHours?: number): RunCleanupJob {
  if (!cleanupJob) {
    cleanupJob = new RunCleanupJob(runStorage, intervalHours);
    cleanupJob.start();
  }
  return cleanupJob;
}

/**
 * Get the cleanup job instance
 */
export function getCleanupJob(): RunCleanupJob | null {
  return cleanupJob;
}