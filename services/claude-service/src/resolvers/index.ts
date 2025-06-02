import { resolvers as queryResolvers } from './queries/index.js';
import { resolvers as mutationResolvers } from './mutations/index.js';
import { resolvers as subscriptionResolvers } from './subscriptions/index.js';

export const resolvers: any = {
  Query: {
    ...queryResolvers
  },
  Mutation: {
    ...mutationResolvers
  },
  Subscription: {
    ...subscriptionResolvers
  }
};