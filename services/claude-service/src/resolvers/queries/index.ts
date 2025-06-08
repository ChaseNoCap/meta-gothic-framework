import { sessions } from './sessions.js';
import { session } from './session.js';
import { health } from './health.js';
import { performanceMetrics } from './performanceMetrics.js';
import { 
  sessionAnalytics, 
  batchSessionAnalytics, 
  sessionTemplates, 
  sessionTemplate,
  sessionResumption,
  resumableSessions
} from './sessionAnalytics.js';
import { preWarmStatus } from './preWarmStatus.js';
import { preWarmMetrics } from './preWarmMetrics.js';

export const resolvers = {
  sessions,
  session,
  health,
  performanceMetrics,
  sessionAnalytics,
  batchSessionAnalytics,
  sessionTemplates,
  sessionTemplate,
  sessionResumption,
  resumableSessions,
  preWarmStatus,
  preWarmMetrics
};