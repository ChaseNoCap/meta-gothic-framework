import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '@chasenocap/logger';
import { nanoid } from 'nanoid';

const __dirname = dirname(fileURLToPath(import.meta.url));
const typeDefs = readFileSync(join(__dirname, '../schema/schema.graphql'), 'utf-8');
import { resolvers } from './resolvers/index.js';
import { createRequestEventBus } from './services/eventBus.js';
import { GitServiceWithEvents } from './services/GitServiceWithEvents.js';
import { useEventTracking } from './plugins/eventTracking.js';

// Initialize logger
const logger = createLogger('repo-agent-service', {}, {
  logDir: join(__dirname, '../../logs/repo-agent-service')
});

const PORT = process.env['REPO_AGENT_PORT'] || 3004;
const WORKSPACE_ROOT = process.env['WORKSPACE_ROOT'] || process.cwd();

// Create schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers: resolvers as any,
});

// Create Yoga server
const yoga = createYoga({
  schema,
  plugins: [
    useEventTracking({
      serviceName: 'repo-agent-service',
      slowQueryThreshold: 200 // 200ms threshold for Git operations
    })
  ],
  context: ({ request }) => {
    // Generate correlation ID for request tracking
    const correlationId = request.headers.get('x-correlation-id') || nanoid();
    const requestLogger = logger.child({
      correlationId,
      method: request.method,
      url: request.url,
    });

    // Create request-scoped event bus
    const eventBus = createRequestEventBus(correlationId);
    
    // Create Git service with events
    const gitService = new GitServiceWithEvents(
      WORKSPACE_ROOT,
      eventBus,
      requestLogger,
      correlationId
    );

    return {
      workspaceRoot: WORKSPACE_ROOT,
      request,
      logger: requestLogger,
      correlationId,
      eventBus,
      gitService,
    };
  },
  maskedErrors: false,
  graphiql: true,
});

// Create HTTP server
const server = createServer(yoga);

// Health check endpoint
server.on('request', (req, res) => {
  if (req.url === '/health') {
    logger.debug('Health check requested');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      healthy: true, 
      service: 'repo-agent-service',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    }));
    return;
  }
});

server.listen(PORT, () => {
  logger.info('Repo Agent Service (Yoga) started', {
    port: PORT,
    graphqlEndpoint: `http://localhost:${PORT}/graphql`,
    healthEndpoint: `http://localhost:${PORT}/health`,
    workspaceRoot: WORKSPACE_ROOT,
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('Server closed successfully');
    process.exit(0);
  });
});