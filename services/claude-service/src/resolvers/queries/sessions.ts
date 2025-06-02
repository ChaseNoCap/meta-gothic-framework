import type { Context } from '../../types/context.js';
import type { ClaudeSession } from '../../types/generated.js';

/**
 * List all active Claude sessions
 */
export async function sessions(
  _parent: unknown,
  _args: {},
  context: Context
): Promise<ClaudeSession[]> {
  const { sessionManager } = context;
  return sessionManager.getActiveSessions();
}