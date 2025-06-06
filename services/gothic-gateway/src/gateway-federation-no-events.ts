import { ApolloGateway, IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';

// Service URLs - can be configured via environment variables
const CLAUDE_SERVICE_URL = process.env.CLAUDE_SERVICE_URL || 'http://localhost:3002/graphql';
const REPO_AGENT_SERVICE_URL = process.env.REPO_AGENT_SERVICE_URL || 'http://localhost:3004/graphql';

// Custom data source to handle headers properly
class AuthenticatedDataSource extends RemoteGraphQLDataSource {
  willSendRequest({ request, context }) {
    // Ensure request.http exists
    if (!request.http) {
      request.http = {};
    }
    if (!request.http.headers) {
      request.http.headers = new Map();
    }
    
    // Safely forward headers from the original request
    if (context && context.headers) {
      try {
        Object.entries(context.headers).forEach(([key, value]) => {
          if (value && typeof value === 'string') {
            request.http.headers.set(key.toLowerCase(), value);
          }
        });
      } catch (error) {
        console.error('Error forwarding headers:', error);
      }
    }
  }
}

async function startServer() {
  try {
    // Create Apollo Gateway with detailed logging
    const gateway = new ApolloGateway({
      supergraphSdl: new IntrospectAndCompose({
        subgraphs: [
          { name: 'claude', url: CLAUDE_SERVICE_URL },
          { name: 'repo-agent', url: REPO_AGENT_SERVICE_URL }
        ],
        pollIntervalInMs: process.env.NODE_ENV === 'production' ? 60000 : 10000
      }),
      debug: true,
      serviceHealthCheck: true,
      buildService({ url }) {
        return new AuthenticatedDataSource({ url });
      }
    });

    // Don't manually load the gateway - Apollo Server will do it

    // Create Apollo Server
    const server = new ApolloServer({
      gateway,
      plugins: [
        ApolloServerPluginLandingPageLocalDefault({ 
          embed: true,
          includeCookies: true 
        }),
        {
          async serverWillStart() {
            console.log('🚀 Apollo Gateway starting...');
          },
          async requestDidStart(requestContext) {
            console.log('Request started:', {
              operationName: requestContext?.request?.operationName,
              query: requestContext?.request?.query?.substring(0, 100)
            });
            
            return {
              async willSendResponse(responseContext) {
                console.log('Response sent');
              },
              async didEncounterErrors(errorContext) {
                const errors = errorContext?.errors;
                if (errors && errors.length > 0) {
                  console.error('GraphQL errors:', errors);
                }
              }
            };
          }
        }
      ],
      introspection: true,
      includeStacktraceInErrorResponses: true
    });

    // Start the server with standalone server
    const port = Number(process.env.PORT || 3000);
    const { url } = await startStandaloneServer(server, {
      listen: { port },
      context: async ({ req }) => {
        // Ensure headers are properly passed to the context
        return {
          headers: req.headers || {},
          request: req
        };
      }
    });

    console.log(`🚀 Apollo Federation Gateway ready at ${url}`);
    console.log(`📊 Apollo Studio Sandbox available at ${url}`);
    console.log(`\nFederated services:`);
    console.log(`  - Claude Service: ${CLAUDE_SERVICE_URL}`);
    console.log(`  - Repo Agent Service: ${REPO_AGENT_SERVICE_URL}`);

    // Create a simple health check server on the next port
    const http = await import('http');
    const healthServer = http.createServer(async (req, res) => {
      if (req.url === '/health' && req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json');
        try {
          const health = await gateway.serviceHealthCheck();
          res.statusCode = 200;
          res.end(JSON.stringify({
            status: 'healthy',
            gateway: 'Apollo Federation v2',
            services: health
          }));
        } catch (error) {
          res.statusCode = 503;
          res.end(JSON.stringify({
            status: 'unhealthy',
            error: error.message
          }));
        }
      } else {
        res.statusCode = 404;
        res.end();
      }
    });

    healthServer.listen(port + 1000, () => {
      console.log(`🏥 Health check endpoint available at http://localhost:${port + 1000}/health`);
    });

  } catch (error) {
    console.error('Failed to start gateway:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

// Start the server
startServer().catch(console.error);