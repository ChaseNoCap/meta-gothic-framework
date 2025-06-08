import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildCosmoSubgraphSchema } from '../../shared/federation/cosmo-subgraph.js';
// Import GraphQL from the shared federation to avoid version conflicts
import { parse, execute, DocumentNode } from '../../shared/federation/node_modules/graphql/index.js';
import gql from 'graphql-tag';
import { createRequire } from 'module';

interface Event {
  type: string;
  payload: any;
  timestamp?: string;
}

interface EventBus {
  emit: (event: Event) => void;
}

interface Context {
  eventBus: EventBus;
  logger: Console;
  correlationId: string;
  githubToken: string | undefined;
}

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create require for loading .cjs modules
const require = createRequire(import.meta.url);

const PORT = process.env.PORT || 3005;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN;

// Read schema
const schemaPath = join(__dirname, '../schema.graphql');
const typeDefs = gql(readFileSync(schemaPath, 'utf-8'));

// Create a simple event bus stub
const eventBus: EventBus = {
  emit: (event: Event) => {
    console.log('[Event]', event.type, event.payload);
  }
};

// Load resolvers
const resolvers = require('../resolvers.cjs');

// Create the federated schema using Cosmo
const schema = buildCosmoSubgraphSchema({ typeDefs, resolvers });

// Create context function
const createContext = (): Context => ({
  eventBus,
  logger: console,
  correlationId: Math.random().toString(36).substring(7),
  githubToken: GITHUB_TOKEN
});

// Create HTTP server
const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
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
        const document: DocumentNode = parse(query);
        const contextValue = createContext();
        
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

  // Health check
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      service: 'github-adapter',
      federation: 'cosmo',
      hasToken: !!GITHUB_TOKEN,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // 404 for other routes
  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log('Starting GitHub Adapter...');
  console.log(`🚀 GitHub Adapter running at http://localhost:${PORT}/graphql`);
  console.log(`🏥 Health check at http://localhost:${PORT}/health`);
  console.log(`📊 Federation: Cosmo-compatible subgraph`);
  console.log(`🔑 GitHub Token: ${GITHUB_TOKEN ? 'Configured' : 'Not configured'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});