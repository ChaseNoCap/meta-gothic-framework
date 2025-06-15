import type { GraphQLContext } from '../../graphql/context.js';

export async function health(
  _parent: unknown,
  _args: unknown,
  _context: GraphQLContext
) {
  return {
    service: 'quality-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: '1.0.0'
  };
}