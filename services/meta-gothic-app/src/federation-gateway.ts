import Fastify from 'fastify';
import gateway from '@mercuriusjs/gateway';

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

  // CORS support for development
  await app.register(import('@fastify/cors'), {
    origin: ['http://localhost:3001', 'http://localhost:5173'],
    credentials: true
  });

  // Health check endpoint
  app.get('/health', async (_request, _reply) => {
    return { 
      status: 'healthy',
      service: 'meta-gothic-federation-gateway',
      timestamp: new Date().toISOString(),
      mode: 'federation',
      services: ['repo-agent', 'claude']
    };
  });

  // Register the federation gateway
  await app.register(gateway, {
    gateway: {
      services: [
        { 
          name: 'repo-agent', 
          url: 'http://localhost:3004/graphql',
          wsUrl: 'ws://localhost:3004/graphql', // For subscriptions
          mandatory: true, // Service must be available
          rewriteHeaders: (headers: any) => {
            // Forward authorization headers if needed
            return headers;
          }
        },
        { 
          name: 'claude', 
          url: 'http://localhost:3002/graphql',
          wsUrl: 'ws://localhost:3002/graphql', // For subscriptions
          mandatory: true,
          rewriteHeaders: (headers: any) => {
            return headers;
          }
        }
      ],
      // Polling interval to check service health (milliseconds)
      pollingInterval: 10000,
      // Retry configuration for failed services
      retryServicesCount: 3,
      retryServicesInterval: 5000,
      // Allow services to return errors without failing the entire query
      allowBatchedQueries: true,
      // Enable GraphQL playground
      graphiql: true,
    },
    // Enable subscriptions
    subscription: true,
    // JIT compilation for better performance
    jit: 1,
    // Query depth limit
    queryDepth: 15,
    // Error handler
    errorHandler: (error: any, request: any, reply: any) => {
      app.log.error({ error, query: request.body }, 'GraphQL federation error');
      reply.send({
        errors: [
          {
            message: error.message,
            extensions: {
              code: 'FEDERATION_ERROR',
              service: error.service || 'gateway',
              timestamp: new Date().toISOString()
            }
          }
        ]
      });
    }
  });

  // Start the server
  await app.listen({ port: Number(PORT), host: HOST });
  
  app.log.info('🚀 Mercurius Federation Gateway started successfully!');
  app.log.info(`🌐 GraphQL endpoint: http://${HOST}:${PORT}/graphql`);
  app.log.info(`📊 GraphiQL playground: http://${HOST}:${PORT}/graphiql`);
  app.log.info('✅ Federation enabled with automatic entity resolution');
  app.log.info('📡 Connected services:');
  app.log.info('   - repo-agent: http://localhost:3004/graphql');
  app.log.info('   - claude: http://localhost:3002/graphql');
}

start().catch((err) => {
  console.error('Failed to start federation gateway:', err);
  process.exit(1);
});