import { createYoga } from 'graphql-yoga';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { createServer } from 'node:http';

const typeDefs = `
  type Query {
    health: HealthStatus!
  }
  
  type HealthStatus {
    status: String!
    version: String!
    claudeAvailable: Boolean!
    uptime: Int!
  }
`;

const resolvers = {
  Query: {
    health: () => ({
      status: 'healthy',
      version: '1.0.0',
      claudeAvailable: true,
      uptime: Math.floor(process.uptime())
    })
  }
};

const schema = makeExecutableSchema({
  typeDefs,
  resolvers
});

const yoga = createYoga({
  schema,
  graphiql: true
});

const server = createServer(yoga);

server.listen(3002, () => {
  console.log('Test server ready at http://localhost:3002/graphql');
});