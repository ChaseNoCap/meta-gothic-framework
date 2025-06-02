import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';

export interface RunProgress {
  runId: string;
  repository: string;
  stage: ProgressStage;
  percentage: number;
  startTime: Date;
  currentOperation?: string;
  stageStartTime?: Date;
  historicalDurations?: Map<ProgressStage, number>;
}

export interface BatchProgress {
  batchId: string;
  totalOperations: number;
  runs: Map<string, RunProgress>;
  startTime: Date;
}

export enum ProgressStage {
  QUEUED = 'QUEUED',
  INITIALIZING = 'INITIALIZING',
  LOADING_CONTEXT = 'LOADING_CONTEXT',
  PROCESSING = 'PROCESSING',
  PARSING_RESPONSE = 'PARSING_RESPONSE',
  SAVING_RESULTS = 'SAVING_RESULTS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

// Stage weights for percentage calculation
const STAGE_WEIGHTS = {
  [ProgressStage.QUEUED]: 0,
  [ProgressStage.INITIALIZING]: 5,
  [ProgressStage.LOADING_CONTEXT]: 15,
  [ProgressStage.PROCESSING]: 70,
  [ProgressStage.PARSING_RESPONSE]: 5,
  [ProgressStage.SAVING_RESULTS]: 5,
  [ProgressStage.COMPLETED]: 0,
  [ProgressStage.FAILED]: 0,
  [ProgressStage.CANCELLED]: 0
};

export class ProgressTracker extends EventEmitter {
  private batches = new Map<string, BatchProgress>();
  private historicalDurations = new Map<string, Map<ProgressStage, number[]>>();

  /**
   * Create a new batch for tracking multiple operations
   */
  createBatch(totalOperations: number): string {
    const batchId = nanoid();
    this.batches.set(batchId, {
      batchId,
      totalOperations,
      runs: new Map(),
      startTime: new Date()
    });
    return batchId;
  }

  /**
   * Add a run to a batch
   */
  addRunToBatch(batchId: string, runId: string, repository: string): void {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    batch.runs.set(runId, {
      runId,
      repository,
      stage: ProgressStage.QUEUED,
      percentage: 0,
      startTime: new Date()
    });

    this.emitBatchProgress(batchId);
  }

