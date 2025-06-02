import Fastify from 'fastify';
import mercurius from 'mercurius';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolvers } from './resolvers/index.js';
import { ClaudeSessionManager } from './services/ClaudeSessionManager.js';
import { RunStorage } from './services/RunStorage.js';
import { createDataLoaders } from './dataloaders/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load and merge schemas
const mainSchema = readFileSync(join(__dirname, '../schema/schema.graphql'), 'utf8');
const runsSchema = readFileSync(join(__dirname, '../schema/runs.graphql'), 'utf8');
const schema = mainSchema + '\n\n' + runsSchema;

const PORT = process.env.CLAUDE_SERVICE_PORT || 3002;
const HOST = process.env.CLAUDE_SERVICE_HOST || '0.0.0.0';

// Initialize services
const sessionManager = new ClaudeSessionManager();
const runStorage = new RunStorage();

// Import progress tracker for event binding
import { progressTracker } from './services/ProgressTracker.js';
import { emitAgentRunProgress, emitBatchProgress } from './resolvers/subscriptions/agentRunProgress.js';

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
  app.get('/health', async (_request, _reply) => {
    const claudeAvailable = await sessionManager.checkClaudeAvailability();
    return { 
      status: 'healthy',
      service: 'claude-service',
      claudeAvailable,
      activeSessions: sessionManager.getActiveSessions().length,
      timestamp: new Date().toISOString()
    };
  });

  // Register GraphQL
  await app.register(mercurius as any, {
    schema,
    resolvers,
    graphiql: process.env.NODE_ENV !== 'production',
    federationMetadata: true,
    jit: 1,
    queryDepth: 10,
    subscription: {
      context: (_connection: any, _request: any) => {
        const loaders = createDataLoaders(runStorage, sessionManager);
        return {
          sessionManager,
          runStorage,
          loaders,
          pubsub: app.graphql.pubsub
        };
      },
      onConnect: async (_data: any) => {
        app.log.info('WebSocket client connected');
        return true;
      },
      onDisconnect: async (_context: any) => {
        app.log.info('WebSocket client disconnected');
      },
      // Enable WebSocket compression
      perMessageDeflate: true,
      // Implement heartbeat
      keepAlive: 10000,
      // Max payload size (1MB)
      maxPayload: 1024 * 1024
    },
    context: (request: any) => {
      // Create fresh DataLoaders for each request to avoid stale cache
      const loaders = createDataLoaders(runStorage, sessionManager);
      return {
        request,
        sessionManager,
        runStorage,
        loaders,
        pubsub: app.graphql.pubsub,
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

  // Connect progress tracker to GraphQL pubsub
  const pubsub = app.graphql.pubsub;
  if (pubsub) {
    // Forward progress events to GraphQL subscriptions
    progressTracker.on('agentRunProgress', (progress) => {
      emitAgentRunProgress(pubsub, progress);
    });
    
    progressTracker.on('batchProgress', (progress) => {
      emitBatchProgress(pubsub, progress);
    });
    
    // Periodic cleanup of old batches
    setInterval(() => {
      progressTracker.cleanupCompletedBatches();
    }, 60 * 60 * 1000); // Every hour
  }

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