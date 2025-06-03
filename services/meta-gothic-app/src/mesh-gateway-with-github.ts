#!/usr/bin/env node

import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { getMesh } from '@graphql-mesh/runtime';
import { defaultImportFn, DefaultLogger, PubSub } from '@graphql-mesh/utils';
import GraphQLHandler from '@graphql-mesh/graphql';
import OpenAPIHandler from '@graphql-mesh/openapi';
import { PrefixTransform } from '@graphql-mesh/transform-prefix';
import { RenameTransform } from '@graphql-mesh/transform-rename';
import { FilterTransform } from '@graphql-mesh/transform-filter-schema';

const PORT = process.env.GATEWAY_PORT || 3000;
const GITHUB_TOKEN = process.env.VITE_GITHUB_TOKEN || process.env.GITHUB_TOKEN;

async function start() {
  console.log('Starting GraphQL Mesh Gateway with GitHub Integration...');
  
  if (!GITHUB_TOKEN) {
    console.warn('⚠️  No GitHub token found. GitHub API features will be limited.');
  }

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
        },
        {
          name: 'GitHubAPI',
          handler: new OpenAPIHandler({
            name: 'GitHubAPI',
            config: {
              source: 'https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json',
              endpoint: 'https://api.github.com',
              operationHeaders: {
                Authorization: GITHUB_TOKEN ? `Bearer ${GITHUB_TOKEN}` : undefined,
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
        // Prefix GitHub types to avoid conflicts
        {
          name: 'prefix',
          config: {
            mode: 'wrap',
            applyTo: {
              sources: ['GitHubAPI']
            },
            value: 'GitHub_'
          }
        },
        // Filter out unnecessary GitHub operations to reduce schema size
        {
          name: 'filterSchema',
          config: {
            mode: 'wrap',
            applyTo: {
              sources: ['GitHubAPI']
            },
            filters: [
              // Keep only the operations we need
              'Query.GitHub_repos_*',
              'Query.GitHub_users_*',
              'Query.GitHub_orgs_*',
              'Query.GitHub_actions_*',
              'GitHub_Repository',
              'GitHub_Workflow*',
              'GitHub_Actor',
              'GitHub_Commit*',
              'GitHub_Pull*',
              'GitHub_Issue*'
            ]
          }
        },
        // Add federation support
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
      additionalResolvers: [
        {
          targetTypeName: 'Query',
          targetFieldName: 'githubRepositories',
          sourceName: 'GitHubAPI',
          sourceTypeName: 'Query',
          sourceFieldName: 'GitHub_users_repos',
          sourceArgs: {
            username: '{args.owner}'
          },
          result: 'data'
        },
        {
          targetTypeName: 'Query',
          targetFieldName: 'githubWorkflows',
          sourceName: 'GitHubAPI',
          sourceTypeName: 'Query',
          sourceFieldName: 'GitHub_actions_list_workflow_runs_for_repo',
          sourceArgs: {
            owner: '{args.owner}',
            repo: '{args.repo}'
          },
          result: 'workflow_runs'
        }
      ],
      additionalTypeDefs: `
        extend type Query {
          """Get GitHub repositories for a user or organization"""
          githubRepositories(owner: String!): [GitHub_Repository!]
          
          """Get workflow runs for a repository"""
          githubWorkflows(owner: String!, repo: String!): [GitHub_WorkflowRun!]
          
          """Combined repository data from local and GitHub"""
          enrichedRepository(path: String!): EnrichedRepository
        }
        
        type EnrichedRepository {
          """Local repository data"""
          local: Repo_RepositoryDetails
          
          """GitHub repository data"""
          github: GitHub_Repository
          
          """Combined health metrics"""
          health: RepositoryHealth
        }
        
        type RepositoryHealth {
          """Has uncommitted changes"""
          hasChanges: Boolean!
          
          """Number of open pull requests"""
          openPullRequests: Int
          
          """Number of open issues"""
          openIssues: Int
          
          """Latest workflow run status"""
          ciStatus: String
          
          """Days since last commit"""
          daysSinceLastCommit: Int
        }
      `,
      resolvers: {
        Query: {
          enrichedRepository: async (root, args, context, info) => {
            // Get local repository data
            const localData = await context.RepoAgentService.Query.repositoryDetails({
              root,
              args,
              context,
              info
            });
            
            if (!localData) return null;
            
            // Extract owner and repo from path
            const pathParts = localData.name.split('/');
            const repoName = pathParts[pathParts.length - 1];
            const owner = process.env.GITHUB_OWNER || 'ChaseNoCap';
            
            // Get GitHub data
            let githubData = null;
            if (GITHUB_TOKEN) {
              try {
                githubData = await context.GitHubAPI.Query.GitHub_repos_get({
                  root,
                  args: { owner, repo: repoName },
                  context,
                  info
                });
              } catch (err) {
                console.warn('Failed to fetch GitHub data:', err);
              }
            }
            
            // Calculate health metrics
            const health = {
              hasChanges: localData.status?.isDirty || false,
              openPullRequests: githubData?.open_issues_count || 0,
              openIssues: githubData?.open_issues_count || 0,
              ciStatus: 'unknown',
              daysSinceLastCommit: 0
            };
            
            return {
              local: localData,
              github: githubData,
              health
            };
          }
        }
      },
      cache: {
        // Cache GitHub responses for 5 minutes
        ttl: 300000,
        // Cache based on query and variables
        idFields: ['id', 'node_id']
      },
      pubsub: new PubSub(),
      logger: new DefaultLogger('Mesh'),
      importFn: defaultImportFn
    });

    // Create Yoga server with Mesh
    const yoga = createYoga({
      schema: mesh.schema,
      maskedErrors: false,
      graphiql: {
        title: 'MetaGOTHIC GraphQL Gateway with GitHub',
        defaultQuery: `# Test enriched repository query
query GetEnrichedRepository {
  enrichedRepository(path: "/path/to/repo") {
    local {
      name
      path
      status {
        branch
        isDirty
      }
    }
    github {
      full_name
      stargazers_count
      open_issues_count
    }
    health {
      hasChanges
      openPullRequests
      ciStatus
    }
  }
}`
      },
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
      console.log(`🌐 GraphQL Mesh Gateway with GitHub ready at http://localhost:${PORT}/graphql`);
      console.log(`   - Claude Service: http://localhost:3002/graphql`);
      console.log(`   - Repo Agent Service: http://localhost:3004/graphql`);
      console.log(`   - GitHub API: Integrated via OpenAPI`);
      console.log(`   - GitHub Token: ${GITHUB_TOKEN ? 'Configured ✓' : 'Not configured ⚠️'}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        mesh.destroy();
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start mesh gateway:', error);
    process.exit(1);
  }
}

start().catch(console.error);