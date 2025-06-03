#!/usr/bin/env node

import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { getMesh } from '@graphql-mesh/runtime';
import { DefaultLogger, defaultImportFn, PubSub } from '@graphql-mesh/utils';
import GraphQLHandler from '@graphql-mesh/graphql';
import OpenAPIHandler from '@graphql-mesh/openapi';
import { PrefixTransform } from '@graphql-mesh/transform-prefix';
import { NamingConventionTransform } from '@graphql-mesh/transform-naming-convention';

const PORT = process.env.GATEWAY_PORT || 3000;

async function start() {
  console.log('Starting GraphQL Mesh Federation Gateway with GitHub OpenAPI...');
  
  // Check for GitHub token
  const hasGitHubToken = !!(process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN);
  if (!hasGitHubToken) {
    console.warn('⚠️  No GitHub token found. GitHub API features will be limited.');
    console.warn('   Set GITHUB_TOKEN or VITE_GITHUB_TOKEN environment variable.');
  } else {
    console.log('✓ GitHub token found');
  }

  try {
    // Create mesh instance with programmatic configuration
    const mesh = await getMesh({
      sources: [
        {
          name: 'ClaudeService',
          handler: new GraphQLHandler({
            name: 'ClaudeService',
            config: {
              endpoint: 'http://localhost:3002/graphql',
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
            },
            importFn: defaultImportFn,
            pubsub: new PubSub(),
            logger: new DefaultLogger('RepoAgentService')
          })
        },
        {
          name: 'GitHubAPI',
          handler: new OpenAPIHandler({
            name: 'GitHubAPI',
            config: {
              source: 'https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json',
              endpoint: 'https://api.github.com',
              operationHeaders: {
                Authorization: process.env.GITHUB_TOKEN ? `Bearer ${process.env.GITHUB_TOKEN}` : undefined,
                Accept: 'application/vnd.github.v3+json',
                'X-GitHub-Api-Version': '2022-11-28'
              }
            },
            importFn: defaultImportFn,
            pubsub: new PubSub(),
            logger: new DefaultLogger('GitHubAPI')
          })
        }
      ],
      transforms: [
        new PrefixTransform({
          apiName: 'GitHubAPI',
          config: {
            mode: 'wrap',
            value: 'GitHub_'
          }
        }),
        new NamingConventionTransform({
          apiName: 'GitHubAPI',
          config: {
            mode: 'wrap',
            typeNames: 'pascalCase',
            fieldNames: 'camelCase',
            enumValues: 'upperCase'
          }
        })
      ],
      logger: new DefaultLogger('Gateway'),
    });

    // Create Yoga server with mesh schema
    const yoga = createYoga({
      schema: mesh.schema,
      maskedErrors: false,
      graphiql: {
        title: 'Meta-GOTHIC Federation Gateway',
        defaultQuery: `# Meta-GOTHIC Federation Gateway
# This gateway federates multiple services:
# - Claude Service (AI operations)
# - Repo Agent Service (Git operations) 
# - GitHub REST API (via OpenAPI)

# Example: Get system health
{
  health {
    healthy
    version
    claudeAvailable
  }
}

# Example: List GitHub repositories
# {
#   GitHub_reposListForAuthenticatedUser(perPage: 10, sort: updated) {
#     name
#     full_name
#     description
#     updated_at
#     topics
#   }
# }
`
      },
      context: async ({ request }) => {
        // Add mesh context
        return {
          ...mesh.context,
          request,
        };
      },
    });

    // Create HTTP server
    const server = createServer(yoga);

    server.listen(PORT, () => {
      console.log(`\n🚀 GraphQL Mesh Federation Gateway ready!`);
      console.log(`📍 Endpoint: http://localhost:${PORT}/graphql`);
      console.log(`\n📦 Federated Services:`);
      console.log(`   • Claude Service (http://localhost:3002/graphql)`);
      console.log(`   • Repo Agent Service (http://localhost:3004/graphql)`);
      console.log(`   • GitHub REST API (OpenAPI)`);
      console.log(`\n🔧 Features:`);
      console.log(`   • Unified GraphQL schema`);
      console.log(`   • GitHub API integration via OpenAPI`);
      console.log(`   • GraphiQL playground`);
      console.log(`   • Real-time subscriptions support`);
      
      if (hasGitHubToken) {
        console.log(`\n✅ GitHub API authenticated - full access enabled`);
      } else {
        console.log(`\n⚠️  GitHub API unauthenticated - rate limits apply`);
      }
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n🛑 Shutting down gateway...');
      server.close(() => {
        mesh.destroy();
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('❌ Failed to start gateway:', error);
    process.exit(1);
  }
}

// Start the server
start().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});