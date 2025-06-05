import type { IEventBus } from '@chasenocap/event-system';
import type { ILogger } from '@chasenocap/logger';
import { PerformanceMonitoringConfig, loadPerformanceConfig, DEFAULT_PERFORMANCE_CONFIG } from './config.js';

export interface PerformanceMetrics {
  operationName: string;
  operationType: 'query' | 'mutation' | 'subscription' | 'resolver' | 'api-call' | 'db-query' | 'cache-operation' | 'file-operation';
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
  error?: Error;
  correlationId?: string;
  // Additional metrics
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpuUsage?: {
    user: number;
    system: number;
  };
  contextSize?: number; // Size of GraphQL context or request payload
  resultSize?: number; // Size of response
  cacheHit?: boolean;
  queryComplexity?: number; // For GraphQL queries
  tokenCount?: { // For AI operations
    input: number;
    output: number;
  };
  fileOperations?: {
    reads: number;
    writes: number;
    bytesRead: number;
    bytesWritten: number;
  };
  networkCalls?: {
    count: number;
    totalDuration: number;
  };
}

export class PerformanceMonitor {
  private activeOperations: Map<string, PerformanceMetrics> = new Map();
  private config: PerformanceMonitoringConfig;
  private metricsHistory: PerformanceMetrics[] = [];
  private maxHistorySize = 10000;
  
  constructor(
    private eventBus?: IEventBus,
    private logger?: ILogger,
    private slowThreshold?: number,
    config?: Partial<PerformanceMonitoringConfig>
  ) {
    this.config = config ? { ...loadPerformanceConfig(), ...config } : loadPerformanceConfig();
    if (this.slowThreshold === undefined) {
      this.slowThreshold = this.config.thresholds.slowOperationMs;
    }
  }

  startOperation(
    operationId: string,
    operationName: string,
    operationType: PerformanceMetrics['operationType'],
    metadata?: Record<string, any>,
    correlationId?: string
  ): void {
    // Check sampling configuration
    if (this.config.sampling.enabled && !this.shouldSample(operationName)) {
      return;
    }
    
    const metrics: PerformanceMetrics = {
      operationName,
      operationType,
      startTime: Date.now(),
      metadata: metadata || {},
      correlationId
    };
    
    // Conditionally capture initial memory usage
    if (this.config.resources.enabled && this.config.resources.memory.enabled) {
      const initialMemory = process.memoryUsage();
      metrics.metadata!.initialMemory = initialMemory;
      
      metrics.memoryUsage = {
        heapUsed: this.config.resources.memory.includeHeapUsed ? initialMemory.heapUsed : 0,
        heapTotal: this.config.resources.memory.includeHeapTotal ? initialMemory.heapTotal : 0,
        external: this.config.resources.memory.includeExternal ? initialMemory.external : 0,
        rss: this.config.resources.memory.includeRSS ? initialMemory.rss : 0
      };
    }
    
    // Conditionally capture initial CPU usage
    if (this.config.resources.enabled && this.config.resources.cpu.enabled) {
      metrics.metadata!.initialCpu = process.cpuUsage();
    }
    
    this.activeOperations.set(operationId, metrics);
    
    // Conditional logging based on config
    if (this.logger && this.config.basic.operationName) {
      const logData: any = {
        operationId,
        correlationId
      };
      
      if (this.config.resources.memory.enabled && metrics.memoryUsage) {
        logData.initialMemory = `${Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024)}MB`;
      }
      
      this.logger.debug(`Performance monitoring started for ${operationType}: ${operationName}`, logData);
    }
    
    // Emit performance start event if basic metrics are enabled
    if (this.eventBus && this.config.basic.operationName) {
      this.eventBus.emit({
        type: 'performance.operation.started',
        timestamp: Date.now(),
        payload: {
          operationId,
          operationName: this.config.basic.operationName ? operationName : undefined,
          operationType: this.config.basic.operationType ? operationType : undefined,
          metadata,
          correlationId,
          memoryUsage: this.config.resources.memory.enabled ? metrics.memoryUsage : undefined
        }
      });
    }
  }
  
  private shouldSample(operationName: string): boolean {
    // Always include if in include patterns
    if (this.config.sampling.includePatterns.length > 0) {
      for (const pattern of this.config.sampling.includePatterns) {
        if (operationName.match(new RegExp(pattern))) {
          return true;
        }
      }
    }
    
    // Always exclude if in exclude patterns
    if (this.config.sampling.excludePatterns.length > 0) {
      for (const pattern of this.config.sampling.excludePatterns) {
        if (operationName.match(new RegExp(pattern))) {
          return false;
        }
      }
    }
    
    // Random sampling
    return Math.random() < this.config.sampling.rate;
  }

