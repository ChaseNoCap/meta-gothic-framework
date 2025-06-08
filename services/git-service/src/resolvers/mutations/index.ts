import { executeGitCommand } from './executeGitCommand.js';
import { commitChanges } from './commitChanges.js';
import { batchCommit } from './batchCommit.js';
import { pushChanges } from './pushChanges.js';
import { hierarchicalCommit } from './hierarchicalCommit.js';
import { hierarchicalCommitAndPush } from './hierarchicalCommitAndPush.js';

export const resolvers = {
  executeGitCommand,
  commitChanges,
  batchCommit,
  pushChanges,
  hierarchicalCommit,
  hierarchicalCommitAndPush
};