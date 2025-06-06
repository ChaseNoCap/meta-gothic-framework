import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createHandler } from 'graphql-sse/lib/use/http';
import { parse } from 'graphql';
import { nanoid } from 'nanoid';
import { ClaudeSessionManager } from './services/ClaudeSessionManager.js';
import { ClaudeSessionManagerWithEvents } from './services/ClaudeSessionManagerWithEvents.js';
import { resolvers } from './resolvers/index.js';
import { useEventTracking } from './plugins/eventTracking.js';
import { createRequestEventBus } from './services/eventBus.js';
import { createLogger } from '@chasenocap/logger';
import { fileSystem } from '@chasenocap/file-system';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load schema
const typeDefs = readFileSync(join(__dirname, '../schema/schema.graphql'), 'utf-8');

// Create schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers
});

// Initialize logger
const logger = createLogger('claude-service', {}, {
  logDir: fileSystem.join(__dirname, '../../logs/claude-service')
});

// Create Yoga instance with SSE support
const yoga = createYoga({
  schema,
  plugins: [
    useEventTracking({
      serviceName: 'claude-service',
      slowQueryThreshold: 1000 // 1s threshold for AI operations
    })
  ],
  context: ({ request }) => {
    const correlationId = request.headers.get('x-correlation-id') || nanoid();
    const requestLogger = logger.child({
      correlationId,
      service: 'claude-service'
    });
    
    const sessionManager = new ClaudeSessionManagerWithEvents();
    const eventBus = createRequestEventBus(correlationId);
    
    return {
      sessionManager,
      logger: requestLogger,
      correlationId,
      eventBus,
      performanceData: []
    };
  },
  graphiql: {
    defaultQuery: `# Welcome to Claude Service GraphQL
{
  claudeHealth {
    healthy
    sessionStats {
      active
      total
      activeModels
    }
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
          service: 'claude-service-sse'
        });
        
        const sessionManager = new ClaudeSessionManagerWithEvents();
        const eventBus = createRequestEventBus(correlationId);
        
        return {
          sessionManager,
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
    res.end(JSON.stringify({ status: 'ok', service: 'claude-service' }));
    return;
  }
  
  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

const PORT = process.env.CLAUDE_SERVICE_PORT || 3002;

server.listen(PORT, () => {
  console.log(`🚀 Claude Service with SSE support is running on http://localhost:${PORT}/graphql`);
  console.log(`🌊 SSE endpoint available at http://localhost:${PORT}/graphql/stream`);
  console.log(`🏥 Health check endpoint available at http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});