  endOperation(operationId: string, error?: Error, additionalMetrics?: Partial<PerformanceMetrics>): PerformanceMetrics | null {
    const metrics = this.activeOperations.get(operationId);
    if (!metrics) {
      // Only log if we're not sampling (otherwise it's expected)
      if (!this.config.sampling.enabled) {
        this.logger?.warn(`No active operation found for ID: ${operationId}`);
      }
      return null;
    }
    
    // Basic duration calculation (always enabled)
    metrics.endTime = Date.now();
    metrics.duration = metrics.endTime - metrics.startTime;
    metrics.error = error;
    
    // Calculate resource usage deltas if enabled
    if (this.config.resources.enabled) {
      if (this.config.resources.memory.enabled && metrics.metadata?.initialMemory) {
        const finalMemory = process.memoryUsage();
        const initialMemory = metrics.metadata.initialMemory;
        
        metrics.memoryUsage = {
          heapUsed: this.config.resources.memory.trackDelta 
            ? finalMemory.heapUsed - initialMemory.heapUsed 
            : finalMemory.heapUsed,
          heapTotal: this.config.resources.memory.includeHeapTotal ? finalMemory.heapTotal : 0,
          external: this.config.resources.memory.includeExternal ? finalMemory.external : 0,
          rss: this.config.resources.memory.includeRSS ? finalMemory.rss : 0
        };
      }
      
      if (this.config.resources.cpu.enabled && metrics.metadata?.initialCpu) {
        const finalCpu = process.cpuUsage();
        const initialCpu = metrics.metadata.initialCpu;
        
        metrics.cpuUsage = {
          user: this.config.resources.cpu.includeUser 
            ? (finalCpu.user - initialCpu.user) / 1000 
            : 0,
          system: this.config.resources.cpu.includeSystem 
            ? (finalCpu.system - initialCpu.system) / 1000 
            : 0
        };
      }
    }
    
    // Merge additional metrics if provided
    if (additionalMetrics) {
      // Only merge enabled metrics
      const filteredMetrics: Partial<PerformanceMetrics> = {};
      
      if (this.config.dataSize.enabled) {
        if (this.config.dataSize.contextSize && additionalMetrics.contextSize !== undefined) {
          filteredMetrics.contextSize = additionalMetrics.contextSize;
        }
        if (this.config.dataSize.resultSize && additionalMetrics.resultSize !== undefined) {
          filteredMetrics.resultSize = additionalMetrics.resultSize;
        }
      }
      
      if (this.config.cache.enabled && additionalMetrics.cacheHit !== undefined) {
        filteredMetrics.cacheHit = additionalMetrics.cacheHit;
      }
      
      if (this.config.ai.enabled && this.config.ai.tokenUsage.enabled && additionalMetrics.tokenCount) {
        filteredMetrics.tokenCount = additionalMetrics.tokenCount;
      }
      
      Object.assign(metrics, filteredMetrics);
    }
    
    // Remove from active operations
    this.activeOperations.delete(operationId);
    
    // Calculate performance score if analysis is enabled
    let performanceScore: number | undefined;
    if (this.config.analysis.enabled && this.config.analysis.performanceScore) {
      performanceScore = this.calculatePerformanceScore(metrics);
    }
    
    // Check if operation is slow (use Claude-specific threshold for AI operations)
    const isClaudeOperation = metrics.operationType === 'api-call' && 
                              (metrics.operationName.includes('claude') || metrics.operationName.includes('execute'));
    const slowThreshold = isClaudeOperation ? 
                          this.config.thresholds.claudeSlowOperationMs : 
                          this.config.thresholds.slowOperationMs;
    const isSlow = (metrics.duration || 0) > slowThreshold || 
                   (performanceScore !== undefined && performanceScore < this.config.thresholds.lowPerformanceScore);
    
    // Always sample slow operations if configured
    if (this.config.sampling.enabled && this.config.sampling.alwaysSampleSlow && isSlow && 
        !this.metricsHistory.find(m => m.operationName === metrics.operationName)) {
      // Force sampling for slow operations
      this.storeMetric(metrics);
    }
    
    // Conditional logging
    if (this.logger) {
      const logData: any = {
        operationId,
        operationName: metrics.operationName,
        operationType: metrics.operationType,
        duration: metrics.duration
      };
      
      if (this.config.resources.memory.enabled && metrics.memoryUsage) {
        logData.memoryDelta = `${Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024)}MB`;
      }
      
      if (this.config.resources.cpu.enabled && metrics.cpuUsage) {
        logData.cpuTime = `${Math.round(metrics.cpuUsage.user + metrics.cpuUsage.system)}ms`;
      }
      
      if (performanceScore !== undefined) {
        logData.performanceScore = performanceScore;
      }
      
      if (this.config.cache.enabled) {
        logData.cacheHit = metrics.cacheHit;
      }
      
      logData.correlationId = metrics.correlationId;
      logData.error = error?.message;
      
      if (isSlow) {
        this.logger.warn(`Slow ${metrics.operationType} detected: ${metrics.operationName}`, logData);
      } else if (this.config.basic.duration) {
        this.logger.debug(`${metrics.operationType} completed: ${metrics.operationName}`, logData);
      }
    }
    
    // Emit performance end event
    if (this.eventBus) {
      const payload: any = {
        operationId,
        operationName: this.config.basic.operationName ? metrics.operationName : undefined,
        operationType: this.config.basic.operationType ? metrics.operationType : undefined,
        duration: this.config.basic.duration ? metrics.duration : undefined,
        isSlow,
        success: this.config.basic.success ? !error : undefined,
        error: error?.message,
        correlationId: metrics.correlationId
      };
      
      if (this.config.resources.memory.enabled) {
        payload.memoryUsage = metrics.memoryUsage;
      }
      
      if (this.config.resources.cpu.enabled) {
        payload.cpuUsage = metrics.cpuUsage;
      }
      
      if (performanceScore !== undefined) {
        payload.performanceScore = performanceScore;
      }
      
      if (this.config.cache.enabled) {
        payload.cacheHit = metrics.cacheHit;
      }
      
      if (this.config.dataSize.enabled) {
        payload.contextSize = metrics.contextSize;
        payload.resultSize = metrics.resultSize;
      }
      
      this.eventBus.emit({
        type: 'performance.operation.completed',
        timestamp: Date.now(),
        payload
      });
      
      // Emit slow operation event if needed
      if (isSlow) {
        this.eventBus.emit({
          type: 'performance.slow.operation',
          timestamp: Date.now(),
          payload: {
            ...payload,
            threshold: this.slowThreshold
          }
        });
      }
    }
    
    // Store metric in history if enabled
    this.storeMetric(metrics);
    
    return metrics;
  }
  
