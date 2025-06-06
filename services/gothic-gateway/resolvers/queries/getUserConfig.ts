import { UserConfig } from '../../generated/graphql';

// Default configuration values
const DEFAULT_CONFIG: UserConfig = {
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

// In-memory storage for now, will migrate to database later
let currentConfig: UserConfig | null = null;

// Helper to get config from localStorage (for browser persistence)
function loadConfigFromStorage(): UserConfig | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem('meta-gothic-user-config');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load config from storage:', error);
  }
  
  return null;
}

// Helper to save config to localStorage
export function saveConfigToStorage(config: UserConfig): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem('meta-gothic-user-config', JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save config to storage:', error);
  }
}

export async function getUserConfig(): Promise<UserConfig> {
  // Try to load from memory first
  if (currentConfig) {
    return currentConfig;
  }
  
  // Try to load from localStorage
  const storedConfig = loadConfigFromStorage();
  if (storedConfig) {
    currentConfig = storedConfig;
    return storedConfig;
  }
  
  // Return default config and save it
  currentConfig = { ...DEFAULT_CONFIG };
  saveConfigToStorage(currentConfig);
  return currentConfig;
}

// Export for use in mutations
export function getCurrentConfig(): UserConfig | null {
  return currentConfig;
}

export function setCurrentConfig(config: UserConfig): void {
  currentConfig = config;
  saveConfigToStorage(config);
}