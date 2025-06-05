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
  console.log('[Session Query] Looking for session:', id);
  const { sessionManager } = context;
  const session = sessionManager.getSession(id);
  console.log('[Session Query] Found session:', session ? 'Yes' : 'No');
  if (session) {
    console.log('[Session Query] Session history length:', session.history?.length || 0);
  }
  return session;
}