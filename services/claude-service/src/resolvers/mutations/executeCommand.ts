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
  const { sessionManager, preWarmManager, logger } = context;
  
  logger.info('executeCommand called', { input });
  
  try {
    // Check if we should use a pre-warmed session
    let sessionId = input.sessionId;
    
    if (!sessionId && preWarmManager) {
      // Try to claim a pre-warmed session
      const claimedSessionId = await preWarmManager.claimSession();
      if (claimedSessionId) {
        sessionId = claimedSessionId;
        logger.info('Using pre-warmed session', { sessionId });
      }
    }
    
    const result = await sessionManager.executeCommand(
      input.prompt,
      {
        sessionId: sessionId || undefined,
        workingDirectory: input.workingDirectory || context.workspaceRoot,
        context: input.context,
        commandOptions: input.options
      }
    );
    
    // Wait for the output promise to resolve
    const output = await result.output;
    
    logger.info('executeCommand result', { 
      sessionId: result.sessionId, 
      output,
      outputType: typeof output,
      outputLength: output?.length 
    });
    
    // Parse the JSON response from Claude to extract just the result
    let claudeResponse = output || '';
    try {
      const parsed = JSON.parse(output);
      logger.info('Parsed Claude output', { 
        hasResult: !!parsed.result,
        hasMessage: !!parsed.message,
        resultValue: parsed.result,
        messageValue: parsed.message,
        parsedKeys: Object.keys(parsed)
      });
      
      // Extract the actual result from Claude's JSON response
      if (parsed.result) {
        claudeResponse = parsed.result;
      } else if (parsed.message) {
        claudeResponse = parsed.message;
      }
    } catch (e) {
      // If parsing fails, use the raw output
      logger.warn('Failed to parse Claude output as JSON, using raw output', { 
        error: e,
        rawOutput: output?.substring(0, 200) 
      });
    }
    
    // Return the complete response including the output
    return {
      sessionId: result.sessionId,
      success: true,
      error: null,
      initialResponse: claudeResponse, // Return just the result text, not the full JSON
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