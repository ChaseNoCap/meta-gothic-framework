import { Context } from '../../types/context.js';

export async function claimPreWarmedSession(
  _parent: unknown,
  _args: unknown,
  context: Context
) {
  const { preWarmManager, logger } = context;
  
  if (!preWarmManager) {
    logger.warn('PreWarmManager not available');
    return {
      success: false,
      sessionId: null,
      status: 'disabled',
      error: 'Pre-warm sessions are not enabled'
    };
  }

  try {
    const sessionId = await preWarmManager.claimSession();
    
    if (sessionId) {
      return {
        success: true,
        sessionId,
        status: 'claimed',
        error: null
      };
    } else {
      // No pre-warmed session available
      const status = preWarmManager.getStatus();
      return {
        success: false,
        sessionId: null,
        status: status.status,
        error: null
      };
    }
  } catch (error) {
    logger.error('Failed to claim pre-warmed session', { error });
    return {
      success: false,
      sessionId: null,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}