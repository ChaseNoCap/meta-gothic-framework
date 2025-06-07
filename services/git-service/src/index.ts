import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse, execute, GraphQLSchema } from 'graphql';
import { buildSubgraphSchema } from '@apollo/subgraph';
import gql from 'graphql-tag';
import { resolvers } from './resolvers/index.js';
import { GitServiceWithEvents } from './services/GitServiceWithEvents.js';
import { createRequestEventBus } from './services/eventBus.js';
import { createLogger } from '@chasenocap/logger';
import { nanoid } from 'nanoid';
import { getFileSystem } from '@meta-gothic/shared-types/file-system';
import type { GitContext } from './resolvers/context.js';

const fileSystem = getFileSystem();
const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.GIT_SERVICE_PORT || 3003;

// Initialize logger
const logger = createLogger('git-service', {}, {
  logDir: join(__dirname, '../../logs/git-service')
});

// Create shared instances
const sharedEventBus = createRequestEventBus('shared');
const gitService = new GitServiceWithEvents(logger, sharedEventBus);

// Load the federated schema
const schemaPath = join(__dirname, '../schema/schema-federated.graphql');
const typeDefs = gql(readFileSync(schemaPath, 'utf-8'));

// Build federation-aware schema with proper resolvers
const schema = buildSubgraphSchema({
  typeDefs,
  resolvers: {
    ...resolvers,
    Repository: {
      ...resolvers.Repository,
      __resolveReference(reference: { path: string }) {
        return gitService.getRepositoryDetails(reference.path);
      }
    }
  } as any
});

// Create HTTP server
const server = createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, X-Correlation-ID');
  
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
        
        // Create context
        const requestId = nanoid();
        const requestEventBus = createRequestEventBus(requestId);
        const correlationId = req.headers['x-correlation-id'] as string || requestId;
        
        const contextValue: GitContext = {
          gitService,
          correlationId,
          logger: logger.child({ correlationId }),
          eventBus: requestEventBus,
          sharedEventBus,
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
        logger.error('GraphQL execution error:', error);
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
      service: 'git-service',
      federation: 'cosmo',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // 404 for other routes
  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  logger.info(`🚀 Git Service running at http://localhost:${PORT}/graphql`);
  logger.info(`🏥 Health check at http://localhost:${PORT}/health`);
  logger.info('📊 Federation: Cosmo-compatible subgraph');
});