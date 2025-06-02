import type { ClaudeSessionManager } from '../services/ClaudeSessionManager.js';
import type { PubSub } from 'mercurius';
import type { RunStorage } from '../services/RunStorage';
import type { DataLoaders } from '../dataloaders';

export interface Context {
  sessionManager: ClaudeSessionManager;
  workspaceRoot: string;
  runStorage: RunStorage;
  loaders: DataLoaders;
  pubsub?: PubSub;
  request?: any;
}