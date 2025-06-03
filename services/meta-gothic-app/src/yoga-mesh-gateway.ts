import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { stitchSchemas } from '@graphql-tools/stitch';
import { schemaFromExecutor } from '@graphql-tools/wrap';
import { buildHTTPExecutor } from '@graphql-tools/executor-http';

const PORT = process.env.GATEWAY_PORT || 3000;

async function start() {
  console.log('Starting Yoga Mesh Gateway...');

  try {
    // Create executors for each service
    const claudeExecutor = buildHTTPExecutor({
      endpoint: 'http://127.0.0.1:3002/graphql',
    });

    const repoAgentExecutor = buildHTTPExecutor({
      endpoint: 'http://127.0.0.1:3004/graphql',
    });

    // Build subschemas from executors
    const claudeSubschema = {
      schema: await schemaFromExecutor(claudeExecutor),
      executor: claudeExecutor,
    };

    const repoAgentSubschema = {
      schema: await schemaFromExecutor(repoAgentExecutor),
      executor: repoAgentExecutor,
    };

    // Stitch schemas together
    const gatewaySchema = stitchSchemas({
      subschemas: [claudeSubschema, repoAgentSubschema],
    });

    // Create Yoga server
    const yoga = createYoga({
      schema: gatewaySchema,
      maskedErrors: false,
      graphiql: true,
    });

    // Create HTTP server
    const server = createServer(yoga);

    server.listen(PORT, () => {
      console.log(`🌐 Yoga Mesh Gateway ready at http://localhost:${PORT}/graphql`);
      console.log(`   Connected services:`);
      console.log(`   - Claude Service: http://localhost:3002/graphql`);
      console.log(`   - Repo Agent Service: http://localhost:3004/graphql`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT signal received: closing HTTP server');
      server.close(() => {
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start gateway:', error);
    process.exit(1);
  }
}

start();