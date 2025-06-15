import type { GraphQLContext } from '../../graphql/context.js';
import { mapQualitySession } from '../mappers.js';

interface QualitySessionArgs {
  sessionId: string;
}

export async function qualitySession(
  _parent: unknown,
  args: QualitySessionArgs,
  context: GraphQLContext
) {
  const { sessionId } = args;
  const { dataloaders } = context;

  try {
    const session = await dataloaders.session.load(sessionId);
    
    if (!session) {
      return null;
    }

    // Map to GraphQL schema format
    return mapQualitySession(session);
  } catch (error) {
    console.error('Error getting quality session:', error);
    throw new Error('Failed to get quality session');
  }
}