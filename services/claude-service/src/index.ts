import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildCosmoSubgraphSchema } from '../../shared/federation/cosmo-subgraph.js';
// Import GraphQL from the shared federation to avoid version conflicts
import { parse, execute, subscribe } from '../../shared/federation/node_modules/graphql/index.js';
import gql from 'graphql-tag';
import { createSSEHandler } from './sse-handler.js';
import { resolvers } from './resolvers/index.js';
import { ClaudeSessionManagerWithEvents } from './services/ClaudeSessionManagerWithEvents.js';
import { PreWarmSessionManager } from './services/PreWarmSessionManager.js';
import { RunStorage } from './services/RunStorage.js';
import { createLogger } from '@chasenocap/logger';
import { healthMonitor } from './health-monitor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3002;

// Initialize logger first
const logger = createLogger('claude-service', {}, {
  logDir: join(__dirname, '../../logs/claude-service')
});

// Load configuration
const configPath = join(__dirname, '../claude-config.json');
let claudeConfig: any = { preWarmEnabled: true };
try {
  claudeConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
} catch (error) {
  logger.warn('[Claude Service] Could not load claude-config.json, using defaults');
}

// Add global error handlers
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // console.error kept for critical errors that need immediate visibility
  healthMonitor.recordError(error);
  // Give time to flush logs before exit
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // console.error kept for critical errors that need immediate visibility
  healthMonitor.recordError(reason instanceof Error ? reason : new Error(String(reason)));
  // Don't exit on unhandled rejection, but log it
});

const sessionManager = new ClaudeSessionManagerWithEvents();
const preWarmManager = claudeConfig.preWarmEnabled 
  ? new PreWarmSessionManager(sessionManager, claudeConfig.preWarmSettings, logger)
  : undefined;

// Fix RunStorage initialization - ensure storageDir is first parameter
const runStorageDir = join(__dirname, '../../logs/claude-runs');
logger.info('Initializing RunStorage with directory:', runStorageDir);
const runStorage = new RunStorage(
  runStorageDir,
  undefined, // eventBus
  logger
);

// Load the federated schema
const schemaPath = join(__dirname, '../schema/schema-federated.graphql');
const typeDefs = gql(readFileSync(schemaPath, 'utf-8'));

// Debug: Check resolvers structure
logger.debug('[Claude Service] Resolvers structure:', {
  hasQuery: !!resolvers.Query,
  queryKeys: Object.keys(resolvers.Query || {}),
  hasMutation: !!resolvers.Mutation,
  mutationKeys: Object.keys(resolvers.Mutation || {}),
  hasSubscription: !!resolvers.Subscription,
  subscriptionKeys: Object.keys(resolvers.Subscription || {}),
});

// Create the federated schema using Cosmo
const schema = buildCosmoSubgraphSchema({
  typeDefs,
  resolvers: resolvers as any
});

