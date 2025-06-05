import { PerformanceMonitor } from './index.js';
import { loadPerformanceConfig } from './config.js';
export function createPerformancePlugin(options) {
    const config = loadPerformanceConfig();
    return {
        onRequest() {
            return {
                onRequestEnd({ context }) {
                    // Attach performance config to context
                    context.performanceConfig = config;
                }
            };
        },
        onExecute() {
            return {
                onExecuteParse({ args }) {
                    const context = args.contextValue;
                    const monitor = new PerformanceMonitor(options.eventBus || context.eventBus, options.logger || context.logger, options.slowThreshold || config.thresholds.slowOperationMs, config);
                    // Extract operation info
                    const document = args.document;
                    const operationName = document.definitions[0]?.name?.value || 'anonymous';
                    const operationType = document.definitions[0]?.operation || 'unknown';
                    // Calculate GraphQL complexity if enabled
                    if (config.graphql.enabled) {
                        const fieldCount = countFields(document);
                        const complexity = calculateComplexity(document);
                        context.graphqlInfo = {
                            fieldCount,
                            complexity
                        };
                    }
                    // Start performance monitoring
                    const operationId = `graphql-${operationType}-${Date.now()}`;
                    context._performanceOperationId = operationId;
                    monitor.startOperation(operationId, operationName, operationType, {
                        service: options.serviceName,
                        fieldCount: context.graphqlInfo?.fieldCount,
                        complexity: context.graphqlInfo?.complexity
                    }, context.correlationId);
                    // Store monitor for later use
                    context._performanceMonitor = monitor;
                },
                onExecuteDone({ args, result }) {
                    const context = args.contextValue;
                    const monitor = context._performanceMonitor;
                    const operationId = context._performanceOperationId;
                    if (!monitor || !operationId)
                        return;
                    // Calculate result size
                    let resultSize;
                    if (config.dataSize.enabled && config.dataSize.resultSize) {
                        try {
                            resultSize = JSON.stringify(result || {}).length;
                        }
                        catch {
                            resultSize = -1;
                        }
                    }
                    // End operation with metrics
                    monitor.endOperation(operationId, undefined, {
                        resultSize,
                        cacheHit: context.cacheHit,
                        tokenCount: context.tokenUsage ? {
                            input: context.tokenUsage.input || 0,
                            output: context.tokenUsage.output || 0
                        } : undefined
                    });
                }
            };
        }
    };
}
function countFields(document) {
    let count = 0;
    const visit = (node) => {
        if (node.kind === 'Field') {
            count++;
        }
        if (node.selectionSet) {
            node.selectionSet.selections.forEach(visit);
        }
    };
    document.definitions.forEach((def) => {
        if (def.selectionSet) {
            def.selectionSet.selections.forEach(visit);
        }
    });
    return count;
}
function calculateComplexity(document) {
    let complexity = 0;
    let depth = 0;
    let maxDepth = 0;
    const visit = (node) => {
        if (node.kind === 'Field') {
            complexity += 1 + (depth * 0.5); // Deeper fields add more complexity
        }
        if (node.selectionSet) {
            depth++;
            maxDepth = Math.max(maxDepth, depth);
            node.selectionSet.selections.forEach(visit);
            depth--;
        }
    };
    document.definitions.forEach((def) => {
        if (def.selectionSet) {
            def.selectionSet.selections.forEach(visit);
        }
    });
    // Factor in depth
    complexity += maxDepth * 2;
    return Math.round(complexity);
}
//# sourceMappingURL=graphql-plugin.js.map