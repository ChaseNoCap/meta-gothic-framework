import { healthResolver } from './health.js';
import { gitStatus } from './gitStatus.js';
import { scanAllRepositories } from './scanAllRepositories.js';
import { scanAllDetailed } from './scanAllDetailed.js';
import { submodules } from './submodules.js';
import { repositoryDetails } from './repositoryDetails.js';
import { isRepositoryClean } from './isRepositoryClean.js';
import { latestCommit } from './latestCommit.js';

export const resolvers = {
  health: healthResolver,
  gitStatus,
  scanAllRepositories,
  scanAllDetailed,
  submodules,
  repositoryDetails,
  isRepositoryClean,
  latestCommit
};