export interface PerformanceMonitoringConfig {
  // Basic metrics (always enabled)
  basic: {
    duration: boolean;
    operationName: boolean;
    operationType: boolean;
    success: boolean;
  };
  
  // Resource metrics
  resources: {
    enabled: boolean;
    memory: {
      enabled: boolean;
      includeHeapUsed: boolean;
      includeHeapTotal: boolean;
      includeExternal: boolean;
      includeRSS: boolean;
      trackDelta: boolean; // Track change from start to end
    };
    cpu: {
      enabled: boolean;
      includeUser: boolean;
      includeSystem: boolean;
    };
  };
  
  // Data size metrics
  dataSize: {
    enabled: boolean;
    contextSize: boolean; // Size of input/args
    resultSize: boolean; // Size of output
    compressionRatio: boolean; // If compression is detected
  };
  
  // Network metrics
  network: {
    enabled: boolean;
    trackExternalCalls: boolean;
    trackDNSLookup: boolean;
    trackSSLHandshake: boolean;
    trackResponseTime: boolean;
  };
  
  // Cache metrics
  cache: {
    enabled: boolean;
    trackHitRate: boolean;
    trackMissRate: boolean;
    trackEvictions: boolean;
    trackSize: boolean;
  };
  
  // AI/ML specific metrics
  ai: {
    enabled: boolean;
    tokenUsage: {
      enabled: boolean;
      input: boolean;
      output: boolean;
      cost: boolean;
    };
    modelPerformance: {
      enabled: boolean;
      latency: boolean;
      throughput: boolean;
    };
  };
  
  // Database metrics
  database: {
    enabled: boolean;
    queryCount: boolean;
    queryDuration: boolean;
    connectionPoolStats: boolean;
    slowQueryThreshold: number;
  };
  
  // File system metrics
  fileSystem: {
    enabled: boolean;
    operations: {
      reads: boolean;
      writes: boolean;
      deletes: boolean;
    };
    dataTransfer: {
      bytesRead: boolean;
      bytesWritten: boolean;
    };
  };
  
  // GraphQL specific metrics
  graphql: {
    enabled: boolean;
    queryComplexity: boolean;
    fieldCount: boolean;
    depthAnalysis: boolean;
    resolverCount: boolean;
    errorRate: boolean;
  };
  
  // Performance analysis
  analysis: {
    enabled: boolean;
    performanceScore: boolean; // 0-100 score
    bottleneckDetection: boolean;
    trendAnalysis: boolean; // Compare with historical data
    anomalyDetection: boolean;
  };
  
  // Thresholds and alerts
  thresholds: {
    slowOperationMs: number;
    claudeSlowOperationMs: number;  // Separate threshold for Claude operations
    maxOperationMs: number;          // Maximum before considering stale
    highMemoryMB: number;
    highCPUMs: number;
    largePayloadKB: number;
    lowPerformanceScore: number;
  };
  
  // Sampling and filtering
  sampling: {
    enabled: boolean;
    rate: number; // 0.0 to 1.0 (percentage of operations to monitor)
    alwaysSampleSlow: boolean; // Always sample slow operations
    excludePatterns: string[]; // Operation names to exclude
    includePatterns: string[]; // Operation names to always include
  };
}

// Default configuration (minimal overhead)
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceMonitoringConfig = {
  basic: {
    duration: true,
    operationName: true,
    operationType: true,
    success: true
  },
  resources: {
    enabled: false,
    memory: {
      enabled: false,
      includeHeapUsed: true,
      includeHeapTotal: false,
      includeExternal: false,
      includeRSS: false,
      trackDelta: true
    },
    cpu: {
      enabled: false,
      includeUser: true,
      includeSystem: true
    }
  },
  dataSize: {
    enabled: false,
    contextSize: true,
    resultSize: true,
    compressionRatio: false
  },
  network: {
    enabled: false,
    trackExternalCalls: true,
    trackDNSLookup: false,
    trackSSLHandshake: false,
    trackResponseTime: true
  },
  cache: {
    enabled: true,
    trackHitRate: true,
    trackMissRate: true,
    trackEvictions: false,
    trackSize: false
  },
  ai: {
    enabled: false,
    tokenUsage: {
      enabled: true,
      input: true,
      output: true,
      cost: true
    },
    modelPerformance: {
      enabled: false,
      latency: true,
      throughput: false
    }
  },
  database: {
    enabled: false,
    queryCount: true,
    queryDuration: true,
    connectionPoolStats: false,
    slowQueryThreshold: 100
  },
  fileSystem: {
    enabled: false,
    operations: {
      reads: true,
      writes: true,
      deletes: true
    },
    dataTransfer: {
      bytesRead: true,
      bytesWritten: true
    }
  },
  graphql: {
    enabled: true,
    queryComplexity: false,
    fieldCount: true,
    depthAnalysis: false,
    resolverCount: true,
    errorRate: true
  },
  analysis: {
    enabled: false,
    performanceScore: true,
    bottleneckDetection: false,
    trendAnalysis: false,
    anomalyDetection: false
  },
  thresholds: {
    slowOperationMs: 30000,       // 30 seconds for regular operations
    claudeSlowOperationMs: 60000, // 1 minute for Claude operations
    maxOperationMs: 1800000,      // 30 minutes before considering stale
    highMemoryMB: 500,            // Higher for long-running ops
    highCPUMs: 10000,             // 10 seconds CPU time
    largePayloadKB: 1024,
    lowPerformanceScore: 70
  },
  sampling: {
    enabled: false,
    rate: 1.0,
    alwaysSampleSlow: true,
    excludePatterns: [],
    includePatterns: []
  }
};

