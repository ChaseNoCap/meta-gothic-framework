import type { GitServiceWithEvents } from '../../services/GitServiceWithEvents.js';

/**
 * Resolver for extending ClaudeSession type from Claude service
 */
export class ClaudeSessionRepositoryResolver {
  constructor(private gitService: GitServiceWithEvents) {}

  // We don't need to resolve ClaudeSession entities since we marked it as non-resolvable
  // This is just a placeholder for potential future extensions
}