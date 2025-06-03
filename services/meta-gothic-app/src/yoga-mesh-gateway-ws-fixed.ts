import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { stitchSchemas } from '@graphql-tools/stitch';
import { schemaFromExecutor } from '@graphql-tools/wrap';
import { buildHTTPExecutor } from '@graphql-tools/executor-http';
import { buildGraphQLWSExecutor } from '@graphql-tools/executor-graphql-ws';
import { WebSocketServer } from 'ws';
import { makeServer } from 'graphql-ws';
import WebSocket from 'ws';

const PORT = process.env.GATEWAY_PORT || 3001;

async function start() {
  console.log('Starting Yoga Mesh Gateway with proper WebSocket support...');

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
      executor: async (params: any) => {
        // Use WebSocket executor for subscriptions
        if (params.operationType === 'subscription') {
          return claudeWsExecutor(params);
        }
        // Use HTTP executor for queries/mutations
        return claudeHttpExecutor(params);
      }
    };

    const repoAgentSubschema = {
      schema: await schemaFromExecutor(repoAgentHttpExecutor),
      executor: async (params: any) => {
        if (params.operationType === 'subscription') {
          return repoAgentWsExecutor(params);
        }
        return repoAgentHttpExecutor(params);
      }
    };

    // Stitch schemas together
    const gatewaySchema = stitchSchemas({
      subschemas: [claudeSubschema, repoAgentSubschema],
    });

    // Create Yoga server
    const yoga = createYoga({
      schema: gatewaySchema,
      maskedErrors: false,
      graphiql: {
        title: 'Yoga Mesh Gateway (WebSocket Ready)',
        defaultQuery: `# Try a subscription
subscription CommandOutput {
  commandOutput(sessionId: "test") {
    type
    data
    timestamp
  }
}

# Or execute a command first
# mutation ExecuteCommand {
#   executeCommand(input: {
#     prompt: "echo Hello WebSocket!"
#     workingDirectory: "/tmp"
#   }) {
#     sessionId
#     success
#   }
# }`
      },
    });

    // Create HTTP server
    const httpServer = createServer((req, res) => {
      // Handle regular HTTP requests with Yoga
      if (req.url?.startsWith('/graphql')) {
        yoga(req, res);
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    // Create WebSocket server
    const wsServer = new WebSocketServer({
      server: httpServer,
      path: '/graphql',
    });

    // Set up GraphQL WebSocket server
    makeServer({
      schema: gatewaySchema,
      onConnect: async () => {
        console.log('Gateway WebSocket client connected');
      },
      onDisconnect: async () => {
        console.log('Gateway WebSocket client disconnected');
      }
    }, wsServer);

    // Start server
    httpServer.listen(PORT, () => {
      console.log(`🌐 Yoga Mesh Gateway ready at http://localhost:${PORT}/graphql`);
      console.log(`🔌 WebSocket subscriptions available at ws://localhost:${PORT}/graphql`);
      console.log(`   Connected services:`);
      console.log(`   - Claude Service: http://localhost:3002/graphql (with WebSocket)`);
      console.log(`   - Repo Agent Service: http://localhost:3004/graphql`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received: closing servers');
      wsServer.close();
      httpServer.close(() => {
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT signal received: closing servers');
      wsServer.close();
      httpServer.close(() => {
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start gateway:', error);
    process.exit(1);
  }
}

start();