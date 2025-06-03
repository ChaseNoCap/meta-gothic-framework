import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import { createYoga } from 'graphql-yoga';
import { useResponseCache } from '@graphql-yoga/plugin-response-cache';
import { useDataLoader } from '@envelop/dataloader';
import { useGraphQlJit } from '@envelop/graphql-jit';
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
console.log('Building schema with typeDefs:', typeDefs);
console.log('Building schema with resolvers:', Object.keys(federatedResolvers));

const schema = buildSubgraphSchema([{ 
  typeDefs,
  resolvers: federatedResolvers 
}]);

console.log('Schema built successfully:', !!schema);

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

  // Create GraphQL Yoga instance with performance plugins
  const yoga = createYoga<{
    req: FastifyRequest;
    reply: FastifyReply;
  }>({
    schema,
    logging: {
      debug: (...args) => args.forEach(arg => app.log.debug(arg)),
      info: (...args) => args.forEach(arg => app.log.info(arg)),
      warn: (...args) => args.forEach(arg => app.log.warn(arg)),
      error: (...args) => args.forEach(arg => app.log.error(arg))
    },
    maskedErrors: process.env.NODE_ENV === 'production',
    graphiql: process.env.NODE_ENV !== 'production',
    context: async ({ req }) => {
      return {
        request: req,
        workspaceRoot: process.env.WORKSPACE_ROOT || process.cwd()
      };
    },
    plugins: [
      // JIT compilation for performance
      // useGraphQlJit(), // Temporarily disabled to test
      
      // Response caching
      useResponseCache({
        // No session-based caching for this service
        session: () => null,
        ttl: 300_000, // 5 minutes
        invalidateViaMutation: true,
        // Cache only specific queries
        if: ({ request }) => {
          const query = request.body?.query || '';
          return query.includes('repositoryDetails') || 
                 query.includes('gitStatus') ||
                 query.includes('scanAllRepositories');
        }
      }),
      
      // DataLoader for N+1 prevention
      useDataLoader()
    ]
  });

  // Register GraphQL routes
  app.route({
    url: yoga.graphqlEndpoint,
    method: ['GET', 'POST', 'OPTIONS'],
    handler: (req, reply) => {
      return yoga.handleNodeRequestAndResponse(req, reply, {
        req,
        reply
      });
    }
  });

  // Add content type parser for file uploads (if needed)
  app.addContentTypeParser('multipart/form-data', {}, (req, payload, done) => done(null));

  try {
    await app.listen({ port: PORT as number, host: HOST });
    app.log.info(`🔧 Repo Agent Service (Yoga) ready at http://${HOST}:${PORT}/graphql`);
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