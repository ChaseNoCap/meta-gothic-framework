import type { GraphQLContext } from '../../graphql/context.js';

interface CreateSessionInput {
  type: string;
  metadata?: {
    claudeSessionId?: string;
    gitBranch?: string;
    gitCommit?: string;
    userId?: string;
  };
}

export async function createQualitySession(
  _parent: unknown,
  args: { input: CreateSessionInput },
  context: GraphQLContext
) {
  const { type, metadata } = args.input;
  const { engine } = context;

  try {
    const session = await engine.createSession(type, metadata);
    
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
    console.error('Error creating quality session:', error);
    throw new Error('Failed to create quality session');
  }
}