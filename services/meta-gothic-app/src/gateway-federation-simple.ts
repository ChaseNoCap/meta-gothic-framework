import { ApolloGateway, IntrospectAndCompose } from '@apollo/gateway';
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';

// Service URLs
const CLAUDE_SERVICE_URL = process.env.CLAUDE_SERVICE_URL || 'http://localhost:3002/graphql';
const REPO_AGENT_SERVICE_URL = process.env.REPO_AGENT_SERVICE_URL || 'http://localhost:3004/graphql';

async function startServer() {
  try {
    // Create Apollo Gateway with minimal configuration
    const gateway = new ApolloGateway({
      supergraphSdl: new IntrospectAndCompose({
        subgraphs: [
          { name: 'claude', url: CLAUDE_SERVICE_URL },
          { name: 'repo-agent', url: REPO_AGENT_SERVICE_URL }
        ]
      })
    });

    // Create Apollo Server with minimal configuration
    const server = new ApolloServer({
      gateway,
      introspection: true
    });

    // Start the server
    const port = Number(process.env.PORT || 3000);
    const { url } = await startStandaloneServer(server, {
      listen: { port }
    });

    console.log(`🚀 Apollo Federation Gateway ready at ${url}`);
    console.log(`\nFederated services:`);
    console.log(`  - Claude Service: ${CLAUDE_SERVICE_URL}`);
    console.log(`  - Repo Agent Service: ${REPO_AGENT_SERVICE_URL}`);

  } catch (error) {
    console.error('Failed to start gateway:', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch(console.error);