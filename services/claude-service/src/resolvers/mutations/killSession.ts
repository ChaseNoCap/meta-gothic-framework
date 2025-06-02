import type { Context } from '../../types/context.js';

/**
 * Kill an active Claude session
 */
export async function killSession(
  _parent: unknown,
  { id }: { id: string },
  context: Context
): Promise<boolean> {
  const { sessionManager } = context;
  
  try {
    const session = sessionManager.getSession(id);
    if (!session) {
      // Session doesn't exist, consider it "killed"
      return true;
    }
    
    // Kill the session process if it exists
    if (session.pid) {
      process.kill(session.pid, 'SIGTERM');
    }
    
    // Update session status
    // Note: This would need to be implemented in ClaudeSessionManager
    // For now, we'll just return success
    return true;
  } catch (error: any) {
    console.error(`Failed to kill session ${id}:`, error);
    return false;
  }
}