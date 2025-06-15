import type { GraphQLContext } from '../../graphql/context.js';

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
    return {
      id: session.id,
      type: session.sessionType,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime?.toISOString(),
      filesAnalyzed: session.filesAnalyzed,
      totalViolations: session.totalViolations,
      averageScore: session.averageScore || 0,
      metadata: session.metadata ? {
        claudeSessionId: session.metadata.claudeSessionId,
        gitBranch: session.metadata.gitBranch,
        gitCommit: session.metadata.gitCommit,
        userId: session.metadata.userId
      } : null
    };
  } catch (error) {
    console.error('Error getting quality session:', error);
    throw new Error('Failed to get quality session');
  }
}