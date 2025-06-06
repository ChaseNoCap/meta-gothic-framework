import { resolvers as queries } from './queries/index.js';
import { resolvers as mutations } from './mutations/index.js';

export const resolvers = {
  Query: queries,
  Mutation: mutations
};