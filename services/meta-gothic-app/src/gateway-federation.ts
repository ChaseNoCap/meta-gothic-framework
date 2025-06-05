import { ApolloGateway, IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import express from 'express';
import cors from 'cors';
import { eventBus } from './eventBus.js';
import type { GraphQLQueryCompletedEvent, GraphQLMutationCompletedEvent } from '../../shared/event-types.js';

// Service URLs - can be configured via environment variables
const CLAUDE_SERVICE_URL = process.env.CLAUDE_SERVICE_URL || 'http://localhost:3002/graphql';
const REPO_AGENT_SERVICE_URL = process.env.REPO_AGENT_SERVICE_URL || 'http://localhost:3004/graphql';
const GITHUB_SERVICE_URL = process.env.GITHUB_SERVICE_URL || 'http://localhost:3005/graphql';

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
          { name: 'repo-agent', url: REPO_AGENT_SERVICE_URL },
          { name: 'github', url: GITHUB_SERVICE_URL }
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
            const startTime = Date.now();
            // Safely extract request and contextValue from context
            const request = requestContext?.request;
            const contextValue = requestContext?.contextValue;
            
            return {
              async willSendResponse(responseContext) {
                // Only emit events if we have a valid request
                if (request && request.query) {
                  try {
                    const duration = Date.now() - startTime;
                    const isQuery = request.query.trim().startsWith('query') || 
                                  (!request.query.trim().startsWith('mutation') && 
                                   !request.query.trim().startsWith('subscription'));
                    
                    if (isQuery) {
                      const event: GraphQLQueryCompletedEvent = {
                        type: 'graphql.query.completed',
                        timestamp: new Date().toISOString(),
                        payload: {
                          operationName: request.operationName,
                          duration,
                          dataSize: JSON.stringify(responseContext?.response?.body || {}).length,
                          correlationId: (contextValue as any)?.correlationId || ''
                        }
                      };
                      eventBus.emit(event);
                    } else {
                      const event: GraphQLMutationCompletedEvent = {
                        type: 'graphql.mutation.completed',
                        timestamp: new Date().toISOString(),
                        payload: {
                          operationName: request.operationName,
                          duration,
                          success: !responseContext?.response?.errors,
                          correlationId: (contextValue as any)?.correlationId || ''
                        }
                      };
                      eventBus.emit(event);
                    }
                  } catch (error) {
                    console.error('Error emitting response event:', error);
                  }
                }
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

    // Start the server with Express for better CORS control
    await server.start();
    
    const app = express();
    const port = Number(process.env.PORT || 3000);
    
    // Configure CORS to allow credentials
    app.use(cors({
      origin: ['http://localhost:3001', 'http://localhost:5173'], // Allow UI dev servers
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));
    
    // Parse JSON bodies
    app.use(express.json());
    
    // Apply Apollo middleware
    app.use(
      '/graphql',
      expressMiddleware(server, {
        context: async ({ req }) => {
          // Ensure headers are properly passed to the context
          return {
            headers: req.headers || {},
            request: req
          };
        }
      })
    );
    
    // Start Express server
    const httpServer = app.listen(port, () => {
      console.log(`🚀 Apollo Federation Gateway ready at http://localhost:${port}/graphql`);
      console.log(`📊 Apollo Studio Sandbox available at http://localhost:${port}/graphql`);
      console.log(`\nFederated services:`);
      console.log(`  - Claude Service: ${CLAUDE_SERVICE_URL}`);
      console.log(`  - Repo Agent Service: ${REPO_AGENT_SERVICE_URL}`);
      console.log(`  - GitHub Service: ${GITHUB_SERVICE_URL}`);
    });

    // Add health check endpoint to Express app
    app.get('/health', async (req, res) => {
      try {
        const health = await gateway.serviceHealthCheck();
        res.json({
          status: 'healthy',
          gateway: 'Apollo Federation v2',
          services: health
        });
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          error: error.message
        });
      }
    });
    
    console.log(`🏥 Health check endpoint available at http://localhost:${port}/health`);

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