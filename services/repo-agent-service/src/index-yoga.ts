import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const typeDefs = readFileSync(join(__dirname, '../schema/schema.graphql'), 'utf-8');
import { resolvers } from './resolvers/index.js';

const PORT = process.env.REPO_AGENT_PORT || 3004;
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd();

// Create schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers: resolvers as any,
});

// Create Yoga server
const yoga = createYoga({
  schema,
  context: ({ request }) => ({
    workspaceRoot: WORKSPACE_ROOT,
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
      service: 'repo-agent-service',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    }));
    return;
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Repo Agent Service (Yoga) ready at http://localhost:${PORT}/graphql`);
  console.log(`🏥 Health endpoint: http://localhost:${PORT}/health`);
  console.log(`📁 Workspace root: ${WORKSPACE_ROOT}`);
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