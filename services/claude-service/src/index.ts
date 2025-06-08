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

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3002;

// Load configuration
const configPath = join(__dirname, '../claude-config.json');
let claudeConfig: any = { preWarmEnabled: true };
try {
  claudeConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
} catch (error) {
  console.warn('[Claude Service] Could not load claude-config.json, using defaults');
}

// Initialize services
const logger = createLogger('claude-service', {}, {
  logDir: join(__dirname, '../../logs/claude-service')
});
const sessionManager = new ClaudeSessionManagerWithEvents();
const preWarmManager = claudeConfig.preWarmEnabled 
  ? new PreWarmSessionManager(sessionManager, claudeConfig.preWarmSettings, logger)
  : undefined;
const runStorage = new RunStorage(
  join(__dirname, '../../logs/claude-runs'),
  undefined,
  logger
);

// Load the federated schema
const schemaPath = join(__dirname, '../schema/schema-federated.graphql');
const typeDefs = gql(readFileSync(schemaPath, 'utf-8'));

// Debug: Check resolvers structure
console.log('[Claude Service] Resolvers structure:', {
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
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { query, variables, operationName } = JSON.parse(body);
        
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
      } catch (error: any) {
        console.error('GraphQL execution error:', error);
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
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      service: 'claude-service',
      federation: 'cosmo',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, async () => {
  console.log('Starting Claude Service...');
  console.log(`🚀 Claude Service running at http://localhost:${PORT}/graphql`);
  console.log(`📡 SSE endpoint at http://localhost:${PORT}/graphql/stream`);
  console.log(`🏥 Health check at http://localhost:${PORT}/health`);
  console.log(`📊 Federation: Cosmo-compatible subgraph`);
  
  // Initialize pre-warm session manager if enabled
  if (preWarmManager) {
    try {
      await preWarmManager.initialize();
      preWarmManager.startCleanupInterval();
      console.log('🔥 Pre-warm session manager initialized');
    } catch (error) {
      console.error('Failed to initialize pre-warm session manager:', error);
    }
  } else {
    console.log('ℹ️  Pre-warm sessions disabled by configuration');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  // Stop pre-warm cleanup interval
  if (preWarmManager) {
    preWarmManager.stopCleanupInterval();
  }
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Handle SIGINT (Ctrl+C) gracefully
process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  
  // Stop pre-warm cleanup interval
  if (preWarmManager) {
    preWarmManager.stopCleanupInterval();
  }
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});