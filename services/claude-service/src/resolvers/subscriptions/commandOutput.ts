import type { Context } from '../../types/context.js';
import type { CommandOutput } from '../../types/generated.js';

/**
 * Subscribe to real-time command output from a Claude session
 */
export const commandOutput = {
  subscribe: async (
    _parent: unknown,
    { sessionId }: { sessionId: string },
    context: Context
  ) => {
    const { sessionManager, pubsub } = context;
    
    if (!pubsub) {
      throw new Error('PubSub not available');
    }
    
    // Verify session exists
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    // Subscribe to output events for this session
    // Subscribe to output events for this session
    sessionManager.subscribeToOutput(sessionId, (output: CommandOutput) => {
      pubsub.publish({
        topic: `commandOutput.${sessionId}`,
        payload: {
          commandOutput: output
        }
      });
    });
    
    // Clean up subscription when client disconnects
    // This is handled by Mercurius automatically
    
    return pubsub.subscribe(`commandOutput.${sessionId}`);
  }
};