import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import { createYoga } from 'graphql-yoga';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from './federation-schema.js';
import { resolvers } from './resolvers/index.js';

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
      service: 'repo-agent-service-yoga',
      timestamp: new Date().toISOString()
    };
  });

  // Build schema without federation for now
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers
  });

  // Create GraphQL Yoga instance
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
    }
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
    app.log.info(`🔧 Repo Agent Service (Yoga Simple) ready at http://${HOST}:${PORT}/graphql`);
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