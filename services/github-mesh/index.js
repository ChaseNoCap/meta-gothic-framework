const { ApolloServer } = require('@apollo/server');
const { startStandaloneServer } = require('@apollo/server/standalone');
const { buildSubgraphSchema } = require('@apollo/subgraph');
const { readFileSync } = require('fs');
const { join } = require('path');
const gql = require('graphql-tag');

// Load schema
const typeDefs = gql(readFileSync(join(__dirname, 'schema.graphql'), 'utf-8'));

// Load resolvers
const resolvers = require('./resolvers');

async function startServer() {
  const server = new ApolloServer({
    schema: buildSubgraphSchema([{ typeDefs, resolvers }])
  });

  const { url } = await startStandaloneServer(server, {
    listen: { port: process.env.PORT || 3005 },
    context: async () => ({
      githubToken: process.env.GITHUB_TOKEN
    })
  });

  console.log(`🚀 GitHub service ready at ${url}`);
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});