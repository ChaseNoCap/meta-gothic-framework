import type { Context } from '../../types/context.js';
import type { ClaudeSession } from '../../types/generated.js';

/**
 * List all active Claude sessions
 */
export async function sessions(
  _parent: unknown,
  _args: {},
  context: Context
): Promise<ClaudeSession[]> {
  const { sessionManager, logger } = context;
  const operationLogger = logger.child({ operation: 'sessions' });
  
  operationLogger.debug('Fetching active sessions');
  
  try {
    const activeSessions = await sessionManager.getActiveSessions();
    operationLogger.info('Active sessions retrieved', { 
      count: activeSessions.length 
    });
    return activeSessions;
  } catch (error) {
    operationLogger.error('Failed to fetch sessions', error as Error);
    throw error;
  }
}

