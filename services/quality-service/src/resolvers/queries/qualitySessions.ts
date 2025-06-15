import type { GraphQLContext } from '../../graphql/context.js';
import { mapQualitySession } from '../mappers.js';

interface QualitySessionsArgs {
  limit?: number;
}

export async function qualitySessions(
  _parent: unknown,
  args: QualitySessionsArgs,
  context: GraphQLContext
) {
  const { limit = 10 } = args;
  const { engine } = context;

  try {
    // Get recent sessions from the engine
    const sessions = await engine.getRecentSessions(limit);
    
    // Map to GraphQL schema format
    return sessions.map(mapQualitySession);
  } catch (error) {
    console.error('Error getting quality sessions:', error);
    throw new Error('Failed to get quality sessions');
  }
}