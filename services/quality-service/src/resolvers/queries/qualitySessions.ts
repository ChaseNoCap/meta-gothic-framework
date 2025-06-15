import type { GraphQLContext } from '../../graphql/context.js';

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
    return sessions.map(session => ({
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
    }));
  } catch (error) {
    console.error('Error getting quality sessions:', error);
    throw new Error('Failed to get quality sessions');
  }
}