import type { ClaudeSessionManagerWithEvents } from '../services/ClaudeSessionManagerWithEvents.js';
import type { PreWarmSessionManager } from '../services/PreWarmSessionManager.js';
import type { PubSub } from 'mercurius';
import type { RunStorage } from '../services/RunStorage';
import type { DataLoaders } from '../dataloaders';
import type { GraphQLContext } from '@meta-gothic/shared-types';
import type { PerformanceMonitoringConfig } from '../../../shared/performance/config.js';

export interface Context extends GraphQLContext {
  sessionManager: ClaudeSessionManagerWithEvents;
  preWarmManager?: PreWarmSessionManager;
  workspaceRoot: string;
  runStorage: RunStorage;
  loaders: DataLoaders;
  pubsub?: PubSub;
  dataSources?: DataLoaders;
  // Performance monitoring support
  performanceConfig?: PerformanceMonitoringConfig;
  tokenUsage?: {
    input: number;
    output: number;
    estimatedCost?: number;
  };
  cacheHit?: boolean;
  graphqlInfo?: {
    fieldCount: number;
    complexity: number;
  };
}