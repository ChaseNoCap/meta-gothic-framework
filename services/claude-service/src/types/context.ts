import type { ClaudeSessionManagerWithEvents } from '../services/ClaudeSessionManagerWithEvents.js';
import type { PubSub } from 'mercurius';
import type { RunStorage } from '../services/RunStorage';
import type { DataLoaders } from '../dataloaders';
import type { GraphQLContext } from '@meta-gothic/shared-types';

export interface Context extends GraphQLContext {
  sessionManager: ClaudeSessionManagerWithEvents;
  workspaceRoot: string;
  runStorage: RunStorage;
  loaders: DataLoaders;
  pubsub?: PubSub;
  dataSources?: DataLoaders;
}