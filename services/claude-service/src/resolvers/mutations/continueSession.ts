import type { Context } from '../../types/context.js';
import type { ContinueSessionInput, ClaudeExecuteResult } from '../../types/generated.js';

/**
 * Continue an existing Claude session with a new prompt
 */
export async function continueSession(
  _parent: unknown,
  { input }: { input: ContinueSessionInput },
  context: Context
): Promise<ClaudeExecuteResult> {
  const { sessionManager } = context;
  
  // Verify session exists
  const session = sessionManager.getSession(input.sessionId);
  if (!session) {
    return {
      sessionId: input.sessionId,
      success: false,
      error: 'Session not found or has been terminated',
      initialResponse: null,
      metadata: {
        startTime: new Date().toISOString(),
        pid: undefined,
        estimatedTime: 0,
        flags: []
      }
    };
  }
  
  try {
    const { sessionId } = await sessionManager.executeCommand(
      input.prompt,
      {
        sessionId: input.sessionId,
        workingDirectory: session.workingDirectory,
        context: input.additionalContext,
        commandOptions: session.metadata.flags
      }
    );
    
    return {
      sessionId,
      success: true,
      error: null,
      initialResponse: null,
      metadata: {
        startTime: new Date().toISOString(),
        pid: session.pid || undefined,
        estimatedTime: estimateExecutionTime(input.prompt),
        flags: session.metadata.flags
      }
    };
  } catch (error: any) {
    return {
      sessionId: input.sessionId,
      success: false,
      error: error.message || 'Failed to continue session',
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

function estimateExecutionTime(prompt: string): number {
  const wordCount = prompt.split(/\s+/).length;
  const baseTime = 1500; // Slightly less for continued sessions
  const timePerWord = 8;
  
  return baseTime + (wordCount * timePerWord);
}