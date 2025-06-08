import { commandOutput } from './commandOutput.js';
import { agentRunProgress, batchProgress } from './agentRunProgress.js';
import { preWarmStatus } from './preWarmStatus.js';

// Wrap resolvers to ensure they always return async iterables
function wrapSubscriptionResolver(resolver: any) {
  return async function* (...args: any[]) {
    console.log('[wrapSubscriptionResolver] Called for:', resolver.name);
    try {
      yield* resolver(...args);
    } catch (error) {
      console.error('[Subscription Error]', error);
      throw error;
    }
  };
}

// Test if preWarmStatus is correctly defined
console.log('[Subscription Resolvers] preWarmStatus type:', typeof preWarmStatus);
console.log('[Subscription Resolvers] preWarmStatus is async generator?', preWarmStatus.constructor.name === 'AsyncGeneratorFunction');

// GraphQL expects subscriptions to have a 'subscribe' property
export const resolvers: any = {
  commandOutput: {
    subscribe: wrapSubscriptionResolver(commandOutput)
  },
  agentRunProgress: {
    subscribe: wrapSubscriptionResolver(agentRunProgress)
  },
  batchProgress: {
    subscribe: wrapSubscriptionResolver(batchProgress)
  },
  preWarmStatus: {
    subscribe: wrapSubscriptionResolver(preWarmStatus)
  }
};