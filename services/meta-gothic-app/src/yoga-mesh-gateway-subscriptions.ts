import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { stitchSchemas } from '@graphql-tools/stitch';
import { schemaFromExecutor } from '@graphql-tools/wrap';
import { buildHTTPExecutor } from '@graphql-tools/executor-http';
import { buildGraphQLWSExecutor } from '@graphql-tools/executor-graphql-ws';
import { WebSocket } from 'ws';

const PORT = process.env.GATEWAY_PORT || 3001;

async function start() {
  console.log('Starting Yoga Mesh Gateway with Subscriptions...');

  try {
    // Create HTTP executors for queries/mutations
    const claudeHttpExecutor = buildHTTPExecutor({
      endpoint: 'http://127.0.0.1:3002/graphql',
    });

    const repoAgentHttpExecutor = buildHTTPExecutor({
      endpoint: 'http://127.0.0.1:3004/graphql',
    });

    // Create WebSocket executors for subscriptions
    const claudeWsExecutor = buildGraphQLWSExecutor({
      url: 'ws://127.0.0.1:3002/graphql',
      webSocketImpl: WebSocket,
    });

    const repoAgentWsExecutor = buildGraphQLWSExecutor({
      url: 'ws://127.0.0.1:3004/graphql',
      webSocketImpl: WebSocket,
    });

    // Build subschemas with both HTTP and WS executors
    const claudeSubschema = {
      schema: await schemaFromExecutor(claudeHttpExecutor),
      executor: async (executorRequest: any) => {
        // Use WebSocket executor for subscriptions
        if (executorRequest.operationType === 'subscription') {
          return claudeWsExecutor(executorRequest);
        }
        // Use HTTP executor for queries and mutations
        return claudeHttpExecutor(executorRequest);
      },
      batch: true,
    };

    const repoAgentSubschema = {
      schema: await schemaFromExecutor(repoAgentHttpExecutor),
      executor: async (executorRequest: any) => {
        // Repo agent doesn't have subscriptions yet, but ready for them
        if (executorRequest.operationType === 'subscription') {
          return repoAgentWsExecutor(executorRequest);
        }
        return repoAgentHttpExecutor(executorRequest);
      },
      batch: true,
    };

    // Stitch schemas together
    const gatewaySchema = stitchSchemas({
      subschemas: [claudeSubschema, repoAgentSubschema],
      // Merge subscription types from both services
      typeMergingOptions: {
        validationSettings: {
          validationLevel: 'off' // Allow duplicate types during development
        }
      }
    });

    // Create Yoga server with subscription support
    const yoga = createYoga({
      schema: gatewaySchema,
      maskedErrors: false,
      graphiql: {
        // Enable subscription support in GraphiQL
        subscriptionsProtocol: 'WS',
      },
    });

    // Create HTTP server
    const server = createServer(yoga);

    server.listen(PORT, () => {
      console.log(`🌐 Yoga Mesh Gateway (with Subscriptions) ready at http://localhost:${PORT}/graphql`);
      console.log(`   Connected services:`);
      console.log(`   - Claude Service: http://localhost:3002/graphql (with WebSocket subscriptions)`);
      console.log(`   - Repo Agent Service: http://localhost:3004/graphql`);
      console.log('');
      console.log('   Available Subscriptions:');
      console.log('   - commandOutput(sessionId: ID!)');
      console.log('   - agentRunProgress(runId: ID!)');
      console.log('   - batchProgress(batchId: ID!)');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        // Close WebSocket connections
        if (claudeWsExecutor.dispose) claudeWsExecutor.dispose();
        if (repoAgentWsExecutor.dispose) repoAgentWsExecutor.dispose();
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT signal received: closing HTTP server');
      server.close(() => {
        // Close WebSocket connections
        if (claudeWsExecutor.dispose) claudeWsExecutor.dispose();
        if (repoAgentWsExecutor.dispose) repoAgentWsExecutor.dispose();
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start gateway:', error);
    process.exit(1);
  }
}

start();