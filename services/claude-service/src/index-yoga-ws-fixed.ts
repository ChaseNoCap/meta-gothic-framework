import Fastify from 'fastify';
import { createYoga, createPubSub } from 'graphql-yoga';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { resolvers } from './resolvers/index.js';
import { ClaudeSessionManager } from './services/ClaudeSessionManager.js';
import { WebSocketServer } from 'ws';
import { makeServer } from 'graphql-ws';

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

// Create executable schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers
});

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
    origin: true,
    credentials: true
  });

  // Create Yoga instance
  const yoga = createYoga({
    schema,
    context: async ({ request }) => ({
      sessionManager,
      pubSub,
      request
    }),
    graphiql: {
      title: 'Claude Service GraphQL (WebSocket Enabled)',
      defaultQuery: `# Try executing a command
mutation ExecuteCommand {
  executeCommand(input: {
    prompt: "echo Hello from GraphQL"
    workingDirectory: "/tmp"
  }) {
    sessionId
    success
    error
  }
}

# Then subscribe to output
# subscription CommandOutput($sessionId: ID!) {
#   commandOutput(sessionId: $sessionId) {
#     type
#     data
#     timestamp
#   }
# }`
    },
    maskedErrors: false,
    logging: app.log
  });

  // Regular HTTP endpoint
  app.route({
    url: '/graphql',
    method: ['GET', 'POST', 'OPTIONS'],
    handler: async (req, reply) => {
      const response = await yoga.handleNodeRequestAndResponse(req, reply);
      for (const [key, value] of response.headers) {
        reply.header(key, value);
      }
      reply.status(response.status);
      reply.send(response.body);
      return reply;
    }
  });

  // Health check endpoint
  app.get('/health', async () => {
    return { 
      status: 'healthy',
      service: 'claude-service',
      version: process.env.npm_package_version || '1.0.0',
      sessions: sessionManager.getActiveSessions().length
    };
  });

  // Start HTTP server
  await app.listen({ port: PORT as number, host: HOST });
  
  // Create WebSocket server for subscriptions
  const wsServer = new WebSocketServer({
    server: app.server,
    path: '/graphql'
  });

  // Set up GraphQL WebSocket server
  makeServer({
    schema,
    context: async () => ({
      sessionManager,
      pubSub
    }),
    onConnect: async () => {
      console.log('WebSocket client connected');
    },
    onDisconnect: async () => {
      console.log('WebSocket client disconnected');
    }
  }, wsServer);

  app.log.info(`🤖 Claude Service (Yoga + WebSocket) ready at http://${HOST}:${PORT}/graphql`);
  app.log.info(`🔌 WebSocket subscriptions available at ws://${HOST}:${PORT}/graphql`);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    app.log.info('SIGTERM received, shutting down gracefully...');
    wsServer.close();
    await app.close();
    process.exit(0);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});