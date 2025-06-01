import { describe, it, expect, beforeEach } from 'vitest';
import { getUserConfig, setCurrentConfig } from '../getUserConfig';

describe('getUserConfig', () => {
  beforeEach(() => {
    // Reset config before each test
    setCurrentConfig(null as any);
  });

  it('should return default config when no config exists', async () => {
    const config = await getUserConfig();
    
    expect(config).toMatchObject({
      id: 'default',
      parallelism: {
        concurrentAgents: 3,
        concurrentShells: 5,
        enableParallelGit: true,
        batchSize: 5,
      },
      automation: {
        autoCommit: false,
        autoPush: false,
        autoRetry: true,
        maxRetries: 3,
        skipConfirmations: false,
      },
    });
    
    expect(config.createdAt).toBeDefined();
    expect(config.updatedAt).toBeDefined();
  });

  it('should return existing config when one is set', async () => {
    const customConfig = {
      id: 'custom',
      parallelism: {
        concurrentAgents: 5,
        concurrentShells: 10,
        enableParallelGit: false,
        batchSize: 10,
      },
      automation: {
        autoCommit: true,
        autoPush: true,
        autoRetry: false,
        maxRetries: 0,
        skipConfirmations: true,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    setCurrentConfig(customConfig);
    
    const config = await getUserConfig();
    expect(config).toEqual(customConfig);
  });
});