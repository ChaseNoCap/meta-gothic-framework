import { gitStatusResolver } from './queries/gitStatus.js';
import { scanAllRepositoriesResolver } from './queries/scanAllRepositories.js';
import { scanAllDetailedResolver } from './queries/scanAllDetailed.js';
import { submodulesResolver } from './queries/submodules.js';
import { repositoryDetailsResolver } from './queries/repositoryDetails.js';
import { executeGitCommandResolver } from './mutations/executeGitCommand.js';
import { commitChangesResolver } from './mutations/commitChanges.js';
import { batchCommitResolver } from './mutations/batchCommit.js';
import { pushChangesResolver } from './mutations/pushChanges.js';

export const resolvers = {
  Query: {
    gitStatus: gitStatusResolver,
    scanAllRepositories: scanAllRepositoriesResolver,
    scanAllDetailed: scanAllDetailedResolver,
    submodules: submodulesResolver,
    repositoryDetails: repositoryDetailsResolver
  },
  Mutation: {
    executeGitCommand: executeGitCommandResolver,
    commitChanges: commitChangesResolver,
    batchCommit: batchCommitResolver,
    pushChanges: pushChangesResolver
  }
};