export interface PerformanceMonitoringConfig {
    basic: {
        duration: boolean;
        operationName: boolean;
        operationType: boolean;
        success: boolean;
    };
    resources: {
        enabled: boolean;
        memory: {
            enabled: boolean;
            includeHeapUsed: boolean;
            includeHeapTotal: boolean;
            includeExternal: boolean;
            includeRSS: boolean;
            trackDelta: boolean;
        };
        cpu: {
            enabled: boolean;
            includeUser: boolean;
            includeSystem: boolean;
        };
    };
    dataSize: {
        enabled: boolean;
        contextSize: boolean;
        resultSize: boolean;
        compressionRatio: boolean;
    };
    network: {
        enabled: boolean;
        trackExternalCalls: boolean;
        trackDNSLookup: boolean;
        trackSSLHandshake: boolean;
        trackResponseTime: boolean;
    };
    cache: {
        enabled: boolean;
        trackHitRate: boolean;
        trackMissRate: boolean;
        trackEvictions: boolean;
        trackSize: boolean;
    };
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
    database: {
        enabled: boolean;
        queryCount: boolean;
        queryDuration: boolean;
        connectionPoolStats: boolean;
        slowQueryThreshold: number;
    };
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
    graphql: {
        enabled: boolean;
        queryComplexity: boolean;
        fieldCount: boolean;
        depthAnalysis: boolean;
        resolverCount: boolean;
        errorRate: boolean;
    };
    analysis: {
        enabled: boolean;
        performanceScore: boolean;
        bottleneckDetection: boolean;
        trendAnalysis: boolean;
        anomalyDetection: boolean;
    };
    thresholds: {
        slowOperationMs: number;
        claudeSlowOperationMs: number;
        maxOperationMs: number;
        highMemoryMB: number;
        highCPUMs: number;
        largePayloadKB: number;
        lowPerformanceScore: number;
    };
    sampling: {
        enabled: boolean;
        rate: number;
        alwaysSampleSlow: boolean;
        excludePatterns: string[];
        includePatterns: string[];
    };
}
export declare const DEFAULT_PERFORMANCE_CONFIG: PerformanceMonitoringConfig;
export declare const DEVELOPMENT_PERFORMANCE_CONFIG: PerformanceMonitoringConfig;
export declare const PRODUCTION_PERFORMANCE_CONFIG: PerformanceMonitoringConfig;
export declare const DEBUG_PERFORMANCE_CONFIG: PerformanceMonitoringConfig;
export declare function mergePerformanceConfig(base: PerformanceMonitoringConfig, overrides: Partial<PerformanceMonitoringConfig>): PerformanceMonitoringConfig;
export declare function loadPerformanceConfig(): PerformanceMonitoringConfig;
//# sourceMappingURL=config.d.ts.map