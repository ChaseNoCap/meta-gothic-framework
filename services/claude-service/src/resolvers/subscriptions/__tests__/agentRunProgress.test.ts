import { describe, it, expect, vi, beforeEach } from 'vitest';
import { progressTracker, ProgressStage } from '../../../services/ProgressTracker';
import { emitAgentRunProgress, emitBatchProgress } from '../agentRunProgress';

describe('Agent Run Progress Subscriptions', () => {
  let mockPubSub: any;

  beforeEach(() => {
    mockPubSub = {
      publish: vi.fn(),
      subscribe: vi.fn()
    };
  });

  describe('emitAgentRunProgress', () => {
    it('should publish agent run progress with timestamp', () => {
      const progress = {
        runId: 'test-run-1',
        repository: 'test-repo',
        stage: ProgressStage.PROCESSING,
        percentage: 50,
        estimatedTimeRemaining: 30,
        currentOperation: 'Generating commit message',
        isComplete: false
      };

      emitAgentRunProgress(mockPubSub, progress);

      expect(mockPubSub.publish).toHaveBeenCalledWith({
        topic: 'AGENT_RUN_PROGRESS',
        payload: expect.objectContaining({
          ...progress,
          timestamp: expect.any(String)
        })
      });
    });
  });

  describe('emitBatchProgress', () => {
    it('should publish batch progress update', () => {
      const progress = {
        batchId: 'batch-1',
        totalOperations: 5,
        completedOperations: 2,
        failedOperations: 0,
        overallPercentage: 40,
        runProgress: [],
        estimatedTimeRemaining: 120,
        startTime: new Date().toISOString(),
        isComplete: false
      };

      emitBatchProgress(mockPubSub, progress);

      expect(mockPubSub.publish).toHaveBeenCalledWith({
        topic: 'BATCH_PROGRESS',
        payload: progress
      });
    });
  });

  describe('ProgressTracker integration', () => {
    it('should track run progress through stages', () => {
      const runId = 'test-run-2';
      const repository = 'test-repo';
      
      // Subscribe to events
      const progressEvents: any[] = [];
      progressTracker.on('agentRunProgress', (event) => {
        progressEvents.push(event);
      });

      // Simulate progress through stages
      progressTracker.updateRunProgress(runId, ProgressStage.QUEUED);
      progressTracker.updateRunProgress(runId, ProgressStage.INITIALIZING, 'Starting Claude');
      progressTracker.updateRunProgress(runId, ProgressStage.PROCESSING, 'Generating message');
      progressTracker.updateRunProgress(runId, ProgressStage.COMPLETED);

      expect(progressEvents).toHaveLength(4);
      expect(progressEvents[0].stage).toBe(ProgressStage.QUEUED);
      expect(progressEvents[3].stage).toBe(ProgressStage.COMPLETED);
      expect(progressEvents[3].isComplete).toBe(true);
    });

    it('should track batch progress correctly', () => {
      const batchId = progressTracker.createBatch(3);
      
      // Subscribe to batch events
      const batchEvents: any[] = [];
      progressTracker.on('batchProgress', (event) => {
        batchEvents.push(event);
      });

      // Add runs to batch
      progressTracker.addRunToBatch(batchId, 'run-1', 'repo-1');
      progressTracker.addRunToBatch(batchId, 'run-2', 'repo-2');
      progressTracker.addRunToBatch(batchId, 'run-3', 'repo-3');

      // Progress through runs
      progressTracker.updateRunProgress('run-1', ProgressStage.COMPLETED);
      progressTracker.updateRunProgress('run-2', ProgressStage.COMPLETED);
      
      // Check batch progress
      const lastEvent = batchEvents[batchEvents.length - 1];
      expect(lastEvent.completedOperations).toBe(2);
      expect(lastEvent.totalOperations).toBe(3);
      expect(lastEvent.isComplete).toBe(false);

      // Complete last run
      progressTracker.updateRunProgress('run-3', ProgressStage.COMPLETED);
      
      const finalEvent = batchEvents[batchEvents.length - 1];
      expect(finalEvent.completedOperations).toBe(3);
      expect(finalEvent.isComplete).toBe(true);
    });

    it('should handle failed runs in batch', () => {
      const batchId = progressTracker.createBatch(2);
      
      progressTracker.addRunToBatch(batchId, 'run-1', 'repo-1');
      progressTracker.addRunToBatch(batchId, 'run-2', 'repo-2');

      // Subscribe to events
      const batchEvents: any[] = [];
      progressTracker.on('batchProgress', (event) => {
        batchEvents.push(event);
      });

      // One success, one failure
      progressTracker.updateRunProgress('run-1', ProgressStage.COMPLETED);
      progressTracker.markRunFailed('run-2', 'Test error');

      const finalEvent = batchEvents[batchEvents.length - 1];
      expect(finalEvent.completedOperations).toBe(1);
      expect(finalEvent.failedOperations).toBe(1);
      expect(finalEvent.isComplete).toBe(true);
    });
  });

  describe('Memory management', () => {
    it('should clean up old completed batches', () => {
      // Create and complete a batch
      const batchId = progressTracker.createBatch(1);
      progressTracker.addRunToBatch(batchId, 'run-1', 'repo-1');
      progressTracker.updateRunProgress('run-1', ProgressStage.COMPLETED);

      // Simulate time passing (mock Date)
      const originalDate = Date.now;
      Date.now = vi.fn(() => originalDate() + 2 * 60 * 60 * 1000); // 2 hours later

      // Clean up
      progressTracker.cleanupCompletedBatches();

      // Restore Date
      Date.now = originalDate;

      // Batch should be cleaned up
      const batchEvents: any[] = [];
      progressTracker.on('batchProgress', (event) => {
        batchEvents.push(event);
      });

      // Try to add to cleaned batch should throw
      expect(() => {
        progressTracker.addRunToBatch(batchId, 'run-2', 'repo-2');
      }).toThrow();
    });
  });
});