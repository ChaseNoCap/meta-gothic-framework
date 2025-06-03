import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { stitchSchemas } from '@graphql-tools/stitch';
import { schemaFromExecutor } from '@graphql-tools/wrap';
import { buildHTTPExecutor } from '@graphql-tools/executor-http';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { RenameTypes } from '@graphql-tools/wrap';

const PORT = process.env.GATEWAY_PORT || 3000;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN;
const ENABLE_CACHE = process.env.ENABLE_CACHE !== 'false'; // Cache enabled by default

async function start() {
  console.log('Starting Meta-GOTHIC GraphQL Gateway...');
  
  if (!GITHUB_TOKEN) {
    console.warn('⚠️  No GitHub token found. GitHub features will have limited rate limits.');
  } else {
    console.log('✓ GitHub token detected');
  }

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
      transforms: [
        // Prefix Claude types to avoid conflicts
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
        // Prefix Repo types to avoid conflicts
        new RenameTypes((name) => {
          if (['Query', 'Mutation', 'Subscription'].includes(name)) return name;
          return `Repo_${name}`;
        }),
      ],
    };

    // Create GitHub schema with essential queries
    const githubTypeDefs = `
      type GitHubUser {
        login: String!
        name: String
        avatarUrl: String
        bio: String
        company: String
        location: String
        publicRepos: Int
      }

      type GitHubRepository {
        id: String!
        name: String!
        fullName: String!
        description: String
        private: Boolean!
        fork: Boolean!
        createdAt: String!
        updatedAt: String!
        pushedAt: String
        homepage: String
        size: Int!
        stargazersCount: Int!
        watchersCount: Int!
        language: String
        forksCount: Int!
        openIssuesCount: Int!
        defaultBranch: String!
        topics: [String!]
        owner: GitHubUser!
      }

      type GitHubWorkflowRun {
        id: Int!
        name: String
        headBranch: String
        headSha: String
        status: String
        conclusion: String
        workflowId: Int!
        url: String!
        createdAt: String!
        updatedAt: String!
      }

      type GitHubWorkflow {
        id: Int!
        name: String!
        path: String!
        state: String!
      }

      type Query {
        githubUser: GitHubUser
        githubRepositories(perPage: Int = 30, page: Int = 1): [GitHubRepository!]!
        githubRepository(owner: String!, name: String!): GitHubRepository
        githubWorkflows(owner: String!, repo: String!): [GitHubWorkflow!]!
        githubWorkflowRuns(owner: String!, repo: String!, perPage: Int = 10): [GitHubWorkflowRun!]!
      }

      type Mutation {
        triggerWorkflow(owner: String!, repo: String!, workflowId: String!, ref: String = "main"): Boolean!
        cancelWorkflowRun(owner: String!, repo: String!, runId: Int!): Boolean!
      }
    `;

    const githubResolvers = {
      Mutation: {
        triggerWorkflow: async (_: any, { owner, repo, workflowId, ref = 'main' }: any) => {
          if (!GITHUB_TOKEN) {
            throw new Error('GitHub token required for triggering workflows');
          }
          
          try {
            const response = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${GITHUB_TOKEN}`,
                  'Accept': 'application/vnd.github.v3+json',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ref }),
              }
            );
            
            if (!response.ok) {
              const error = await response.text();
              throw new Error(`GitHub API error: ${response.statusText} - ${error}`);
            }
            
            return true;
          } catch (error) {
            console.error('Error triggering workflow:', error);
            throw error;
          }
        },
        
        cancelWorkflowRun: async (_: any, { owner, repo, runId }: any) => {
          if (!GITHUB_TOKEN) {
            throw new Error('GitHub token required for cancelling workflow runs');
          }
          
          try {
            const response = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/cancel`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${GITHUB_TOKEN}`,
                  'Accept': 'application/vnd.github.v3+json',
                },
              }
            );
            
            if (!response.ok) {
              const error = await response.text();
              throw new Error(`GitHub API error: ${response.statusText} - ${error}`);
            }
            
            return true;
          } catch (error) {
            console.error('Error cancelling workflow run:', error);
            throw error;
          }
        },
      },
      Query: {
        githubUser: async () => {
          if (!GITHUB_TOKEN) {
            throw new Error('GitHub token required for user query');
          }
          const response = await fetch('https://api.github.com/user', {
            headers: {
              'Authorization': `Bearer ${GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3+json',
            },
          });
          if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
          }
          const data = await response.json();
          return {
            login: data.login,
            name: data.name,
            avatarUrl: data.avatar_url,
            bio: data.bio,
            company: data.company,
            location: data.location,
            publicRepos: data.public_repos,
          };
        },
        
        githubRepositories: async (_: any, { perPage = 30, page = 1 }: any) => {
          if (!GITHUB_TOKEN) {
            throw new Error('GitHub token required for repositories query');
          }
          const response = await fetch(
            `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=updated`,
            {
              headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
              },
            }
          );
          if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
          }
          const repos = await response.json();
          return repos.map((repo: any) => ({
            id: repo.id.toString(),
            name: repo.name,
            fullName: repo.full_name,
            description: repo.description,
            private: repo.private,
            fork: repo.fork,
            createdAt: repo.created_at,
            updatedAt: repo.updated_at,
            pushedAt: repo.pushed_at,
            homepage: repo.homepage,
            size: repo.size,
            stargazersCount: repo.stargazers_count,
            watchersCount: repo.watchers_count,
            language: repo.language,
            forksCount: repo.forks_count,
            openIssuesCount: repo.open_issues_count,
            defaultBranch: repo.default_branch,
            topics: repo.topics || [],
            owner: {
              login: repo.owner.login,
              avatarUrl: repo.owner.avatar_url,
            },
          }));
        },

        githubRepository: async (_: any, { owner, name }: any) => {
          if (!GITHUB_TOKEN) {
            throw new Error('GitHub token required for repository query');
          }
          const response = await fetch(
            `https://api.github.com/repos/${owner}/${name}`,
            {
              headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
              },
            }
          );
          if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
          }
          const repo = await response.json();
          return {
            id: repo.id.toString(),
            name: repo.name,
            fullName: repo.full_name,
            description: repo.description,
            private: repo.private,
            fork: repo.fork,
            createdAt: repo.created_at,
            updatedAt: repo.updated_at,
            pushedAt: repo.pushed_at,
            homepage: repo.homepage,
            size: repo.size,
            stargazersCount: repo.stargazers_count,
            watchersCount: repo.watchers_count,
            language: repo.language,
            forksCount: repo.forks_count,
            openIssuesCount: repo.open_issues_count,
            defaultBranch: repo.default_branch,
            topics: repo.topics || [],
            owner: {
              login: repo.owner.login,
              avatarUrl: repo.owner.avatar_url,
            },
          };
        },

        githubWorkflows: async (_: any, { owner, repo }: any) => {
          if (!GITHUB_TOKEN) {
            throw new Error('GitHub token required for workflows query');
          }
          const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/actions/workflows`,
            {
              headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
              },
            }
          );
          if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
          }
          const data = await response.json();
          return data.workflows.map((workflow: any) => ({
            id: workflow.id,
            name: workflow.name,
            path: workflow.path,
            state: workflow.state,
          }));
        },

        githubWorkflowRuns: async (_: any, { owner, repo, perPage = 10 }: any) => {
          if (!GITHUB_TOKEN) {
            throw new Error('GitHub token required for workflow runs query');
          }
          const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=${perPage}`,
            {
              headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
              },
            }
          );
          if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
          }
          const data = await response.json();
          return data.workflow_runs.map((run: any) => ({
            id: run.id,
            name: run.name,
            headBranch: run.head_branch,
            headSha: run.head_sha,
            status: run.status,
            conclusion: run.conclusion,
            workflowId: run.workflow_id,
            url: run.html_url,
            createdAt: run.created_at,
            updatedAt: run.updated_at,
          }));
        },
      },
    };

    const githubSchema = makeExecutableSchema({
      typeDefs: githubTypeDefs,
      resolvers: githubResolvers,
    });

    // Stitch all schemas together
    const gatewaySchema = stitchSchemas({
      subschemas: [
        claudeSubschema, 
        repoAgentSubschema,
        { schema: githubSchema }
      ],
    });

    // Prepare plugins
    const plugins: any[] = [];

    // Add caching if enabled
    if (ENABLE_CACHE) {
      try {
        const { useResponseCache } = await import('@graphql-yoga/plugin-response-cache');
        plugins.push(
          useResponseCache({
            session: () => null,
            ttl: 5000, // 5 seconds default
            ttlPerType: {
              // Claude types
              Claude_Health: 5000,
              Claude_Session: 60000,
              Claude_AgentRun: 30000,
              
              // Repo types
              Repo_GitStatus: 30000,
              Repo_Repository: 60000,
              Repo_Commit: 300000,
              
              // GitHub types
              GitHubUser: 300000, // 5 minutes
              GitHubRepository: 60000, // 1 minute
              GitHubWorkflowRun: 10000, // 10 seconds
            },
          })
        );
        console.log('✓ Response caching enabled');
      } catch (error) {
        console.warn('⚠️  Could not enable response caching:', error);
      }
    }

    // Create Yoga server
    const yoga = createYoga({
      schema: gatewaySchema,
      maskedErrors: false,
      graphiql: true,
      plugins,
    });

    // Create HTTP server
    const server = createServer(yoga);

    server.listen(PORT, () => {
      console.log(`\n🌐 Meta-GOTHIC GraphQL Gateway ready!`);
      console.log(`📍 GraphQL Endpoint: http://localhost:${PORT}/graphql`);
      console.log(`\n📦 Connected services:`);
      console.log(`   • Claude Service: http://localhost:3002/graphql`);
      console.log(`   • Repo Agent Service: http://localhost:3004/graphql`);
      console.log(`   • GitHub API: Direct integration`);
      if (GITHUB_TOKEN) {
        console.log(`\n✅ GitHub authenticated - full API access`);
      }
      if (ENABLE_CACHE) {
        console.log(`\n⚡ Response caching enabled for better performance`);
      }
      console.log(`\n🔍 Try these queries:`);
      console.log(`   - health { healthy version }`);
      console.log(`   - githubUser { login name }`);
      console.log(`   - githubRepositories { name description stargazersCount }`);
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