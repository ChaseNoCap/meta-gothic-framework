import { getUserConfig } from './queries/getUserConfig';
import { updateUserConfig, resetUserConfig } from './mutations/updateUserConfig';

export const resolvers = {
  Query: {
    getUserConfig,
  },
  Mutation: {
    updateUserConfig,
    resetUserConfig,
  },
};