import { executeGitCommand } from './executeGitCommand.js';
import { commitChanges } from './commitChanges.js';
import { batchCommit } from './batchCommit.js';
import { pushChanges } from './pushChanges.js';

export const resolvers = {
  executeGitCommand,
  commitChanges,
  batchCommit,
  pushChanges
};