// Development configuration (all metrics enabled)
export const DEVELOPMENT_PERFORMANCE_CONFIG: PerformanceMonitoringConfig = {
  ...DEFAULT_PERFORMANCE_CONFIG,
  resources: {
    enabled: true,
    memory: {
      enabled: true,
      includeHeapUsed: true,
      includeHeapTotal: true,
      includeExternal: true,
      includeRSS: true,
      trackDelta: true
    },
    cpu: {
      enabled: true,
      includeUser: true,
      includeSystem: true
    }
  },
  dataSize: {
    enabled: true,
    contextSize: true,
    resultSize: true,
    compressionRatio: true
  },
  analysis: {
    enabled: true,
    performanceScore: true,
    bottleneckDetection: true,
    trendAnalysis: true,
    anomalyDetection: true
  }
};

// Production configuration (balanced)
export const PRODUCTION_PERFORMANCE_CONFIG: PerformanceMonitoringConfig = {
  ...DEFAULT_PERFORMANCE_CONFIG,
  sampling: {
    enabled: true,
    rate: 0.1, // Sample 10% of operations
    alwaysSampleSlow: true,
    excludePatterns: ['healthCheck', 'metrics', '__schema'],
    includePatterns: ['mutation.*', 'claude.*', 'execute.*', 'generateCommit.*']
  },
  analysis: {
    enabled: true,
    performanceScore: true,
    bottleneckDetection: true,
    trendAnalysis: false,
    anomalyDetection: false
  }
};

// Debugging configuration (focused on specific areas)
export const DEBUG_PERFORMANCE_CONFIG: PerformanceMonitoringConfig = {
  ...DEVELOPMENT_PERFORMANCE_CONFIG,
  network: {
    enabled: true,
    trackExternalCalls: true,
    trackDNSLookup: true,
    trackSSLHandshake: true,
    trackResponseTime: true
  },
  database: {
    enabled: true,
    queryCount: true,
    queryDuration: true,
    connectionPoolStats: true,
    slowQueryThreshold: 50
  },
  fileSystem: {
    enabled: true,
    operations: {
      reads: true,
      writes: true,
      deletes: true
    },
    dataTransfer: {
      bytesRead: true,
      bytesWritten: true
    }
  }
};

// Helper to merge configs
export function mergePerformanceConfig(
  base: PerformanceMonitoringConfig,
  overrides: Partial<PerformanceMonitoringConfig>
): PerformanceMonitoringConfig {
  return {
    ...base,
    ...overrides,
    basic: { ...base.basic, ...overrides.basic },
    resources: {
      ...base.resources,
      ...overrides.resources,
      memory: { ...base.resources.memory, ...overrides.resources?.memory },
      cpu: { ...base.resources.cpu, ...overrides.resources?.cpu }
    },
    dataSize: { ...base.dataSize, ...overrides.dataSize },
    network: { ...base.network, ...overrides.network },
    cache: { ...base.cache, ...overrides.cache },
    ai: {
      ...base.ai,
      ...overrides.ai,
      tokenUsage: { ...base.ai.tokenUsage, ...overrides.ai?.tokenUsage },
      modelPerformance: { ...base.ai.modelPerformance, ...overrides.ai?.modelPerformance }
    },
    database: { ...base.database, ...overrides.database },
    fileSystem: {
      ...base.fileSystem,
      ...overrides.fileSystem,
      operations: { ...base.fileSystem.operations, ...overrides.fileSystem?.operations },
      dataTransfer: { ...base.fileSystem.dataTransfer, ...overrides.fileSystem?.dataTransfer }
    },
    graphql: { ...base.graphql, ...overrides.graphql },
    analysis: { ...base.analysis, ...overrides.analysis },
    thresholds: { ...base.thresholds, ...overrides.thresholds },
    sampling: { ...base.sampling, ...overrides.sampling }
  };
}

// Load config from environment
export function loadPerformanceConfig(): PerformanceMonitoringConfig {
  const env = process.env.NODE_ENV || 'development';
  const perfMode = process.env.PERFORMANCE_MODE || env;
  
  switch (perfMode) {
    case 'production':
      return PRODUCTION_PERFORMANCE_CONFIG;
    case 'development':
      return DEVELOPMENT_PERFORMANCE_CONFIG;
    case 'debug':
      return DEBUG_PERFORMANCE_CONFIG;
    case 'minimal':
      return DEFAULT_PERFORMANCE_CONFIG;
    default:
      // Allow JSON config from environment
      if (process.env.PERFORMANCE_CONFIG) {
        try {
          const customConfig = JSON.parse(process.env.PERFORMANCE_CONFIG);
          return mergePerformanceConfig(DEFAULT_PERFORMANCE_CONFIG, customConfig);
        } catch (e) {
          console.warn('Invalid PERFORMANCE_CONFIG JSON, using default');
        }
      }
      return DEFAULT_PERFORMANCE_CONFIG;
  }
}