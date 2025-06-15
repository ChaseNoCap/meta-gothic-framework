import type { GraphQLContext } from '../../graphql/context.js';

interface FilesQualityArgs {
  paths: string[];
  sessionId?: string;
}

export async function filesQuality(
  _parent: unknown,
  args: FilesQualityArgs,
  context: GraphQLContext
) {
  const { paths } = args;
  const { dataloaders } = context;

  try {
    // Use dataloader for efficient batching
    const results = await dataloaders.fileQuality.loadMany(paths);
    
    // Filter out errors and nulls
    return results.filter(result => 
      !(result instanceof Error) && result !== null
    );
  } catch (error) {
    console.error('Error getting files quality:', error);
    throw new Error('Failed to get files quality');
  }
}