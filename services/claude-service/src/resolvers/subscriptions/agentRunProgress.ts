import { Context } from '../../types/context.js';
import mercurius from 'mercurius';
const { withFilter } = mercurius;

// Event names
export const AGENT_RUN_PROGRESS = 'AGENT_RUN_PROGRESS';
export const BATCH_PROGRESS = 'BATCH_PROGRESS';

/**
 * Subscribe to progress updates for a specific agent run
 */
export const agentRunProgress: any = {
  subscribe: withFilter(
    (_root: any, _args: any, { pubsub }: Context) => {
      if (!pubsub) {
        throw new Error('PubSub not available in context');
      }
      return pubsub.subscribe(AGENT_RUN_PROGRESS);
    },
    (payload: any, args: { runId: string }) => {
      // Only send updates for the requested run ID
      return payload.runId === args.runId;
    }
  ),
  resolve: (payload: any) => payload
};

/**
 * Subscribe to aggregate progress for a batch of operations
 */
export const batchProgress: any = {
  subscribe: withFilter(
    (_root: any, _args: any, { pubsub }: Context) => {
      if (!pubsub) {
        throw new Error('PubSub not available in context');
      }
      return pubsub.subscribe(BATCH_PROGRESS);
    },
    (payload: any, args: { batchId: string }) => {
      // Only send updates for the requested batch ID
      return payload.batchId === args.batchId;
    }
  ),
  resolve: (payload: any) => payload
};

/**
 * Helper to emit progress updates
 */
export function emitAgentRunProgress(
  pubsub: any,
  progress: {
    runId: string;
    repository: string;
    stage: string;
    percentage: number;
    estimatedTimeRemaining?: number;
    currentOperation?: string;
    isComplete: boolean;
    error?: string;
  }
) {
  pubsub.publish({
    topic: AGENT_RUN_PROGRESS,
    payload: {
      ...progress,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Helper to emit batch progress updates
 */
export function emitBatchProgress(
  pubsub: any,
  progress: {
    batchId: string;
    totalOperations: number;
    completedOperations: number;
    failedOperations: number;
    overallPercentage: number;
    runProgress: any[];
    estimatedTimeRemaining?: number;
    startTime: string;
    isComplete: boolean;
  }
) {
  pubsub.publish({
    topic: BATCH_PROGRESS,
    payload: progress
  });
}