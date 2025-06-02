import type { Context } from '../../types/context.js';
import type { ClaudeSession } from '../../types/generated.js';

/**
 * Get details of a specific session
 */
export async function session(
  _parent: unknown,
  { id }: { id: string },
  context: Context
): Promise<ClaudeSession | null> {
  const { sessionManager } = context;
  return sessionManager.getSession(id);
}