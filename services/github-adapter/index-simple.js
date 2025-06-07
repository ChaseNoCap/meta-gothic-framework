import { createServer } from 'http';
import { createYoga } from 'graphql-yoga';
import { readFileSync } from 'fs';
import { parse } from 'graphql';
import { createLogger } from '../../packages/logger/dist/index.js';
import { nanoid } from 'nanoid';

// Read schema
const typeDefsString = readFileSync('./schema.graphql', 'utf-8');

// Initialize logger
const logger = createLogger('github-adapter', {}, {
  logDir: './logs'
});

const PORT = process.env.GITHUB_MESH_PORT || 3005;

// Simple mock resolvers for now
const resolvers = {
  Query: {
    githubUser: () => ({
      id: '1',
      login: 'testuser',
      name: 'Test User'
    }),
    githubRepository: () => null,
    githubRepositories: () => [],
    _service: () => ({
      sdl: typeDefsString
    })
  }
};

// Create Yoga instance
const yoga = createYoga({
  typeDefs: typeDefsString,
  resolvers: {
    ...resolvers,
    Query: {
      ...resolvers.Query,
      _entities: async (_parent, { representations }) => {
        return representations;
      },
      _service: () => ({
        sdl: typeDefsString
      })
    }
  },
  logging: logger,
  context: ({ request }) => {
    const requestId = nanoid();
    const correlationId = request.headers.get('x-correlation-id') || requestId;
    
    return {
      correlationId,
      logger: logger.child({ correlationId }),
      githubToken: process.env.GITHUB_TOKEN
    };
  },
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Correlation-ID'],
  },
  graphiql: {
    title: 'GitHub Adapter (Simple)',
    defaultQuery: `query TestQuery {
  _service {
    sdl
  }
  githubUser {
    login
    name
  }
}`,
  }
});

// Create server
const server = createServer(yoga);

// Add health check endpoint
server.on('request', (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      service: 'github-adapter-simple',
      timestamp: new Date().toISOString() 
    }));
    return;
  }
  
  // Let Yoga handle GraphQL requests
  yoga(req, res);
});

server.listen(PORT, () => {
  logger.info(`🚀 GitHub Adapter (Simple) ready at http://localhost:${PORT}/graphql`);
  logger.info(`🩺 Health check at http://localhost:${PORT}/health`);
});