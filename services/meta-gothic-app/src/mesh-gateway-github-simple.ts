#!/usr/bin/env node

import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { stitchSchemas } from '@graphql-tools/stitch';
import { schemaFromExecutor } from '@graphql-tools/wrap';
import { buildHTTPExecutor } from '@graphql-tools/executor-http';
import { RenameTypes, RenameRootFields } from '@graphql-tools/wrap';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { fetch } from '@whatwg-node/fetch';

const PORT = process.env.GATEWAY_PORT || 3000;
const GITHUB_TOKEN = process.env.VITE_GITHUB_TOKEN || process.env.GITHUB_TOKEN;

// Simple GitHub REST wrapper as GraphQL
const githubTypeDefs = `
  type GitHubRepository {
    id: Int!
    name: String!
    full_name: String!
    description: String
    private: Boolean!
    fork: Boolean!
    created_at: String!
    updated_at: String!
    pushed_at: String!
    homepage: String
    size: Int!
    stargazers_count: Int!
    watchers_count: Int!
    language: String
    has_issues: Boolean!
    has_projects: Boolean!
    has_downloads: Boolean!
    has_wiki: Boolean!
    has_pages: Boolean!
    forks_count: Int!
    open_issues_count: Int!
    default_branch: String!
    owner: GitHubOwner!
  }

  type GitHubOwner {
    login: String!
    id: Int!
    avatar_url: String!
    type: String!
  }

  type GitHubWorkflowRun {
    id: Int!
    name: String!
    status: String!
    conclusion: String
    workflow_id: Int!
    created_at: String!
    updated_at: String!
    html_url: String!
  }

  type GitHubWorkflowRuns {
    total_count: Int!
    workflow_runs: [GitHubWorkflowRun!]!
  }

  type Query {
    """Get repositories for the authenticated user or specified owner"""
    githubRepositories(owner: String): [GitHubRepository!]!
    
    """Get a specific repository"""
    githubRepository(owner: String!, repo: String!): GitHubRepository
    
    """Get workflow runs for a repository"""
    githubWorkflowRuns(owner: String!, repo: String!, limit: Int = 10): GitHubWorkflowRuns!
  }
`;

const githubResolvers = {
  Query: {
    githubRepositories: async (_: any, { owner }: { owner?: string }) => {
      if (!GITHUB_TOKEN) {
        console.warn('No GitHub token available');
        return [];
      }

      const url = owner 
        ? `https://api.github.com/users/${owner}/repos`
        : 'https://api.github.com/user/repos';

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        console.error('GitHub API error:', response.status, response.statusText);
        return [];
      }

      return response.json();
    },

    githubRepository: async (_: any, { owner, repo }: { owner: string; repo: string }) => {
      if (!GITHUB_TOKEN) {
        console.warn('No GitHub token available');
        return null;
      }

      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        console.error('GitHub API error:', response.status, response.statusText);
        return null;
      }

      return response.json();
    },

    githubWorkflowRuns: async (_: any, { owner, repo, limit = 10 }: { owner: string; repo: string; limit?: number }) => {
      if (!GITHUB_TOKEN) {
        console.warn('No GitHub token available');
        return { total_count: 0, workflow_runs: [] };
      }

      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!response.ok) {
        console.error('GitHub API error:', response.status, response.statusText);
        return { total_count: 0, workflow_runs: [] };
      }

      return response.json();
    }
  }
};

