import type { GraphQLContext } from '@meta-gothic/shared-types';
import type { GitServiceWithEvents } from '../services/GitServiceWithEvents';

export interface Context extends GraphQLContext {
  workspaceRoot: string;
  gitService: GitServiceWithEvents;
}