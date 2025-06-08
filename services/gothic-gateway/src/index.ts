import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { stitchSchemas } from '@graphql-tools/stitch';
import { buildHTTPExecutor } from '@graphql-tools/executor-http';
import { schemaFromExecutor } from '@graphql-tools/wrap';
import { parse, execute, GraphQLSchema } from 'graphql';
import { createLogger } from '@chasenocap/logger';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.GATEWAY_PORT || 3000;

// Service endpoints
const SERVICES = {
  claude: {
    url: `http://localhost:${process.env.CLAUDE_SERVICE_PORT || 3002}/graphql`,
    name: 'claude-service'
  },
  git: {
    url: `http://localhost:${process.env.GIT_SERVICE_PORT || 3004}/graphql`,
    name: 'git-service'
  },
  github: {
    url: `http://localhost:${process.env.GITHUB_SERVICE_PORT || 3005}/graphql`,
    name: 'github-adapter'
  }
};

// Initialize logger
const logger = createLogger('gothic-gateway', {}, {
  logDir: join(__dirname, '../../logs/gothic-gateway')
});

// Health check function for services
async function checkServiceHealth(serviceName: string, url: string): Promise<boolean> {
  try {
    const healthUrl = url.replace('/graphql', '/health');
    const response = await fetch(healthUrl);
    const data = await response.json();
    return data.status === 'ok';
  } catch (error) {
    logger.error(`Health check failed for ${serviceName}:`, error);
    return false;
  }
}

// Fetch remote schema
async function fetchRemoteSchema(serviceName: string, url: string): Promise<GraphQLSchema | null> {
  try {
    // Create executor for the remote service
    const executor = buildHTTPExecutor({
      endpoint: url,
      headers: {
        'X-Gateway': 'gothic-gateway'
      }
    });

    // Create schema from executor
    const schema = await schemaFromExecutor(executor, {
      executor,
      batch: false
    });

    logger.info(`Fetched schema from ${serviceName}`);
    return schema;
  } catch (error) {
    logger.error(`Failed to fetch schema from ${serviceName}:`, error);
    return null;
  }
}

// Build the gateway schema
async function buildGatewaySchema(): Promise<GraphQLSchema | null> {
  const subschemas = [];

  // Fetch schemas from all services
  for (const [key, service] of Object.entries(SERVICES)) {
    const isHealthy = await checkServiceHealth(service.name, service.url);
    if (!isHealthy) {
      logger.warn(`Service ${service.name} is not healthy, skipping...`);
      continue;
    }

    const schema = await fetchRemoteSchema(service.name, service.url);
    if (schema) {
      subschemas.push({
        schema,
        executor: buildHTTPExecutor({
          endpoint: service.url,
          headers: {
            'X-Gateway': 'gothic-gateway'
          }
        }),
        batch: false
      });
    }
  }

  if (subschemas.length === 0) {
    logger.error('No services available to build gateway schema');
    return null;
  }

  // Stitch schemas together
  const gatewaySchema = stitchSchemas({
    subschemas,
    // Add gateway-level types
    typeDefs: `
      type Query {
        _gateway: GatewayInfo!
      }
      
      type GatewayInfo {
        version: String!
        services: [ServiceInfo!]!
        timestamp: String!
      }
      
      type ServiceInfo {
        name: String!
        url: String!
        healthy: Boolean!
      }
    `,
    resolvers: {
      Query: {
        _gateway: async () => ({
          version: '1.0.0',
          services: await Promise.all(
            Object.entries(SERVICES).map(async ([key, service]) => ({
              name: service.name,
              url: service.url,
              healthy: await checkServiceHealth(service.name, service.url)
            }))
          ),
          timestamp: new Date().toISOString()
        })
      }
    }
  });

  return gatewaySchema;
}

// Create HTTP server
async function startServer() {
  // Build initial schema
  let schema = await buildGatewaySchema();
  
  if (!schema) {
    logger.error('Failed to build gateway schema, exiting...');
    process.exit(1);
  }

  // Rebuild schema periodically to handle service changes
  setInterval(async () => {
    logger.info('Rebuilding gateway schema...');
    const newSchema = await buildGatewaySchema();
    if (newSchema) {
      schema = newSchema;
      logger.info('Gateway schema rebuilt successfully');
    }
  }, 30000); // Every 30 seconds

  const server = createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, X-Correlation-ID');
    res.setHeader('Access-Control-Expose-Headers', 'X-Request-ID, X-Correlation-ID');
    
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
          const correlationId = req.headers['x-correlation-id'] as string || 
                              Math.random().toString(36).substring(7);
          
          const contextValue = {
            correlationId,
            logger: logger.child({ correlationId }),
            headers: req.headers
          };
          
          const result = await execute({
            schema: schema!,
            document,
            contextValue,
            variableValues: variables,
            operationName
          });
          
          res.writeHead(200, { 
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId
          });
          res.end(JSON.stringify(result));
        } catch (error: any) {
          logger.error('GraphQL execution error:', error);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ errors: [{ message: error.message }] }));
        }
      });
      return;
    }

    // Health check endpoint
    if (req.url === '/health') {
      const services = await Promise.all(
        Object.entries(SERVICES).map(async ([key, service]) => ({
          name: service.name,
          url: service.url,
          healthy: await checkServiceHealth(service.name, service.url)
        }))
      );
      
      const allHealthy = services.every(s => s.healthy);
      
      res.writeHead(allHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: allHealthy ? 'ok' : 'degraded',
        service: 'gothic-gateway',
        implementation: 'typescript-native',
        services,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // GraphQL playground
    if (req.url === '/graphql' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Gothic Gateway - GraphQL Playground</title>
          <link rel="stylesheet" href="https://unpkg.com/graphiql/graphiql.min.css" />
        </head>
        <body style="margin: 0;">
          <div id="graphiql" style="height: 100vh;"></div>
          <script crossorigin src="https://unpkg.com/react/umd/react.production.min.js"></script>
          <script crossorigin src="https://unpkg.com/react-dom/umd/react-dom.production.min.js"></script>
          <script crossorigin src="https://unpkg.com/graphiql/graphiql.min.js"></script>
          <script>
            const fetcher = GraphiQL.createFetcher({
              url: '/graphql',
            });
            ReactDOM.render(
              React.createElement(GraphiQL, { fetcher }),
              document.getElementById('graphiql'),
            );
          </script>
        </body>
        </html>
      `);
      return;
    }

    // 404 for other routes
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  server.listen(PORT, () => {
    logger.info('Starting Gothic Gateway...');
    logger.info(`🚀 Gateway running at http://localhost:${PORT}/graphql`);
    logger.info(`🏥 Health check at http://localhost:${PORT}/health`);
    logger.info(`🎮 GraphQL Playground at http://localhost:${PORT}/graphql`);
    logger.info('📊 Implementation: TypeScript Native (Schema Stitching)');
    logger.info('Services:');
    Object.entries(SERVICES).forEach(([key, service]) => {
      logger.info(`  - ${service.name}: ${service.url}`);
    });
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
}

// Start the server
startServer().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});