async function start() {
  console.log('Starting GraphQL Mesh Gateway with GitHub Integration...');
  
  if (!GITHUB_TOKEN) {
    console.warn('⚠️  No GitHub token found. GitHub API features will be limited.');
  }

  try {
    // Create executors for each service
    const claudeExecutor = buildHTTPExecutor({
      endpoint: 'http://127.0.0.1:3002/graphql',
      headers: {
        'x-gateway': 'mesh-github'
      }
    });

    const repoAgentExecutor = buildHTTPExecutor({
      endpoint: 'http://127.0.0.1:3004/graphql',
      headers: {
        'x-gateway': 'mesh-github'
      }
    });

    // Build subschemas
    const claudeSubschema = {
      schema: await schemaFromExecutor(claudeExecutor),
      executor: claudeExecutor,
      transforms: [
        new RenameTypes((name) => {
          if (['Query', 'Mutation', 'Subscription'].includes(name)) return name;
          return `Claude_${name}`;
        }),
      ],
    };

    const repoAgentSubschema = {
      schema: await schemaFromExecutor(repoAgentExecutor),
      executor: repoAgentExecutor,
      transforms: [
        new RenameTypes((name) => {
          if (['Query', 'Mutation', 'Subscription'].includes(name)) return name;
          return `Repo_${name}`;
        }),
      ],
    };

    // Create GitHub schema
    const githubSchema = makeExecutableSchema({
      typeDefs: githubTypeDefs,
      resolvers: githubResolvers
    });

    // Stitch all schemas together
    const gatewaySchema = stitchSchemas({
      subschemas: [claudeSubschema, repoAgentSubschema, { schema: githubSchema }],
      typeDefs: `
        extend type Query {
          """Get repository with GitHub data"""
          repositoryWithGitHub(path: String!): RepositoryWithGitHub
          
          """Get all repositories with their GitHub status"""
          allRepositoriesWithGitHub: [RepositoryWithGitHub!]!
        }
        
        type RepositoryWithGitHub {
          """Local repository data"""
          local: Repo_RepositoryDetails
          
          """GitHub repository data"""
          github: GitHubRepository
          
          """Workflow status"""
          workflows: GitHubWorkflowRuns
          
          """Combined health status"""
          healthStatus: String!
        }
      `,
      resolvers: {
        Query: {
          repositoryWithGitHub: async (root, { path }, context, info) => {
            // Get local data
            const localData = await context.RepoAgentService.Query.repositoryDetails({
              root,
              args: { path },
              context,
              info
            });

            if (!localData) return null;

            // Extract owner and repo name
            const repoName = localData.name;
            const owner = process.env.GITHUB_OWNER || 'ChaseNoCap';

            // Get GitHub data
            let githubData = null;
            let workflowData = null;

            if (GITHUB_TOKEN) {
              try {
                githubData = await githubResolvers.Query.githubRepository(
                  root, 
                  { owner, repo: repoName }, 
                  context, 
                  info
                );

                workflowData = await githubResolvers.Query.githubWorkflowRuns(
                  root,
                  { owner, repo: repoName, limit: 5 },
                  context,
                  info
                );
              } catch (err) {
                console.warn('Failed to fetch GitHub data:', err);
              }
            }

            // Determine health status
            let healthStatus = 'unknown';
            if (localData.status?.isDirty) {
              healthStatus = 'has-changes';
            } else if (workflowData?.workflow_runs?.[0]?.conclusion === 'failure') {
              healthStatus = 'ci-failing';
            } else if (workflowData?.workflow_runs?.[0]?.conclusion === 'success') {
              healthStatus = 'healthy';
            }

            return {
              local: localData,
              github: githubData,
              workflows: workflowData,
              healthStatus
            };
          },

          allRepositoriesWithGitHub: async (root, args, context, info) => {
            // Get all local repositories
            const localRepos = await context.RepoAgentService.Query.scanAllRepositories({
              root,
              args: {},
              context,
              info
            });

            if (!localRepos || localRepos.length === 0) return [];

            // Fetch GitHub data for each repository
            const results = await Promise.all(
              localRepos.map(async (repo: any) => {
                const owner = process.env.GITHUB_OWNER || 'ChaseNoCap';
                let githubData = null;
                let workflowData = null;

                if (GITHUB_TOKEN) {
                  try {
                    githubData = await githubResolvers.Query.githubRepository(
                      root,
                      { owner, repo: repo.name },
                      context,
                      info
                    );

                    workflowData = await githubResolvers.Query.githubWorkflowRuns(
                      root,
                      { owner, repo: repo.name, limit: 1 },
                      context,
                      info
                    );
                  } catch (err) {
                    console.warn(`Failed to fetch GitHub data for ${repo.name}:`, err);
                  }
                }

                let healthStatus = 'unknown';
                if (repo.uncommittedCount > 0) {
                  healthStatus = 'has-changes';
                } else if (workflowData?.workflow_runs?.[0]?.conclusion === 'failure') {
                  healthStatus = 'ci-failing';
                } else if (workflowData?.workflow_runs?.[0]?.conclusion === 'success') {
                  healthStatus = 'healthy';
                }

                return {
                  local: repo,
                  github: githubData,
                  workflows: workflowData,
                  healthStatus
                };
              })
            );

            return results;
          }
        }
      }
    });

    // Create Yoga server
    const yoga = createYoga({
      schema: gatewaySchema,
      maskedErrors: false,
      graphiql: {
        title: 'MetaGOTHIC Gateway with GitHub',
        defaultQuery: `# Get all repositories with GitHub data
query GetAllReposWithGitHub {
  allRepositoriesWithGitHub {
    local {
      name
      path
      uncommittedCount
    }
    github {
      full_name
      stargazers_count
      open_issues_count
      updated_at
    }
    workflows {
      total_count
      workflow_runs {
        name
        status
        conclusion
      }
    }
    healthStatus
  }
}

# Get specific repository
query GetRepoWithGitHub {
  repositoryWithGitHub(path: "/path/to/repo") {
    local {
      name
      status {
        branch
        isDirty
      }
    }
    github {
      full_name
      description
      stargazers_count
    }
    healthStatus
  }
}`
      },
      context: async (initialContext) => {
        return {
          ...initialContext,
          RepoAgentService: {
            Query: {
              repositoryDetails: async ({ args }: any) => {
                const result = await repoAgentExecutor({
                  document: {
                    kind: 'Document',
                    definitions: [{
                      kind: 'OperationDefinition',
                      operation: 'query',
                      selectionSet: {
                        kind: 'SelectionSet',
                        selections: [{
                          kind: 'Field',
                          name: { kind: 'Name', value: 'repositoryDetails' },
                          arguments: [{
                            kind: 'Argument',
                            name: { kind: 'Name', value: 'path' },
                            value: { kind: 'StringValue', value: args.path }
                          }],
                          selectionSet: {
                            kind: 'SelectionSet',
                            selections: [
                              { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                              { kind: 'Field', name: { kind: 'Name', value: 'path' } },
                              { 
                                kind: 'Field', 
                                name: { kind: 'Name', value: 'status' },
                                selectionSet: {
                                  kind: 'SelectionSet',
                                  selections: [
                                    { kind: 'Field', name: { kind: 'Name', value: 'branch' } },
                                    { kind: 'Field', name: { kind: 'Name', value: 'isDirty' } }
                                  ]
                                }
                              }
                            ]
                          }
                        }]
                      }
                    }]
                  }
                });
                return result.data?.repositoryDetails;
              },
              scanAllRepositories: async () => {
                const result = await repoAgentExecutor({
                  document: {
                    kind: 'Document',
                    definitions: [{
                      kind: 'OperationDefinition',
                      operation: 'query',
                      selectionSet: {
                        kind: 'SelectionSet',
                        selections: [{
                          kind: 'Field',
                          name: { kind: 'Name', value: 'scanAllRepositories' },
                          selectionSet: {
                            kind: 'SelectionSet',
                            selections: [
                              { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                              { kind: 'Field', name: { kind: 'Name', value: 'path' } },
                              { kind: 'Field', name: { kind: 'Name', value: 'uncommittedCount' } }
                            ]
                          }
                        }]
                      }
                    }]
                  }
                });
                return result.data?.scanAllRepositories || [];
              }
            }
          }
        };
      }
    });

    // Create and start HTTP server
    const server = createServer(yoga);
    
    server.listen(PORT, () => {
      console.log(`🌐 GraphQL Gateway with GitHub ready at http://localhost:${PORT}/graphql`);
      console.log(`   - Claude Service: http://localhost:3002/graphql`);
      console.log(`   - Repo Agent Service: http://localhost:3004/graphql`);
      console.log(`   - GitHub API: ${GITHUB_TOKEN ? 'Connected ✓' : 'Not configured ⚠️'}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start gateway:', error);
    process.exit(1);
  }
}

start().catch(console.error);