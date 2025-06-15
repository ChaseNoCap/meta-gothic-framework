// Subscription resolvers will be implemented with SSE support
// For now, export empty resolvers to satisfy the schema

export const subscriptions = {
  qualityUpdates: {
    subscribe: () => {
      throw new Error('Subscriptions not yet implemented');
    }
  },
  
  violationEvents: {
    subscribe: () => {
      throw new Error('Subscriptions not yet implemented');
    }
  },
  
  fileQualityChanges: {
    subscribe: () => {
      throw new Error('Subscriptions not yet implemented');
    }
  }
};