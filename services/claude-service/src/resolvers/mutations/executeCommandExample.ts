import type { Context } from '../../types/context.js';
import { PerformanceMonitor } from '../../../../shared/performance/index.js';

/**
 * Example of monitoring a long-running Claude operation
 * This shows how to manually track Claude operations with appropriate thresholds
 */
export async function executeClaudeCommand(
  _parent: unknown,
  { input }: { sessionId: string; command: string },
  context: Context
): Promise<any> {
  const { sessionManager, eventBus, logger } = context;
  
  // Create monitor with Claude-specific configuration
  const monitor = new PerformanceMonitor(
    eventBus,
    logger,
    60000, // 1 minute slow threshold for Claude operations
    context.performanceConfig
  );
  
  const operationId = `claude-execute-${Date.now()}`;
  
  // Start monitoring with detailed metadata
  monitor.startOperation(
    operationId,
    'executeClaudeCommand',
    'api-call',
    {
      sessionId: input.sessionId,
      commandLength: input.command.length,
      commandPreview: input.command.substring(0, 50) + '...'
    },
    context.correlationId
  );
  
  try {
    // This could take 15+ minutes
    logger.info('Starting Claude command execution', {
      sessionId: input.sessionId,
      correlationId: context.correlationId
    });
    
    const result = await sessionManager.executeCommand(
      input.sessionId,
      input.command
    );
    
    // End operation with token usage metrics
    monitor.endOperation(operationId, undefined, {
      tokenCount: {
        input: result.tokenUsage?.inputTokens || 0,
        output: result.tokenUsage?.outputTokens || 0
      },
      resultSize: result.output?.length || 0,
      cacheHit: false // Claude responses are never cached
    });
    
    logger.info('Claude command completed successfully', {
      sessionId: input.sessionId,
      duration: Date.now() - monitor.getActiveOperations()
        .find(op => op.operationName === 'executeClaudeCommand')?.startTime || 0,
      tokenUsage: result.tokenUsage
    });
    
    return result;
    
  } catch (error) {
    // Log the error and end operation
    logger.error('Claude command failed', error as Error, {
      sessionId: input.sessionId,
      correlationId: context.correlationId
    });
    
    monitor.endOperation(operationId, error as Error);
    throw error;
  }
}

/**
 * Example of tracking sub-operations within a larger operation
 */
export async function batchClaudeOperations(
  _parent: unknown,
  { input }: { operations: Array<{ sessionId: string; command: string }> },
  context: Context
): Promise<any[]> {
  const { eventBus, logger } = context;
  const monitor = new PerformanceMonitor(eventBus, logger, 60000);
  
  // Track the overall batch operation
  const batchId = `claude-batch-${Date.now()}`;
  monitor.startOperation(batchId, 'batchClaudeOperations', 'mutation');
  
  const results = [];
  
  for (let i = 0; i < input.operations.length; i++) {
    const op = input.operations[i];
    
    // Track each individual operation
    const opId = `claude-op-${i}-${Date.now()}`;
    monitor.startOperation(
      opId,
      `claudeOperation${i}`,
      'api-call',
      {
        index: i,
        sessionId: op.sessionId,
        batchId
      }
    );
    
    try {
      // Execute the operation
      const result = await executeClaudeCommand(_parent, { input: op }, context);
      
      monitor.endOperation(opId, undefined, {
        tokenCount: result.tokenUsage
      });
      
      results.push(result);
    } catch (error) {
      monitor.endOperation(opId, error as Error);
      results.push({ error: (error as Error).message });
    }
  }
  
  // Calculate total token usage
  const totalTokens = results.reduce((acc, r) => ({
    input: acc.input + (r.tokenUsage?.inputTokens || 0),
    output: acc.output + (r.tokenUsage?.outputTokens || 0)
  }), { input: 0, output: 0 });
  
  monitor.endOperation(batchId, undefined, {
    tokenCount: totalTokens,
    contextSize: JSON.stringify(input).length
  });
  
  return results;
}