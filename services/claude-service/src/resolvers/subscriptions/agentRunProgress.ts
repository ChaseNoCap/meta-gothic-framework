import { Context } from '../../types/context.js';

// Event names
export const AGENT_RUN_PROGRESS = 'AGENT_RUN_PROGRESS';
export const BATCH_PROGRESS = 'BATCH_PROGRESS';

/**
 * Subscribe to progress updates for a specific agent run
 */
export const agentRunProgress = {
  subscribe: (root: any, args: { runId: string }, context: Context) => {
    if (!context.pubsub) {
      throw new Error('PubSub not available in context');
    }
    
    // Create an async generator that filters events
    const originalIterator = context.pubsub.subscribe(AGENT_RUN_PROGRESS);
    
    return {
      async *[Symbol.asyncIterator]() {
        for await (const event of originalIterator) {
          // Filter events by runId
          if (event.agentRunProgress?.id === args.runId) {
            yield event;
          }
        }
      }
    };
  },
  resolve: (payload: any) => payload.agentRunProgress
};

/**
 * Subscribe to batch progress updates
 */
export const batchProgress = {
  subscribe: (root: any, args: { runIds: string[] }, context: Context) => {
    if (!context.pubsub) {
      throw new Error('PubSub not available in context');
    }
    
    // Create an async generator that filters events
    const originalIterator = context.pubsub.subscribe(BATCH_PROGRESS);
    
    return {
      async *[Symbol.asyncIterator]() {
        for await (const event of originalIterator) {
          // Filter events by runIds
          if (event.batchProgress && args.runIds.includes(event.batchProgress.runId)) {
            yield event;
          }
        }
      }
    };
  },
  resolve: (payload: any) => payload.batchProgress
};