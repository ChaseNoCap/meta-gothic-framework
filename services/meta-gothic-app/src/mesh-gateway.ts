#!/usr/bin/env node

import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { getMesh } from '@graphql-mesh/runtime';
import { defaultImportFn, DefaultLogger, PubSub } from '@graphql-mesh/utils';
import GraphQLHandler from '@graphql-mesh/graphql';

const PORT = process.env.GATEWAY_PORT || 3000;

async function start() {
  console.log('Starting GraphQL Mesh Gateway...');
  
  try {
    const mesh = await getMesh({
      sources: [
        {
          name: 'ClaudeService',
          handler: new GraphQLHandler({
            name: 'ClaudeService',
            config: {
              endpoint: 'http://localhost:3002/graphql',
              operationHeaders: {
                'x-source': 'mesh'
              }
            },
            importFn: defaultImportFn,
            pubsub: new PubSub(),
            logger: new DefaultLogger('ClaudeService')
          })
        },
        {
          name: 'RepoAgentService',
          handler: new GraphQLHandler({
            name: 'RepoAgentService',
            config: {
              endpoint: 'http://localhost:3004/graphql',
              operationHeaders: {
                'x-source': 'mesh'
              }
            },
            importFn: defaultImportFn,
            pubsub: new PubSub(),
            logger: new DefaultLogger('RepoAgentService')
          })
        }
      ],
      transforms: [
        {
          federation: {
            types: [
              { name: 'Query' },
              { name: 'Mutation' },
              { name: 'Subscription' }
            ]
          }
        }
      ],
      cache: {
        localforage: {
          driver: ['INDEXEDDB', 'LOCALSTORAGE']
        }
      },
      pubsub: new PubSub(),
      logger: new DefaultLogger('Mesh'),
      importFn: defaultImportFn
    });

    // Create Yoga server with Mesh
    const yoga = createYoga({
      schema: mesh.schema,
      maskedErrors: false,
      graphiql: true,
      context: (initialContext) => {
        return {
          ...initialContext,
          ...mesh.contextBuilder(initialContext)
        };
      },
      plugins: mesh.plugins
    });

    // Create and start HTTP server
    const server = createServer(yoga);
    
    server.listen(PORT, () => {
      console.log(`🌐 GraphQL Mesh Gateway ready at http://localhost:${PORT}/graphql`);
      console.log(`   - Claude Service: http://localhost:3002/graphql`);
      console.log(`   - Repo Agent Service: http://localhost:3004/graphql`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        mesh.destroy();
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT signal received: closing HTTP server');
      server.close(() => {
        mesh.destroy();
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start Mesh Gateway:', error);
    process.exit(1);
  }
}

start();