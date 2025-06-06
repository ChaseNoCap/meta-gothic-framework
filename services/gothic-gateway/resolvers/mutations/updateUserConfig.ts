import { UserConfig, UpdateUserConfigInput } from '../../generated/graphql';
import { getUserConfig, setCurrentConfig } from '../queries/getUserConfig';

export async function updateUserConfig(
  _parent: unknown,
  { input }: { input: UpdateUserConfigInput }
): Promise<UserConfig> {
  // Get current config
  const currentConfig = await getUserConfig();
  
  // Create updated config by merging changes
  const updatedConfig: UserConfig = {
    ...currentConfig,
    parallelism: {
      ...currentConfig.parallelism,
      ...(input.parallelism || {}),
    },
    automation: {
      ...currentConfig.automation,
      ...(input.automation || {}),
    },
    updatedAt: new Date().toISOString(),
  };
  
  // Validate constraints
  if (updatedConfig.parallelism.concurrentAgents < 1) {
    updatedConfig.parallelism.concurrentAgents = 1;
  }
  if (updatedConfig.parallelism.concurrentAgents > 10) {
    updatedConfig.parallelism.concurrentAgents = 10;
  }
  
  if (updatedConfig.parallelism.concurrentShells < 1) {
    updatedConfig.parallelism.concurrentShells = 1;
  }
  if (updatedConfig.parallelism.concurrentShells > 20) {
    updatedConfig.parallelism.concurrentShells = 20;
  }
  
  if (updatedConfig.parallelism.batchSize < 1) {
    updatedConfig.parallelism.batchSize = 1;
  }
  if (updatedConfig.parallelism.batchSize > 20) {
    updatedConfig.parallelism.batchSize = 20;
  }
  
  if (updatedConfig.automation.maxRetries < 0) {
    updatedConfig.automation.maxRetries = 0;
  }
  if (updatedConfig.automation.maxRetries > 10) {
    updatedConfig.automation.maxRetries = 10;
  }
  
  // Save updated config
  setCurrentConfig(updatedConfig);
  
  return updatedConfig;
}

export async function resetUserConfig(): Promise<UserConfig> {
  // Create fresh default config
  const defaultConfig: UserConfig = {
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  // Save as current config
  setCurrentConfig(defaultConfig);
  
  return defaultConfig;
}