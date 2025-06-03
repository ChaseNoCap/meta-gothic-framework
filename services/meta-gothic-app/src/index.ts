import Fastify, { FastifyRequest } from 'fastify';
import mercuriusGateway from '@mercuriusjs/gateway';
import websocket from '@fastify/websocket';

// Extend FastifyRequest to include our custom properties
declare module 'fastify' {
  interface FastifyRequest {
    queryStart?: number;
  }
  interface FastifyInstance {
    metrics?: {
      totalRequests: number;
      graphqlRequests: number;
      errorRequests: number;
      avgResponseTime: number;
      p95ResponseTime: number;
      p99ResponseTime: number;
    };
  }
}

const PORT = process.env.GATEWAY_PORT || 3000;
const HOST = process.env.GATEWAY_HOST || '0.0.0.0';

// Service health check function
async function checkServiceHealth(url: string): Promise<boolean> {
  try {
    const response = await fetch(url.replace('/graphql', '/health'));
    return response.ok;
  } catch {
    return false;
  }
}

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
    const services = {
      'repo-agent': await checkServiceHealth('http://localhost:3004/graphql'),
      'claude': await checkServiceHealth('http://localhost:3002/graphql')
    };
    
    const allHealthy = Object.values(services).every(status => status);
    
    return { 
      status: allHealthy ? 'healthy' : 'degraded',
      service: 'meta-gothic-gateway',
      timestamp: new Date().toISOString(),
      services
    };
  });

  // Configure federated services
  const services = [
    {
      name: 'repo-agent',
      url: process.env.REPO_AGENT_URL || 'http://localhost:3004/graphql',
      wsUrl: process.env.REPO_AGENT_WS_URL || 'ws://localhost:3004/graphql',
      mandatory: true
    },
    {
      name: 'claude',
      url: process.env.CLAUDE_SERVICE_URL || 'http://localhost:3002/graphql',
      wsUrl: process.env.CLAUDE_SERVICE_WS_URL || 'ws://localhost:3002/graphql',
      mandatory: true
    }
  ];

  // Query complexity analysis
  const depthLimit = 7;
  const complexityLimit = 1000;
  
  // Register the gateway
  await app.register(mercuriusGateway, {
    gateway: {
      services,
      pollingInterval: 2000, // Poll for schema changes
      serviceHealthCheck: true,
      errorHandler: (error, service) => {
        app.log.error({ error, service: service.name }, 'Gateway error from service');
        // Custom error formatting
        if (error.message?.includes('ECONNREFUSED')) {
          throw new Error(`Service ${service.name} is not available. Please ensure it's running.`);
        }
        if (error.message?.includes('ETIMEDOUT')) {
          throw new Error(`Service ${service.name} timed out. The operation took too long.`);
        }
        throw error;
      },
      // Retry configuration
      retryServicesConnectionInterval: 2000,
      retryServicesCount: 3
    },
    graphiql: process.env.NODE_ENV !== 'production',
    subscription: {
      // WebSocket configuration
      onConnect: async (data) => {
        app.log.debug({ data }, 'WebSocket client connected');
        return true;
      },
      onDisconnect: async (context) => {
        app.log.debug('WebSocket client disconnected');
      }
    },
    context: (request) => {
      return {
        request,
        // Pass through authorization header
        authorization: request.headers.authorization,
        // Add request ID for tracing
        requestId: request.id,
        // Add user info if available
        user: (request as any).user || null
      };
    }
  });
  
  // Helper function to analyze query depth
  function analyzeQueryDepth(query: string): { depth: number } {
    // Simple depth analysis - count nested braces
    let maxDepth = 0;
    let currentDepth = 0;
    
    for (const char of query) {
      if (char === '{') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === '}') {
        currentDepth--;
      }
    }
    
    return { depth: maxDepth };
  }

  // Gateway-level hooks
  app.addHook('preHandler', async (request, reply) => {
    if (request.url === '/graphql' && request.method === 'POST') {
      request.queryStart = Date.now();
      app.log.debug({ 
        requestId: request.id,
        body: request.body 
      }, 'Incoming GraphQL request');
    }
  });

  app.addHook('onSend', async (request, reply, payload) => {
    if (request.url === '/graphql' && request.queryStart) {
      const duration = Date.now() - request.queryStart;
      
      app.log.info({
        requestId: request.id,
        duration,
        statusCode: reply.statusCode
      }, 'GraphQL request completed');
    }
  });

  // Rate limiting middleware (basic implementation)
  const requestCounts = new Map<string, { count: number; resetTime: number }>();
  const RATE_LIMIT = 100; // requests per minute
  const RATE_WINDOW = 60000; // 1 minute in ms

  app.addHook('preHandler', async (request, reply) => {
    if (request.url !== '/graphql') return;
    
    const clientId = request.headers['x-forwarded-for'] as string || 
                    request.ip || 
                    'anonymous';
    const now = Date.now();
    
    let clientData = requestCounts.get(clientId);
    if (!clientData || now > clientData.resetTime) {
      clientData = { count: 0, resetTime: now + RATE_WINDOW };
      requestCounts.set(clientId, clientData);
    }
    
    clientData.count++;
    
    if (clientData.count > RATE_LIMIT) {
      reply.code(429).send({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
      });
    }
  });

  // Service discovery endpoint
  app.get('/services', async (request, reply) => {
    const serviceStatus = await Promise.all(
      services.map(async (service) => {
        const startTime = Date.now();
        const healthy = await checkServiceHealth(service.url);
        const responseTime = Date.now() - startTime;
        
        return {
          name: service.name,
          url: service.url,
          healthy,
          responseTime,
          wsUrl: service.wsUrl
        };
      })
    );
    
    return {
      gateway: {
        version: '1.0.0',
        endpoint: `http://${HOST}:${PORT}/graphql`,
        websocket: `ws://${HOST}:${PORT}/graphql`,
        features: [
          'federation',
          'subscriptions',
          'rate-limiting',
          'query-depth-limiting',
          'request-tracing'
        ]
      },
      services: serviceStatus,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  });
  
  // Metrics endpoint
  app.get('/metrics', async (request, reply) => {
    return {
      requests: {
        total: app.metrics?.totalRequests || 0,
        graphql: app.metrics?.graphqlRequests || 0,
        errors: app.metrics?.errorRequests || 0
      },
      performance: {
        averageResponseTime: app.metrics?.avgResponseTime || 0,
        p95ResponseTime: app.metrics?.p95ResponseTime || 0,
        p99ResponseTime: app.metrics?.p99ResponseTime || 0
      },
      timestamp: new Date().toISOString()
    };
  });

  // Initialize metrics
  app.metrics = {
    totalRequests: 0,
    graphqlRequests: 0,
    errorRequests: 0,
    avgResponseTime: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0
  };
  
  try {
    await app.listen({ port: PORT as number, host: HOST });
    app.log.info(`🌐 Meta GOTHIC Gateway ready at http://${HOST}:${PORT}/graphql`);
    app.log.info('Federated services:', services.map(s => ({
      name: s.name,
      url: s.url
    })));
    
    if (process.env.NODE_ENV !== 'production') {
      app.log.info(`🚀 GraphiQL playground available at http://${HOST}:${PORT}/graphiql`);
    }
    
    app.log.info('Available endpoints:');
    app.log.info('  - GraphQL: /graphql');
    app.log.info('  - Health: /health');
    app.log.info('  - Services: /services');
    app.log.info('  - Metrics: /metrics');
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