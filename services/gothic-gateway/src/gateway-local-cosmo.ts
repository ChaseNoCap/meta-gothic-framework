import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { stitchSchemas } from '@graphql-tools/stitch';
import { schemaFromExecutor, wrapSchema } from '@graphql-tools/wrap';
import { AsyncExecutor } from '@graphql-tools/utils';
import { print } from 'graphql';
import fetch from 'cross-fetch';
import { createLogger } from '@chasenocap/logger';

const logger = createLogger('gateway-local-cosmo');

const PORT = process.env.PORT || 4000;

// Service endpoints
const services = [
  { name: 'claude-service', url: 'http://localhost:3002/graphql' },
  { name: 'git-service', url: 'http://localhost:3004/graphql' },
  { name: 'github-adapter', url: 'http://localhost:3005/graphql' }
];

// Create executor for each service
function createServiceExecutor(serviceUrl: string): AsyncExecutor {
  return async ({ document, variables, context }) => {
    const query = print(document);
    
    try {
      const response = await fetch(serviceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(context?.headers || {})
        },
        body: JSON.stringify({ query, variables })
      });

      const result = await response.json();
      return result;
    } catch (error) {
      logger.error(`Error executing query on ${serviceUrl}:`, error);
      throw error;
    }
  };
}

async function createGateway() {
  logger.info('Building federated schema...');
  
  // Create remote schemas
  const subschemas = await Promise.all(
    services.map(async ({ name, url }) => {
      try {
        const executor = createServiceExecutor(url);
        const schema = await schemaFromExecutor(executor);
        
        return {
          schema: wrapSchema({
            schema,
            executor
          }),
          name
        };
      } catch (error) {
        logger.error(`Failed to introspect ${name} at ${url}:`, error);
        throw error;
      }
    })
  );

  // Stitch schemas together
  const gatewaySchema = stitchSchemas({
    subschemas: subschemas.map(({ schema }) => ({ schema }))
  });

  logger.info('Schema stitching complete');
  return gatewaySchema;
}

async function startGateway() {
  try {
    const schema = await createGateway();
    
    const yoga = createYoga({
      schema,
      logging: logger,
      cors: {
        origin: ['http://localhost:3001'],
        credentials: true,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
      },
      graphiql: {
        title: 'metaGOTHIC Gateway (Local Cosmo)',
        defaultQuery: `query CheckHealth {
  claudeHealth {
    healthy
    version
    claudeAvailable
  }
  repoAgentHealth {
    status
    version
  }
}`
      }
    });

    const server = createServer(yoga);
    
    server.listen(PORT, () => {
      logger.info(`🚀 Gateway ready at http://localhost:${PORT}/graphql`);
      logger.info('📊 GraphQL Playground available');
      logger.info('🔗 Connected services:', services.map(s => s.name).join(', '));
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start gateway:', error);
    process.exit(1);
  }
}

// Start the gateway
startGateway().catch(error => {
  logger.error('Gateway startup failed:', error);
  process.exit(1);
});