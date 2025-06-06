import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { readFileSync } from 'fs';
import { getFileSystem } from '@meta-gothic/shared-types/file-system';
import { fileURLToPath } from 'url';
import { createHandler } from 'graphql-sse/lib/use/http';
import { createLogger } from '@chasenocap/logger';
import { nanoid } from 'nanoid';

const fileSystem = getFileSystem();
const __dirname = fileSystem.dirname(fileURLToPath(import.meta.url));
const typeDefs = readFileSync(fileSystem.join(__dirname, '../schema/schema.graphql'), 'utf-8');
import { resolvers } from './resolvers/index.js';
import { createRequestEventBus } from './services/eventBus.js';
import { GitServiceWithEvents } from './services/GitServiceWithEvents.js';
import { useEventTracking } from './plugins/eventTracking.js';

// Initialize logger
const logger = createLogger('git-service', {}, {
  logDir: fileSystem.join(__dirname, '../../logs/git-service')
});

const PORT = process.env['GIT_SERVICE_PORT'] || 3004;
const WORKSPACE_ROOT = process.env['WORKSPACE_ROOT'] || process.cwd();

// Create schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers
});

// Create Yoga server with SSE support
const yoga = createYoga({
  schema,
  plugins: [
    useEventTracking({
      serviceName: 'git-service',
      slowQueryThreshold: 200 // 200ms threshold for Git operations
    })
  ],
  context: ({ request }) => {
    // Generate correlation ID for request tracking
    const correlationId = request.headers.get('x-correlation-id') || nanoid();
    const requestLogger = logger.child({
      correlationId,
      service: 'git-service'
    });
    
    // Create service instances for this request
    const gitService = new GitServiceWithEvents(WORKSPACE_ROOT);
    const eventBus = createRequestEventBus(correlationId);
    
    requestLogger.debug('Request context created', {
      workspaceRoot: WORKSPACE_ROOT,
      headers: Object.fromEntries(request.headers.entries())
    });
    
    return {
      gitService,
      logger: requestLogger,
      correlationId,
      eventBus,
      performanceData: []
    };
  },
  graphiql: {
    defaultQuery: `# Welcome to Git Service GraphQL
{
  repoAgentHealth {
    status
    timestamp
    service
  }
}`
  },
  maskedErrors: false,
  logging: {
    debug: (...args) => logger.debug(args),
    info: (...args) => logger.info(args),
    warn: (...args) => logger.warn(args),
    error: (...args) => logger.error(args),
  },
});

// Create server with SSE endpoint
const server = createServer(async (req, res) => {
  // Handle SSE endpoint for subscriptions
  if (req.url === '/graphql/stream' && req.method === 'POST') {
    const sseHandler = createHandler({
      schema,
      context: async () => {
        const correlationId = req.headers['x-correlation-id'] || nanoid();
        const requestLogger = logger.child({
          correlationId,
          service: 'git-service-sse'
        });
        
        const gitService = new GitServiceWithEvents(WORKSPACE_ROOT);
        const eventBus = createRequestEventBus(correlationId);
        
        return {
          gitService,
          logger: requestLogger,
          correlationId,
          eventBus,
          performanceData: []
        };
      },
    });
    
    return sseHandler(req, res);
  }
  
  // Handle regular GraphQL endpoint
  if (req.url?.startsWith('/graphql')) {
    return yoga(req, res);
  }
  
  // Health check
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'git-service' }));
    return;
  }
  
  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  logger.info(`Git Service with SSE support started`, {
    port: PORT,
    workspaceRoot: WORKSPACE_ROOT,
    endpoints: {
      graphql: `http://localhost:${PORT}/graphql`,
      sse: `http://localhost:${PORT}/graphql/stream`,
      health: `http://localhost:${PORT}/health`
    }
  });
  
  console.log(`🚀 Git Service with SSE support is running on http://localhost:${PORT}/graphql`);
  console.log(`🌊 SSE endpoint available at http://localhost:${PORT}/graphql/stream`);
  console.log(`🏥 Health check endpoint available at http://localhost:${PORT}/health`);
  console.log(`📁 Workspace root: ${WORKSPACE_ROOT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});