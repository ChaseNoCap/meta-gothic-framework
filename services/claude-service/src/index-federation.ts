import { createServer } from 'node:http';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { createYoga } from 'graphql-yoga';
import { readFileSync } from 'fs';
import { getFileSystem } from '@meta-gothic/shared-types/file-system';
import { fileURLToPath } from 'url';
import { createLogger } from '@chasenocap/logger';
import { nanoid } from 'nanoid';
import { parse } from 'graphql';

const fileSystem = getFileSystem();
const __dirname = fileSystem.dirname(fileURLToPath(import.meta.url));
const typeDefsString = readFileSync(fileSystem.join(__dirname, '../schema/schema-federated.graphql'), 'utf-8');
const typeDefs = parse(typeDefsString);

import { resolvers } from './resolvers/index.js';
import { createRequestEventBus } from './services/eventBus.js';
import { ClaudeSessionManagerWithEvents as ClaudeSessionManager } from './services/ClaudeSessionManagerWithEvents.js';
import { RunStorage } from './services/RunStorage.js';
import { ProgressTracker } from './services/ProgressTracker.js';
import { useEventTracking } from './plugins/eventTracking.js';
import type { Context } from './types/context.js';

// Initialize logger
const logger = createLogger('claude-service', {}, {
  logDir: fileSystem.join(__dirname, '../../logs/claude-service')
});

const PORT = process.env['CLAUDE_PORT'] || 3002;

// Build federated schema
const schema = buildSubgraphSchema([
  {
    typeDefs,
    resolvers: resolvers as any,
  },
]);

// Add reference resolvers for federation
const federatedResolvers = {
  ClaudeSession: {
    __resolveReference(reference: { id: string }, context: Context) {
      return context.sessionManager.getSession(reference.id);
    },
  },
  Repository: {
    claudeSessions(repository: { path: string }, _args: any, context: Context) {
      // Return sessions that are working on this repository
      const allSessions = context.sessionManager.getAllSessions();
      return allSessions.filter(session => 
        session.workingDirectory.includes(repository.path)
      );
    },
  },
};

// Merge resolvers
const mergedResolvers = {
  ...resolvers,
  ...federatedResolvers,
};

// Create Yoga server with federation schema
const yoga = createYoga({
  schema: buildSubgraphSchema([
    {
      typeDefs,
      resolvers: mergedResolvers as any,
    },
  ]),
  plugins: [
    useEventTracking({
      serviceName: 'claude-service',
      slowQueryThreshold: 500 // 500ms threshold for Claude operations
    })
  ],
  context: ({ request }): Context => {
    // Generate correlation ID for request tracking
    const correlationId = request.headers.get('x-correlation-id') || nanoid();
    const requestLogger = logger.child({
      correlationId,
      method: request.method,
      url: request.url,
    });

    // Create request-scoped event bus
    const eventBus = createRequestEventBus(correlationId);
    
    // Create session manager with events
    const sessionManager = new ClaudeSessionManager(eventBus, requestLogger, correlationId);
    
    // Create run storage
    const runStorage = new RunStorage();
    
    // Create progress tracker
    const progressTracker = new ProgressTracker(eventBus, runStorage);

    return {
      request,
      logger: requestLogger,
      correlationId,
      eventBus,
      sessionManager,
      runStorage,
      progressTracker,
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
      service: 'claude-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      federation: true
    }));
    return;
  }
});

server.listen(PORT, () => {
  logger.info('Claude Service (Federation) started', {
    port: PORT,
    graphqlEndpoint: `http://localhost:${PORT}/graphql`,
    healthEndpoint: `http://localhost:${PORT}/health`,
    federation: true,
    subgraph: 'claude'
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