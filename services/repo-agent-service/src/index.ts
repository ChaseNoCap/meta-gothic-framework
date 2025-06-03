import Fastify from 'fastify';
import mercurius from 'mercurius';
import { typeDefs } from './federation-schema.js';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { resolvers } from './resolvers/index.js';

// Add entity resolver to resolvers
const federatedResolvers = {
  ...resolvers,
  Repository: {
    __resolveReference: async (reference: { path: string }, context: any) => {
      // This would fetch the repository by path
      // For now, return a basic implementation
      const repoName = reference.path.split('/').pop() || 'unknown';
      return {
        path: reference.path,
        name: repoName,
        isDirty: false,
        branch: 'main',
        status: {
          branch: 'main',
          isDirty: false,
          files: [],
          ahead: 0,
          behind: 0,
          hasRemote: true,
          stashes: []
        }
      };
    }
  }
};

// Build the federated schema
const schema = buildSubgraphSchema({ 
  typeDefs,
  resolvers: federatedResolvers 
});

const PORT = process.env.REPO_AGENT_PORT || 3004;
const HOST = process.env.REPO_AGENT_HOST || '0.0.0.0';

async function start() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      }
    }
  });

  // CORS support for development
  await app.register(import('@fastify/cors'), {
    origin: process.env.CORS_ORIGIN || true,
    credentials: true
  });

  // Health check endpoint
  app.get('/health', async (_request, _reply) => {
    return { 
      status: 'healthy',
      service: 'repo-agent-service',
      timestamp: new Date().toISOString()
    };
  });

  // Register GraphQL with federation support
  await app.register(mercurius as any, {
    schema,
    graphiql: process.env.NODE_ENV !== 'production',
    federationMetadata: true,
    jit: 1,
    queryDepth: 10,
    context: (request: any) => {
      return {
        request,
        workspaceRoot: process.env.WORKSPACE_ROOT || process.cwd()
      };
    },
    errorHandler: (error: any, request: any, _reply: any) => {
      app.log.error({ error, query: request.body }, 'GraphQL error');
      return {
        statusCode: error.statusCode || 500,
        response: {
          errors: [
            {
              message: error.message,
              extensions: {
                code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
                timestamp: new Date().toISOString()
              }
            }
          ]
        }
      };
    }
  });

  try {
    await app.listen({ port: PORT as number, host: HOST });
    app.log.info(`🔧 Repo Agent Service ready at http://${HOST}:${PORT}/graphql`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

// Start the server
start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});