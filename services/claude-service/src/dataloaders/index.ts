import DataLoader from 'dataloader';
import { RunStorage } from '../services/RunStorage';
import { ClaudeSessionManager } from '../services/ClaudeSessionManager';

export interface DataLoaders {
  agentRunLoader: DataLoader<string, any>;
  repositoryRunsLoader: DataLoader<string, any[]>;
  sessionLoader: DataLoader<string, any>;
}

export function createDataLoaders(
  runStorage: RunStorage,
  sessionManager: ClaudeSessionManager
): DataLoaders {
  // Batch load agent runs by ID
  const agentRunLoader = new DataLoader<string, any>(
    async (runIds) => {
      // Load all runs in parallel
      const runs = await Promise.all(
        runIds.map(id => runStorage.getRun(id))
      );
      return runs;
    },
    {
      // Cache for the duration of a single request
      cache: true,
      // Batch window of 10ms
      batchScheduleFn: (callback) => setTimeout(callback, 10)
    }
  );

  // Batch load runs by repository
  const repositoryRunsLoader = new DataLoader<string, any[]>(
    async (repositoryPaths) => {
      // Load runs for all repositories in parallel
      const results = await Promise.all(
        repositoryPaths.map(path => runStorage.getRunsByRepository(path))
      );
      return results;
    },
    {
      cache: true,
      batchScheduleFn: (callback) => setTimeout(callback, 10)
    }
  );

  // Batch load sessions by ID
  const sessionLoader = new DataLoader<string, any>(
    async (sessionIds) => {
      // Get all sessions from the manager
      const allSessions = sessionManager.getSessions();
      
      // Map requested IDs to sessions
      return sessionIds.map(id => 
        allSessions.find(session => session.id === id) || null
      );
    },
    {
      cache: true,
      // Sessions change frequently, so shorter cache
      cacheKeyFn: (key) => `session:${key}:${Date.now()}`,
      batchScheduleFn: (callback) => setTimeout(callback, 5)
    }
  );

  return {
    agentRunLoader,
    repositoryRunsLoader,
    sessionLoader
  };
}