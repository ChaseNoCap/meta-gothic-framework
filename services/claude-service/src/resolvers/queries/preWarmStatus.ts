import { Context } from '../../types/context.js';

export async function preWarmStatus(
  _parent: unknown,
  _args: unknown,
  context: Context
) {
  const { preWarmManager } = context;
  
  if (!preWarmManager) {
    return {
      status: 'NONE',
      sessionId: null,
      timestamp: new Date().toISOString(),
      error: 'Pre-warm sessions are not enabled'
    };
  }

  const status = preWarmManager.getStatus();
  
  return {
    status: status.status.toUpperCase(),
    sessionId: status.sessionId || null,
    timestamp: new Date().toISOString(),
    error: null
  };
}