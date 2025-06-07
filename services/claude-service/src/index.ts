import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildCosmoSubgraphSchema } from '../../shared/federation/cosmo-subgraph.js';
// Import GraphQL from the shared federation to avoid version conflicts
import { parse, execute } from '../../shared/federation/node_modules/graphql/index.js';
import gql from 'graphql-tag';
import { resolvers } from './resolvers/index.js';
import { ClaudeSessionManager } from './services/ClaudeSessionManager.js';
import { RunStorage } from './services/RunStorage.js';
import { createLogger } from '@chasenocap/logger';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3002;

// Initialize services
const logger = createLogger('claude-service', {}, {
  logDir: join(__dirname, '../../logs/claude-service')
});
const sessionManager = new ClaudeSessionManager(logger);
const runStorage = new RunStorage(logger);

// Load the federated schema
const schemaPath = join(__dirname, '../schema/schema-federated.graphql');
const typeDefs = gql(readFileSync(schemaPath, 'utf-8'));

// Create the federated schema using Cosmo
const schema = buildCosmoSubgraphSchema({
  typeDefs,
  resolvers: resolvers as any
});

// Create HTTP server with SSE support
const server = createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
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
          runStorage,
          logger,
          correlationId: Math.random().toString(36).substring(7)
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

  // SSE endpoint for subscriptions
  if (req.url === '/graphql/stream' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    
    // Send heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      res.write(':heartbeat\n\n');
    }, 30000);
    
    req.on('close', () => {
      clearInterval(heartbeat);
    });
    
    return;
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

server.listen(PORT, () => {
  console.log('Starting Claude Service...');
  console.log(`🚀 Claude Service running at http://localhost:${PORT}/graphql`);
  console.log(`📡 SSE endpoint at http://localhost:${PORT}/graphql/stream`);
  console.log(`🏥 Health check at http://localhost:${PORT}/health`);
  console.log(`📊 Federation: Cosmo-compatible subgraph`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});