  private storeMetric(metric: PerformanceMetrics): void {
    this.metricsHistory.push(metric);
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  private calculatePerformanceScore(metrics: PerformanceMetrics): number {
    let score = 100;
    
    // Duration penalty (up to 40 points)
    if (metrics.duration) {
      if (metrics.duration > 1000) score -= 40;
      else if (metrics.duration > 500) score -= 30;
      else if (metrics.duration > 200) score -= 20;
      else if (metrics.duration > 100) score -= 10;
    }
    
    // Memory usage penalty (up to 30 points)
    if (metrics.memoryUsage) {
      const memMB = metrics.memoryUsage.heapUsed / 1024 / 1024;
      if (memMB > 100) score -= 30;
      else if (memMB > 50) score -= 20;
      else if (memMB > 20) score -= 10;
    }
    
    // CPU usage penalty (up to 20 points)
    if (metrics.cpuUsage) {
      const cpuMs = metrics.cpuUsage.user + metrics.cpuUsage.system;
      if (cpuMs > 500) score -= 20;
      else if (cpuMs > 200) score -= 15;
      else if (cpuMs > 100) score -= 10;
    }
    
    // Cache bonus (up to 10 points)
    if (metrics.cacheHit) {
      score += 10;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  // Decorator for performance monitoring
  static monitor(
    operationType: PerformanceMetrics['operationType'] = 'resolver', 
    options?: {
      slowThreshold?: number;
      config?: Partial<PerformanceMonitoringConfig>;
    }
  ) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;
      
      descriptor.value = async function (...args: any[]) {
        const context = args.find(arg => arg?.eventBus || arg?.logger || arg?.correlationId);
        
        // Check if performance monitoring is enabled in context
        if (context?.performanceConfig?.disabled) {
          return originalMethod.apply(this, args);
        }
        
        const monitor = new PerformanceMonitor(
          context?.eventBus,
          context?.logger,
          options?.slowThreshold,
          options?.config || context?.performanceConfig
        );
        
        const operationId = `${propertyKey}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Calculate context size if enabled
        let contextSize: number | undefined;
        if (monitor.config.dataSize.enabled && monitor.config.dataSize.contextSize) {
          try {
            contextSize = JSON.stringify(args).length;
          } catch {
            // Circular reference or other serialization error
            contextSize = -1;
          }
        }
        
        monitor.startOperation(
          operationId,
          propertyKey,
          operationType,
          { 
            args: args.length,
            contextSize,
            className: target.constructor.name,
            methodSignature: `${target.constructor.name}.${propertyKey}`
          },
          context?.correlationId
        );
        
        // Track network calls if enabled
        let networkCallCount = 0;
        let networkDuration = 0;
        if (monitor.config.network.enabled && monitor.config.network.trackExternalCalls) {
          // Hook into fetch/http if needed
          // This is a simplified example - real implementation would be more sophisticated
        }
        
        try {
          const result = await originalMethod.apply(this, args);
          
          // Collect additional metrics based on configuration
          const additionalMetrics: Partial<PerformanceMetrics> = {};
          
          // Calculate result size if enabled
          if (monitor.config.dataSize.enabled && monitor.config.dataSize.resultSize) {
            try {
              additionalMetrics.resultSize = JSON.stringify(result || {}).length;
            } catch {
              additionalMetrics.resultSize = -1;
            }
          }
          
          // Check cache hit
          if (monitor.config.cache.enabled) {
            additionalMetrics.cacheHit = result?._cacheHit || context?.cacheHit || false;
          }
          
          // Extract AI metrics
          if (monitor.config.ai.enabled && monitor.config.ai.tokenUsage.enabled) {
            const tokenUsage = result?.tokenUsage || context?.tokenUsage;
            if (tokenUsage) {
              additionalMetrics.tokenCount = {
                input: monitor.config.ai.tokenUsage.input ? tokenUsage.input : 0,
                output: monitor.config.ai.tokenUsage.output ? tokenUsage.output : 0
              };
            }
          }
          
          // Extract GraphQL metrics
          if (monitor.config.graphql.enabled && context?.graphqlInfo) {
            if (monitor.config.graphql.fieldCount) {
              additionalMetrics.metadata = {
                ...additionalMetrics.metadata,
                fieldCount: context.graphqlInfo.fieldCount
              };
            }
            if (monitor.config.graphql.queryComplexity) {
              additionalMetrics.queryComplexity = context.graphqlInfo.complexity;
            }
          }
          
          // Network metrics
          if (networkCallCount > 0) {
            additionalMetrics.networkCalls = {
              count: networkCallCount,
              totalDuration: networkDuration
            };
          }
          
          monitor.endOperation(operationId, undefined, additionalMetrics);
          
          return result;
        } catch (error) {
          monitor.endOperation(operationId, error as Error, {
            contextSize
          });
          throw error;
        }
      };
      
      return descriptor;
    };
  }

  // Get current active operations (useful for debugging)
  getActiveOperations(): PerformanceMetrics[] {
    return Array.from(this.activeOperations.values());
  }

  // Clear any stale operations (cleanup)
  clearStaleOperations(maxAge?: number): number {
    const effectiveMaxAge = maxAge || this.config.thresholds.maxOperationMs || 1800000; // 30 minutes default
    const now = Date.now();
    let cleared = 0;
    
    for (const [id, metrics] of this.activeOperations.entries()) {
      if (now - metrics.startTime > effectiveMaxAge) {
        this.logger?.warn(`Clearing stale operation: ${metrics.operationName}`, {
          operationId: id,
          age: now - metrics.startTime
        });
        this.activeOperations.delete(id);
        cleared++;
      }
    }
    
    return cleared;
  }
}

// Performance tracking middleware for GraphQL
export function createPerformancePlugin(serviceName: string, slowThreshold = 500) {
  return {
    onExecute() {
      return {
        onExecuteDone({ args, result }: any) {
          const context = args.contextValue;
          const operationName = args.document.definitions[0]?.name?.value || 'anonymous';
          const operationType = args.document.definitions[0]?.operation || 'unknown';
          
          // Duration is already tracked by event tracking plugin
          // This is for additional performance-specific logging
          if (context?.performanceMetrics) {
            const duration = context.performanceMetrics.duration;
            
            if (duration > slowThreshold) {
              context.logger?.warn(`Slow GraphQL ${operationType} detected`, {
                operationName,
                operationType,
                duration,
                service: serviceName,
                correlationId: context.correlationId
              });
            }
          }
        }
      };
    }
  };
}