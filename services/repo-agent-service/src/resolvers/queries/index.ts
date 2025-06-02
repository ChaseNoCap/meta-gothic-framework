import { gitStatus } from './gitStatus.js';
import { scanAllRepositories } from './scanAllRepositories.js';
import { scanAllDetailed } from './scanAllDetailed.js';
import { submodules } from './submodules.js';
import { repositoryDetails } from './repositoryDetails.js';

export const resolvers = {
  gitStatus,
  scanAllRepositories,
  scanAllDetailed,
  submodules,
  repositoryDetails
};