import { queries } from './queries/index.js';
import { mutations } from './mutations/index.js';
import { subscriptions } from './subscriptions/index.js';

export const resolvers = {
  Query: queries,
  Mutation: mutations,
  Subscription: subscriptions,
  
  // Type resolvers
  FileQuality: {
    trends: async (parent: any, _args: any, context: any) => {
      // TODO: Implement trend data loading
      return null;
    }
  },
  
  ViolationSeverity: {
    ERROR: 'ERROR',
    WARNING: 'WARNING',
    INFO: 'INFO',
    HINT: 'HINT'
  },
  
  SessionType: {
    MANUAL: 'MANUAL',
    WATCH: 'WATCH',
    CI: 'CI',
    MCP: 'MCP'
  },
  
  TrendDirection: {
    IMPROVING: 'IMPROVING',
    DECLINING: 'DECLINING',
    STABLE: 'STABLE'
  },
  
  ImpactLevel: {
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW'
  },
  
  EffortLevel: {
    MINIMAL: 'MINIMAL',
    MODERATE: 'MODERATE',
    SIGNIFICANT: 'SIGNIFICANT'
  },
  
  SuggestionCategory: {
    PERFORMANCE: 'PERFORMANCE',
    MAINTAINABILITY: 'MAINTAINABILITY',
    SECURITY: 'SECURITY',
    TESTING: 'TESTING',
    DOCUMENTATION: 'DOCUMENTATION'
  },
  
  UpdateType: {
    FILE_ANALYZED: 'FILE_ANALYZED',
    SESSION_COMPLETE: 'SESSION_COMPLETE',
    ERROR: 'ERROR',
    PROGRESS: 'PROGRESS'
  },
  
  EventType: {
    VIOLATION_FOUND: 'VIOLATION_FOUND',
    VIOLATION_FIXED: 'VIOLATION_FIXED',
    VIOLATION_IGNORED: 'VIOLATION_IGNORED'
  },
  
  ChangeType: {
    IMPROVED: 'IMPROVED',
    DEGRADED: 'DEGRADED',
    UNCHANGED: 'UNCHANGED'
  }
};