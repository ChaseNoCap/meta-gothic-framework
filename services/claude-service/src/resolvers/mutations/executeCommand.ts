import type { Context } from '../../types/context.js';
import type { ClaudeExecuteInput, ClaudeExecuteResult } from '../../types/generated.js';

/**
 * Execute a Claude command in a new or existing session
 */
export async function executeCommand(
  _parent: unknown,
  { input }: { input: ClaudeExecuteInput },
  context: Context
): Promise<ClaudeExecuteResult> {
  const { sessionManager, logger } = context;
  
  logger.info('executeCommand called', { input });
  
  try {
    const result = await sessionManager.executeCommand(
      input.prompt,
      {
        sessionId: input.sessionId || undefined,
        workingDirectory: input.workingDirectory || context.workspaceRoot,
        context: input.context,
        commandOptions: input.options
      }
    );
    
    logger.info('executeCommand result', { result });
    
    // Return the complete response including the output
    return {
      sessionId: result.sessionId,
      success: true,
      error: null,
      initialResponse: result.output || '', // Return the actual output from Claude
      metadata: {
        startTime: new Date().toISOString(),
        pid: undefined,
        estimatedTime: estimateExecutionTime(input.prompt),
        flags: input.options?.customFlags || []
      }
    };
  } catch (error: any) {
    logger.error('executeCommand error', { error: error.message });
    
    return {
      sessionId: '',
      success: false,
      error: error.message || 'Failed to execute command',
      initialResponse: null,
      metadata: {
        startTime: new Date().toISOString(),
        pid: undefined,
        estimatedTime: 0,
        flags: []
      }
    };
  }
}

/**
 * Estimate execution time based on prompt complexity
 */
function estimateExecutionTime(prompt: string): number {
  const wordCount = prompt.split(/\s+/).length;
  const baseTime = 2000; // 2 seconds base
  const timePerWord = 10; // 10ms per word
  
  return baseTime + (wordCount * timePerWord);
}