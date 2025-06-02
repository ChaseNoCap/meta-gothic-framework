import { sessions } from './sessions.js';
import { session } from './session.js';
import { health } from './health.js';
import { agentRun, agentRuns, repositoryRuns, runStatistics } from './agentRuns.js';
import { performanceMetrics } from './performanceMetrics.js';

export const resolvers = {
  sessions,
  session,
  health,
  agentRun,
  agentRuns,
  repositoryRuns,
  runStatistics,
  performanceMetrics
};