import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import { createYoga } from 'graphql-yoga';
import { useResponseCache } from '@graphql-yoga/plugin-response-cache';
import { createPubSub } from '@graphql-yoga/subscription';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import gql from 'graphql-tag';
import { resolvers } from './resolvers/index.js';
import { ClaudeSessionManager } from './services/ClaudeSessionManager.js';

const PORT = process.env.CLAUDE_SERVICE_PORT || 3002;
const HOST = process.env.CLAUDE_SERVICE_HOST || '0.0.0.0';

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load and merge schema files
const mainSchema = readFileSync(join(__dirname, '../schema/schema.graphql'), 'utf-8');
const runsSchema = readFileSync(join(__dirname, '../schema/runs.graphql'), 'utf-8');

// Add federation directives
const federationSchema = `
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.10", import: ["@key", "@shareable", "@external"])
`;

// Combine all schemas
const typeDefs = gql`
  ${federationSchema}
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
      service: 'claude-service-yoga-federation',
      timestamp: new Date().toISOString()
    };
  });

  try {
    // Build the federated schema
    const schema = buildSubgraphSchema([{ 
      typeDefs,
      resolvers
    }]);

    // Create GraphQL Yoga instance with federation schema
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
      },
      plugins: [
        // Response caching
        useResponseCache({
          // Session-based caching
          session: (request) => {
            const sessionId = request.headers.get('x-session-id');
            return sessionId || null;
          },
          ttl: 60_000, // 1 minute for queries
          invalidateViaMutation: true,
          // Don't cache subscriptions
          shouldCacheResult: ({ result }) => {
            if (result.errors) return false;
            return true;
          }
        })
      ]
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

    await app.listen({ port: PORT as number, host: HOST });
    app.log.info(`🤖 Claude Service (Yoga Federation) ready at http://${HOST}:${PORT}/graphql`);
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