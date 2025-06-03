import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import { createYoga } from 'graphql-yoga';
import { createPubSub } from '@graphql-yoga/subscription';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { readFileSync } from 'fs';
import { resolvers } from './resolvers/index.js';
import { ClaudeSessionManager } from './services/ClaudeSessionManager.js';

const PORT = process.env.CLAUDE_SERVICE_PORT || 3002;
const HOST = process.env.CLAUDE_SERVICE_HOST || '0.0.0.0';

// Load schema
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const mainSchema = readFileSync(join(__dirname, '../schema/schema.graphql'), 'utf-8');
const runsSchema = readFileSync(join(__dirname, '../schema/runs.graphql'), 'utf-8');
const typeDefs = [mainSchema, runsSchema].join('\n');

// Create pub/sub instance for subscriptions
const pubSub = createPubSub();

// Create singleton session manager
const sessionManager = new ClaudeSessionManager();

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
    },
    bodyLimit: 10485760 // 10MB to handle large diffs
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
      service: 'claude-service-yoga-simple',
      timestamp: new Date().toISOString()
    };
  });

  try {
    // Create executable schema
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
          sessionManager,
          pubSub
        };
      }
    });

    // Register GraphQL routes (no WebSocket support in simple version)
    app.route({
      url: yoga.graphqlEndpoint,
      method: ['GET', 'POST', 'OPTIONS'],
      handler: async (req, reply) => {
        const response = await yoga.handleNodeRequestAndResponse(req, reply, {
          req,
          reply
        });
        return response;
      },
      wsHandler: (connection, req) => {
        // Handle WebSocket connections for subscriptions
        connection.socket.on('message', (message) => {
          // Yoga handles the WebSocket protocol internally
        });
      }
    });

    await app.listen({ port: PORT as number, host: HOST });
    app.log.info(`🤖 Claude Service (Yoga Simple) ready at http://${HOST}:${PORT}/graphql`);
  } catch (err) {
    app.log.error('Failed to start server:', err);
    console.error('Detailed error:', err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await sessionManager.cleanup();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  await sessionManager.cleanup();
  process.exit(0);
});

// Start the server
start().catch((err) => {
  console.error('Failed to start server:', err);
  console.error('Stack trace:', err.stack);
  process.exit(1);
});