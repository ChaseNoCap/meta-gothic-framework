import { Context } from '../../types/context.js';

export async function preWarmMetrics(
  _parent: unknown,
  _args: unknown,
  context: Context
) {
  const { preWarmManager } = context;
  
  if (!preWarmManager) {
    return null;
  }

  const metrics = preWarmManager.getMetrics();
  
  return {
    configured: {
      poolSize: metrics.configured.poolSize,
      maxSessionAge: metrics.configured.maxSessionAge,
      cleanupInterval: metrics.configured.cleanupInterval,
      warmupTimeout: metrics.configured.warmupTimeout
    },
    current: {
      total: metrics.current.total,
      ready: metrics.current.ready,
      warming: metrics.current.warming,
      claimed: metrics.current.claimed,
      isWarming: metrics.current.isWarming
    },
    sessions: metrics.sessions.map(s => ({
      sessionId: s.sessionId,
      claudeSessionId: s.claudeSessionId,
      status: s.status,
      age: s.age,
      createdAt: s.createdAt
    }))
  };
}