import Fastify from 'fastify';
import mercurius from 'mercurius';
import mercuriusFederation from '@mercurius/federation';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolvers } from './resolvers/index.js';
import { ClaudeSessionManager } from './services/ClaudeSessionManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const schema = readFileSync(join(__dirname, '../schema/schema.graphql'), 'utf8');

const PORT = process.env.CLAUDE_SERVICE_PORT || 3002;
const HOST = process.env.CLAUDE_SERVICE_HOST || '0.0.0.0';

// Initialize session manager
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
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
  });

  // Health check endpoint
  app.get('/health', async (request, reply) => {
    const claudeAvailable = await sessionManager.checkClaudeAvailability();
    return { 
      status: 'healthy',
      service: 'claude-service',
      claudeAvailable,
      activeSessions: sessionManager.getActiveSessions().length,
      timestamp: new Date().toISOString()
    };
  });

  // Register GraphQL with federation support
  await app.register(mercuriusFederation, {
    schema,
    resolvers,
    graphiql: process.env.NODE_ENV !== 'production',
    federationMetadata: true,
    jit: 1,
    queryDepth: 10,
    subscription: {
      context: (connection, request) => {
        return {
          sessionManager,
          pubsub: app.graphql.pubsub
        };
      },
      onConnect: async (data) => {
        app.log.info('WebSocket client connected');
        return true;
      },
      onDisconnect: async (context) => {
        app.log.info('WebSocket client disconnected');
      }
    },
    context: (request) => {
      return {
        request,
        sessionManager,
        pubsub: app.graphql.pubsub,
        workspaceRoot: process.env.WORKSPACE_ROOT || process.cwd()
      };
    },
    errorHandler: (error, request, reply) => {
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
    app.log.info(`🤖 Claude Service ready at http://${HOST}:${PORT}/graphql`);
  } catch (err) {
    app.log.error(err);
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