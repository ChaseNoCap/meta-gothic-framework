import { sessions } from './sessions.js';
import { session } from './session.js';
import { health } from './health.js';
import { performanceMetrics } from './performanceMetrics.js';

export const resolvers = {
  sessions,
  session,
  claudeHealth: health,
  performanceMetrics
};