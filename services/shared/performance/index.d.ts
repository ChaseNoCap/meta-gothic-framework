import type { IEventBus } from '@chasenocap/event-system';
import type { ILogger } from '@chasenocap/logger';
import { PerformanceMonitoringConfig } from './config.js';
export interface PerformanceMetrics {
    operationName: string;
    operationType: 'query' | 'mutation' | 'subscription' | 'resolver' | 'api-call' | 'db-query' | 'cache-operation' | 'file-operation';
    startTime: number;
    endTime?: number;
    duration?: number;
    metadata?: Record<string, any>;
    error?: Error;
    correlationId?: string;
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
    contextSize?: number;
    resultSize?: number;
    cacheHit?: boolean;
    queryComplexity?: number;
    tokenCount?: {
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
export declare class PerformanceMonitor {
    private eventBus?;
    private logger?;
    private slowThreshold?;
    private activeOperations;
    private config;
    private metricsHistory;
    private maxHistorySize;
    constructor(eventBus?: IEventBus | undefined, logger?: ILogger | undefined, slowThreshold?: number | undefined, config?: Partial<PerformanceMonitoringConfig>);
    startOperation(operationId: string, operationName: string, operationType: PerformanceMetrics['operationType'], metadata?: Record<string, any>, correlationId?: string): void;
    private shouldSample;
    endOperation(operationId: string, error?: Error, additionalMetrics?: Partial<PerformanceMetrics>): PerformanceMetrics | null;
    private storeMetric;
    private calculatePerformanceScore;
    static monitor(operationType?: PerformanceMetrics['operationType'], options?: {
        slowThreshold?: number;
        config?: Partial<PerformanceMonitoringConfig>;
    }): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
    getActiveOperations(): PerformanceMetrics[];
    clearStaleOperations(maxAge?: number): number;
}
export declare function createPerformancePlugin(serviceName: string, slowThreshold?: number): {
    onExecute(): {
        onExecuteDone({ args, result }: any): void;
    };
};
//# sourceMappingURL=index.d.ts.map