  /**
   * Update the progress of a specific run
   */
  updateRunProgress(
    runId: string,
    stage: ProgressStage,
    currentOperation?: string
  ): void {
    // Find the run in any batch
    let batch: BatchProgress | undefined;
    let run: RunProgress | undefined;

    for (const b of this.batches.values()) {
      if (b.runs.has(runId)) {
        batch = b;
        run = b.runs.get(runId);
        break;
      }
    }

    if (!run || !batch) {
      // Standalone run, emit individual progress
      this.emit('agentRunProgress', {
        runId,
        repository: 'unknown',
        stage,
        percentage: this.calculatePercentage(stage),
        currentOperation,
        estimatedTimeRemaining: this.estimateTimeRemaining(runId, stage),
        isComplete: stage === ProgressStage.COMPLETED,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Update run progress
    const previousStage = run.stage;
    run.stage = stage;
    run.currentOperation = currentOperation;
    run.percentage = this.calculatePercentage(stage);

    // Track stage duration for future estimates
    if (run.stageStartTime && previousStage !== stage) {
      const duration = Date.now() - run.stageStartTime.getTime();
      this.recordStageDuration(run.repository, previousStage, duration);
    }
    run.stageStartTime = new Date();

    // Emit individual run progress
    this.emit('agentRunProgress', {
      runId,
      repository: run.repository,
      stage,
      percentage: run.percentage,
      currentOperation,
      estimatedTimeRemaining: this.estimateTimeRemaining(runId, stage, run),
      isComplete: stage === ProgressStage.COMPLETED || stage === ProgressStage.FAILED,
      timestamp: new Date().toISOString()
    });

    // Emit batch progress
    this.emitBatchProgress(batch.batchId);
  }

  /**
   * Mark a run as failed
   */
  markRunFailed(runId: string, error: string): void {
    this.updateRunProgress(runId, ProgressStage.FAILED);
    
    this.emit('agentRunProgress', {
      runId,
      stage: ProgressStage.FAILED,
      percentage: 100,
      error,
      isComplete: true,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Calculate percentage based on stage
   */
  private calculatePercentage(stage: ProgressStage): number {
    let percentage = 0;
    
    // Add up weights of completed stages
    const stages = Object.values(ProgressStage);
    for (const s of stages) {
      if (s === stage) break;
      percentage += STAGE_WEIGHTS[s] || 0;
    }

    // Add half of current stage weight if in progress
    if (stage === ProgressStage.PROCESSING) {
      // For processing stage, we could implement sub-progress
      // For now, assume 50% through processing
      percentage += (STAGE_WEIGHTS[stage] || 0) / 2;
    } else if (stage !== ProgressStage.QUEUED) {
      percentage += STAGE_WEIGHTS[stage] || 0;
    }

    // Special cases
    if (stage === ProgressStage.COMPLETED) percentage = 100;
    if (stage === ProgressStage.FAILED || stage === ProgressStage.CANCELLED) percentage = 100;

    return Math.min(100, Math.max(0, percentage));
  }

  /**
   * Estimate time remaining based on historical data
   */
  private estimateTimeRemaining(
    runId: string,
    currentStage: ProgressStage,
    run?: RunProgress
  ): number | undefined {
    if (currentStage === ProgressStage.COMPLETED || 
        currentStage === ProgressStage.FAILED ||
        currentStage === ProgressStage.CANCELLED) {
      return 0;
    }

    const repository = run?.repository || 'default';
    const historical = this.historicalDurations.get(repository);
    if (!historical) return undefined;

    let remainingTime = 0;
    let foundCurrent = false;

    // Sum up estimated time for remaining stages
    const stages = [
      ProgressStage.INITIALIZING,
      ProgressStage.LOADING_CONTEXT,
      ProgressStage.PROCESSING,
      ProgressStage.PARSING_RESPONSE,
      ProgressStage.SAVING_RESULTS
    ];

    for (const stage of stages) {
      if (stage === currentStage) {
        foundCurrent = true;
        // Add half of current stage estimate
        const stageDurations = historical.get(stage);
        if (stageDurations && stageDurations.length > 0) {
          const avgDuration = stageDurations.reduce((a, b) => a + b) / stageDurations.length;
          remainingTime += avgDuration / 2;
        }
      } else if (foundCurrent) {
        // Add full estimate for future stages
        const stageDurations = historical.get(stage);
        if (stageDurations && stageDurations.length > 0) {
          const avgDuration = stageDurations.reduce((a, b) => a + b) / stageDurations.length;
          remainingTime += avgDuration;
        }
      }
    }

    return Math.round(remainingTime / 1000); // Convert to seconds
  }

  /**
   * Record stage duration for future estimates
   */
  private recordStageDuration(
    repository: string,
    stage: ProgressStage,
    duration: number
  ): void {
    if (!this.historicalDurations.has(repository)) {
      this.historicalDurations.set(repository, new Map());
    }

    const repoHistory = this.historicalDurations.get(repository)!;
    if (!repoHistory.has(stage)) {
      repoHistory.set(stage, []);
    }

    const stageDurations = repoHistory.get(stage)!;
    stageDurations.push(duration);

    // Keep only last 10 durations
    if (stageDurations.length > 10) {
      stageDurations.shift();
    }
  }

  /**
   * Emit batch progress update
   */
  private emitBatchProgress(batchId: string): void {
    const batch = this.batches.get(batchId);
    if (!batch) return;

    const runs = Array.from(batch.runs.values());
    const completedRuns = runs.filter(r => 
      r.stage === ProgressStage.COMPLETED ||
      r.stage === ProgressStage.FAILED ||
      r.stage === ProgressStage.CANCELLED
    );
    const failedRuns = runs.filter(r => r.stage === ProgressStage.FAILED);

    const overallPercentage = runs.length > 0
      ? runs.reduce((sum, r) => sum + r.percentage, 0) / runs.length
      : 0;

    const runProgress = runs.map(r => ({
      runId: r.runId,
      repository: r.repository,
      stage: r.stage,
      percentage: r.percentage,
      currentOperation: r.currentOperation,
      timestamp: new Date().toISOString(),
      isComplete: r.stage === ProgressStage.COMPLETED || 
                  r.stage === ProgressStage.FAILED
    }));

    // Estimate total time remaining
    let totalTimeRemaining = 0;
    for (const run of runs) {
      if (run.stage !== ProgressStage.COMPLETED && 
          run.stage !== ProgressStage.FAILED) {
        const timeRemaining = this.estimateTimeRemaining(run.runId, run.stage, run);
        if (timeRemaining) {
          totalTimeRemaining += timeRemaining;
        }
      }
    }

    this.emit('batchProgress', {
      batchId,
      totalOperations: batch.totalOperations,
      completedOperations: completedRuns.length,
      failedOperations: failedRuns.length,
      overallPercentage,
      runProgress,
      estimatedTimeRemaining: totalTimeRemaining || undefined,
      startTime: batch.startTime.toISOString(),
      isComplete: completedRuns.length === batch.totalOperations
    });
  }

  /**
   * Clean up completed batches
   */
  cleanupCompletedBatches(): void {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    for (const [batchId, batch] of this.batches.entries()) {
      const allComplete = Array.from(batch.runs.values()).every(r =>
        r.stage === ProgressStage.COMPLETED ||
        r.stage === ProgressStage.FAILED ||
        r.stage === ProgressStage.CANCELLED
      );

      if (allComplete && batch.startTime.getTime() < oneHourAgo) {
        this.batches.delete(batchId);
      }
    }
  }
}

// Export singleton instance
export const progressTracker = new ProgressTracker();