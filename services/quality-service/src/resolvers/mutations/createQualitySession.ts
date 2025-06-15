import type { GraphQLContext } from '../../graphql/context.js';
import { mapQualitySession } from '../mappers.js';

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
    
    return mapQualitySession(session);
  } catch (error) {
    console.error('Error creating quality session:', error);
    throw new Error('Failed to create quality session');
  }
}