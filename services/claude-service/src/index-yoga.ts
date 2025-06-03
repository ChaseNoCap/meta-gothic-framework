import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const typeDefs = readFileSync(join(__dirname, '../schema/schema.graphql'), 'utf-8');
import { resolvers } from './resolvers/index.js';
import { ClaudeSessionManager } from './services/ClaudeSessionManager.js';
import { RunStorage } from './services/RunStorage.js';
import { progressTracker } from './services/ProgressTracker.js';
// Progress tracking will be handled through the resolvers
import { createDataLoaders } from './dataloaders/index.js';

const PORT = process.env.CLAUDE_SERVICE_PORT || 3002;

// Initialize services
const sessionManager = new ClaudeSessionManager();
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
  context: ({ request }) => ({
    sessionManager,
    runStorage,
    dataSources: createDataLoaders(),
    request,
  }),
  maskedErrors: false,
  graphiql: true,
});

// Create HTTP server
const server = createServer(yoga);

// Health check endpoint
server.on('request', (req, res) => {
  if (req.url === '/health') {
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
  console.log(`🚀 Claude Service (Yoga) ready at http://localhost:${PORT}/graphql`);
  console.log(`🏥 Health endpoint: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    process.exit(0);
  });
});