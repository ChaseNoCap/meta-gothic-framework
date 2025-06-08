import { resolvers as queryResolvers } from './queries/index.js';
import { resolvers as mutationResolvers } from './mutations/index.js';
import { resolvers as subscriptionResolvers } from './subscriptions/index.js';

// Debug subscription resolvers
console.log('[Main Resolvers] Subscription resolvers:', Object.keys(subscriptionResolvers || {}));
console.log('[Main Resolvers] Subscription resolver types:', Object.entries(subscriptionResolvers || {}).map(([k, v]) => `${k}: ${typeof v}`));

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