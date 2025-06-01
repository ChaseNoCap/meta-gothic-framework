import Fastify from 'fastify';
import mercurius from 'mercurius';
import mercuriusFederation from '@mercurius/federation';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolvers } from './resolvers/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const schema = readFileSync(join(__dirname, '../schema/schema.graphql'), 'utf8');

const PORT = process.env.REPO_AGENT_PORT || 3001;
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
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
  });

  // Health check endpoint
  app.get('/health', async (request, reply) => {
    return { 
      status: 'healthy',
      service: 'repo-agent-service',
      timestamp: new Date().toISOString()
    };
  });

  // Register GraphQL with federation support
  await app.register(mercuriusFederation, {
    schema,
    resolvers,
    graphiql: process.env.NODE_ENV !== 'production',
    federationMetadata: true,
    jit: 1, // Just-in-time compilation for better performance
    queryDepth: 10, // Prevent deeply nested queries
    context: (request) => {
      return {
        // Add any context needed by resolvers
        request,
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
    app.log.info(`🚀 Repo Agent Service ready at http://${HOST}:${PORT}/graphql`);
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