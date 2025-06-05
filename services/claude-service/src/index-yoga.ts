import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { readFileSync } from 'fs';
import { getFileSystem } from '../../shared/file-system/index.js';
import { fileURLToPath } from 'url';
import { createLogger } from '@chasenocap/logger';
import { nanoid } from 'nanoid';

const fileSystem = getFileSystem();
const __dirname = fileSystem.dirname(fileURLToPath(import.meta.url));
const typeDefs = readFileSync(fileSystem.join(__dirname, '../schema/schema.graphql'), 'utf-8');
import { resolvers } from './resolvers/index.js';
import { ClaudeSessionManagerWithEvents } from './services/ClaudeSessionManagerWithEvents.js';
import { RunStorage } from './services/RunStorage.js';
// import { progressTracker } from './services/ProgressTracker.js';
// Progress tracking will be handled through the resolvers
import { createDataLoaders } from './dataloaders/index.js';
import { createRequestEventBus } from './services/eventBus.js';
import { useEventTracking } from './plugins/eventTracking.js';
import { createPerformancePlugin } from '../../shared/performance/graphql-plugin.js';

// Initialize logger with standard pattern
const logger = createLogger('claude-service', {}, {
  logDir: fileSystem.join(__dirname, '../../logs/claude-service')
});

const PORT = process.env.CLAUDE_SERVICE_PORT || 3002;

// Initialize services - session manager will be created per request with event bus
const runStorage = new RunStorage();

// Progress tracker events will be handled within the resolvers

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
      serviceName: 'claude-service',
      slowQueryThreshold: 500 // 500ms threshold
    }),
    createPerformancePlugin({
      serviceName: 'claude-service',
      slowThreshold: 30000, // 30 seconds for regular operations
      claudeSlowThreshold: 60000, // 1 minute for Claude operations
      logger
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

    // Create session manager with event support
    const sessionManager = new ClaudeSessionManagerWithEvents(eventBus, requestLogger, correlationId);

    return {
      sessionManager,
      runStorage,
      dataSources: createDataLoaders(runStorage, requestLogger),
      request,
      logger: requestLogger,
      correlationId,
      eventBus,
      workspaceRoot: process.env.WORKSPACE_ROOT || process.cwd(),
      environment: process.env.NODE_ENV || 'development',
      requestId: nanoid(),
      startTime: Date.now()
    };
  },
  maskedErrors: false,
  graphiql: true,
});

// Create HTTP server
const server = createServer(yoga);

// Health check endpoint
server.on('request', (req: any, res: any) => {
  if (req.url === '/health') {
    logger.debug('Health check requested');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      healthy: true, 
      service: 'claude-service',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    }));
    return;
  }
});

server.listen(PORT, () => {
  logger.info('Claude Service (Yoga) started', {
    port: PORT,
    graphqlEndpoint: `http://localhost:${PORT}/graphql`,
    healthEndpoint: `http://localhost:${PORT}/health`,
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