import type { Context } from '../../types/context.js';
import type { CommandOutput } from '../../types/generated.js';

/**
 * Subscribe to real-time command output from a Claude session
 */
export const commandOutput = {
  subscribe: async function* (
    _parent: unknown,
    { sessionId }: { sessionId: string },
    context: Context
  ) {
    const { sessionManager, logger } = context;
    
    logger?.info('commandOutput subscription started', { sessionId });
    
    // Verify session exists
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    // Create a queue to buffer events
    const eventQueue: CommandOutput[] = [];
    let resolveNext: ((value: IteratorResult<{ commandOutput: CommandOutput }>) => void) | null = null;
    
    // Set up the subscription to session output
    const cleanup = sessionManager.subscribeToOutput(sessionId, (output: CommandOutput) => {
      logger?.debug('Received command output', { sessionId, type: output.type });
      
      if (resolveNext) {
        // If we're waiting for the next value, resolve immediately
        resolveNext({ value: { commandOutput: output }, done: false });
        resolveNext = null;
      } else {
        // Otherwise, queue it
        eventQueue.push(output);
      }
    });
    
    try {
      // Yield events as they come
      while (true) {
        if (eventQueue.length > 0) {
          const output = eventQueue.shift()!;
          yield { commandOutput: output };
          
          // Check if this was the final output
          if (output.isFinal) {
            logger?.info('commandOutput subscription completed', { sessionId });
            break;
          }
        } else {
          // Wait for the next event
          yield await new Promise<{ commandOutput: CommandOutput }>((resolve) => {
            resolveNext = (result) => {
              if (result.done) {
                resolve({ commandOutput: { 
                  sessionId, 
                  type: 'FINAL', 
                  content: '', 
                  timestamp: new Date().toISOString(), 
                  isFinal: true 
                } as CommandOutput });
              } else {
                resolve(result.value);
              }
            };
          });
        }
      }
    } finally {
      cleanup();
      logger?.info('commandOutput subscription cleaned up', { sessionId });
    }
  }
};