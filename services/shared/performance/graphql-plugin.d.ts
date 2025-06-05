import type { IEventBus } from '@chasenocap/event-system';
import type { ILogger } from '@chasenocap/logger';
export interface PerformancePluginOptions {
    serviceName: string;
    slowThreshold?: number;
    claudeSlowThreshold?: number;
    eventBus?: IEventBus;
    logger?: ILogger;
}
export declare function createPerformancePlugin(options: PerformancePluginOptions): {
    onRequest(): {
        onRequestEnd({ context }: any): void;
    };
    onExecute(): {
        onExecuteParse({ args }: any): void;
        onExecuteDone({ args, result }: any): void;
    };
};
//# sourceMappingURL=graphql-plugin.d.ts.map