// Create HTTP server with SSE support
const server = createServer(async (req, res) => {
  // CORS headers - allow credentials from specific origins
  const origin = req.headers.origin;
  if (origin === 'http://localhost:3001' || origin === 'http://127.0.0.1:3001' || origin === 'http://localhost:4000') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3001');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // GraphQL endpoint
  if (req.url === '/graphql' && req.method === 'POST') {
    healthMonitor.incrementActiveRequests();
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        let query, variables, operationName;
        try {
          const parsed = JSON.parse(body);
          query = parsed.query;
          variables = parsed.variables;
          operationName = parsed.operationName;
        } catch (parseError: any) {
          logger.error('Failed to parse GraphQL request body:', parseError);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ errors: [{ message: 'Invalid JSON in request body' }] }));
          return;
        }
        
        // Parse and execute the query
        const document = parse(query);
        const contextValue = {
          sessionManager,
          preWarmManager,
          runStorage,
          logger,
          correlationId: Math.random().toString(36).substring(7),
          workspaceRoot: process.env.WORKSPACE_ROOT || process.cwd()
        };
        
        const result = await execute({
          schema,
          document,
          contextValue,
          variableValues: variables,
          operationName
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        healthMonitor.decrementActiveRequests();
      } catch (error: any) {
        healthMonitor.recordError(error);
        healthMonitor.decrementActiveRequests();
        logger.error('GraphQL execution error:', {
          error: error.message,
          stack: error.stack,
          correlationId: contextValue.correlationId,
          operationName,
          query: query?.substring(0, 200)
        });
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ errors: [{ message: error.message }] }));
      }
    });
    return;
  }

  // SSE endpoint for subscriptions using custom handler
  if (req.url?.startsWith('/graphql/stream')) {
    const sseHandler = createSSEHandler({
      schema,
      execute,
      subscribe,
      context: () => ({
        sessionManager,
        preWarmManager,
        runStorage,
        logger,
        correlationId: Math.random().toString(36).substring(7),
        workspaceRoot: process.env.WORKSPACE_ROOT || process.cwd()
      })
    });
    
    return sseHandler(req, res);
  }

  // Health check
  if (req.url === '/health') {
    const metrics = healthMonitor.getMetrics();
    const status = metrics.errors.length > 5 ? 'degraded' : 'ok';
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status, 
      service: 'claude-service',
      federation: 'cosmo',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(metrics.uptime),
      memory: {
        heapUsed: Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        rss: Math.round(metrics.memoryUsage.rss / 1024 / 1024) + 'MB'
      },
      activeRequests: metrics.activeRequests,
      recentErrors: metrics.errors.length
    }));
    return;
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, async () => {
  logger.info('Starting Claude Service...');
  logger.info(`🚀 Claude Service running at http://localhost:${PORT}/graphql`);
  logger.info(`📡 SSE endpoint at http://localhost:${PORT}/graphql/stream`);
  logger.info(`🏥 Health check at http://localhost:${PORT}/health`);
  logger.info(`📊 Federation: Cosmo-compatible subgraph`);
  
  // Also log to console for PM2/systemd visibility
  console.log('Starting Claude Service...');
  console.log(`🚀 Claude Service running at http://localhost:${PORT}/graphql`);
  console.log(`📡 SSE endpoint at http://localhost:${PORT}/graphql/stream`);
  console.log(`🏥 Health check at http://localhost:${PORT}/health`);
  console.log(`📊 Federation: Cosmo-compatible subgraph`);
  
  // Start health monitoring
  healthMonitor.start();
  logger.info('Health monitoring started');
  
  // Initialize pre-warm session manager if enabled
  if (preWarmManager) {
    try {
      await preWarmManager.initialize();
      preWarmManager.startCleanupInterval();
      logger.info('🔥 Pre-warm session manager initialized');
      // Also log to console for PM2/systemd visibility
      console.log('🔥 Pre-warm session manager initialized');
    } catch (error) {
      logger.error('Failed to initialize pre-warm session manager:', error);
      // Also log to console for PM2/systemd visibility
      console.error('Failed to initialize pre-warm session manager:', error);
      // Don't crash the service if pre-warm fails
    }
  } else {
    logger.info('ℹ️  Pre-warm sessions disabled by configuration');
    // Also log to console for PM2/systemd visibility
    console.log('ℹ️  Pre-warm sessions disabled by configuration');
  }
});

// Graceful shutdown handler
const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully...`);
  // Also log to console for PM2/systemd visibility
  console.log(`${signal} received, shutting down gracefully...`);
  
  // Stop health monitoring
  healthMonitor.stop();
  
  // Stop pre-warm cleanup interval
  if (preWarmManager) {
    try {
      preWarmManager.stopCleanupInterval();
    } catch (error) {
      logger.error('Error stopping pre-warm cleanup:', error);
    }
  }
  
  // Clean up sessions
  try {
    sessionManager.cleanup();
  } catch (error) {
    logger.error('Error cleaning up sessions:', error);
  }
  
  server.close(() => {
    logger.info('Server closed');
    // Also log to console for PM2/systemd visibility
    console.log('Server closed');
    process.exit(0);
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Forced exit after timeout');
    // Also log to console for PM2/systemd visibility
    console.error('Forced exit after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));