import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import { createYoga, createPubSub } from 'graphql-yoga';
import { useWebSocketAdapter } from '@graphql-yoga/plugin-graphql-sse';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { resolvers } from './resolvers/index.js';
import { ClaudeSessionManager } from './services/ClaudeSessionManager.js';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws.js';

const PORT = process.env.CLAUDE_SERVICE_PORT || 3002;
const HOST = process.env.CLAUDE_SERVICE_HOST || '0.0.0.0';

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load and merge schema files
const mainSchema = readFileSync(join(__dirname, '../schema/schema.graphql'), 'utf-8');
const runsSchema = readFileSync(join(__dirname, '../schema/runs.graphql'), 'utf-8');

// Combine schemas
const typeDefs = `
  ${mainSchema}
  ${runsSchema}
`;

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
      service: 'claude-service-yoga-ws',
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
      graphiql: {
        // Enable subscriptions in GraphiQL
        subscriptionsProtocol: 'WS'
      },
      context: async ({ req }) => {
        return {
          request: req,
          sessionManager,
          pubSub
        };
      }
    });

    // Register GraphQL routes
    app.route({
      url: yoga.graphqlEndpoint,
      method: ['GET', 'POST', 'OPTIONS'],
      handler: async (req, reply) => {
        const response = await yoga.handleNodeRequestAndResponse(req, reply, {
          req,
          reply
        });
        return response;
      }
    });

    // Start the HTTP server
    const server = await app.listen({ port: PORT as number, host: HOST });
    
    // Create WebSocket server for subscriptions
    const wsServer = new WebSocketServer({
      server: server.server,
      path: yoga.graphqlEndpoint,
    });

    // Set up GraphQL WebSocket server
    useServer(
      {
        execute: (args: any) => args.rootValue.execute(args),
        subscribe: (args: any) => args.rootValue.subscribe(args),
        context: (ctx) => {
          return {
            sessionManager,
            pubSub
          };
        },
        onConnect: async (ctx) => {
          app.log.info('WebSocket client connected');
        },
        onDisconnect: async (ctx) => {
          app.log.info('WebSocket client disconnected');
        },
      },
      wsServer,
    );

    app.log.info(`🤖 Claude Service (Yoga WebSocket) ready at http://${HOST}:${PORT}/graphql`);
    app.log.info(`   WebSocket subscriptions available at ws://${HOST}:${PORT}/graphql`);
  } catch (err) {
    app.log.error('Failed to start server:', err);
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
  process.exit(1);
});