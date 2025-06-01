import Fastify from 'fastify';
import mercuriusGateway from '@mercurius/gateway';
import websocket from '@fastify/websocket';

const PORT = process.env.GATEWAY_PORT || 3000;
const HOST = process.env.GATEWAY_HOST || '0.0.0.0';

async function start() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      }
    }
  });

  // Register websocket support for subscriptions
  await app.register(websocket);

  // CORS support for development
  await app.register(import('@fastify/cors'), {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true
  });

  // Health check endpoint
  app.get('/health', async (request, reply) => {
    return { 
      status: 'healthy',
      service: 'meta-gothic-gateway',
      timestamp: new Date().toISOString()
    };
  });

  // Configure federated services
  const services = [
    {
      name: 'repo-agent',
      url: process.env.REPO_AGENT_URL || 'http://localhost:3001/graphql',
      wsUrl: process.env.REPO_AGENT_WS_URL || 'ws://localhost:3001/graphql'
    },
    {
      name: 'claude',
      url: process.env.CLAUDE_SERVICE_URL || 'http://localhost:3002/graphql',
      wsUrl: process.env.CLAUDE_SERVICE_WS_URL || 'ws://localhost:3002/graphql'
    }
  ];

  // Register the gateway
  await app.register(mercuriusGateway, {
    gateway: {
      services,
      pollingInterval: 2000, // Poll for schema changes
      errorHandler: (error, service) => {
        app.log.error({ error, service }, 'Gateway error from service');
        throw error;
      }
    },
    graphiql: process.env.NODE_ENV !== 'production',
    subscription: true,
    context: (request) => {
      return {
        request,
        // Add any gateway-level context
        authorization: request.headers.authorization
      };
    }
  });

  // Gateway-level extensions
  app.graphql.addHook('preParsing', async (schema, document, context) => {
    app.log.debug({ document }, 'Incoming GraphQL request');
  });

  app.graphql.addHook('onResolution', async (execution, context) => {
    if (execution.errors) {
      app.log.error({ errors: execution.errors }, 'GraphQL execution errors');
    }
  });

  try {
    await app.listen({ port: PORT as number, host: HOST });
    app.log.info(`🌐 Meta GOTHIC Gateway ready at http://${HOST}:${PORT}/graphql`);
    app.log.info('Federated services:', services);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

// Start the server
start().catch((err) => {
  console.error('Failed to start gateway:', err);
  process.exit(1);
});