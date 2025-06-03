import { GraphQLContext } from '@meta-gothic/shared-types';

type GitHubResolverContext = GraphQLContext;

export function createGitHubResolvers(GITHUB_TOKEN: string | undefined) {
  return {
    Mutation: {
      triggerWorkflow: async (_: any, { owner, repo, workflowId, ref = 'main' }: any, context: GitHubResolverContext) => {
        const { eventBus, correlationId, logger } = context;
        
        if (!GITHUB_TOKEN) {
          throw new Error('GitHub token required for triggering workflows');
        }
        
        try {
          const startTime = Date.now();
          
          // Emit GitHub API start event
          eventBus.emit({
            type: 'github.api.started',
            timestamp: Date.now(),
            payload: {
              endpoint: `/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
              method: 'POST',
              correlationId
            }
          });
          
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
          
          const duration = Date.now() - startTime;
          const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
          
          // Emit GitHub API completion event
          eventBus.emit({
            type: 'github.api.completed',
            timestamp: Date.now(),
            payload: {
              endpoint: `/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
              method: 'POST',
              statusCode: response.status,
              duration,
              rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : undefined,
              correlationId
            }
          });
          
          if (!response.ok) {
            const error = await response.text();
            throw new Error(`GitHub API error: ${response.statusText} - ${error}`);
          }
          
          // Emit workflow triggered event
          eventBus.emit({
            type: 'github.workflow.triggered',
            timestamp: Date.now(),
            payload: {
              owner,
              repo,
              workflowId,
              ref,
              correlationId
            }
          });
          
          return true;
        } catch (error) {
          logger.error('Error triggering workflow', error as Error);
          throw error;
        }
      },
      
      cancelWorkflowRun: async (_: any, { owner, repo, runId }: any, context: GitHubResolverContext) => {
        const { eventBus, correlationId, logger } = context;
        
        if (!GITHUB_TOKEN) {
          throw new Error('GitHub token required for cancelling workflow runs');
        }
        
        try {
          const startTime = Date.now();
          
          eventBus.emit({
            type: 'github.api.started',
            timestamp: Date.now(),
            payload: {
              endpoint: `/repos/${owner}/${repo}/actions/runs/${runId}/cancel`,
              method: 'POST',
              correlationId
            }
          });
          
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
          
          const duration = Date.now() - startTime;
          const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
          
          eventBus.emit({
            type: 'github.api.completed',
            timestamp: Date.now(),
            payload: {
              endpoint: `/repos/${owner}/${repo}/actions/runs/${runId}/cancel`,
              method: 'POST',
              statusCode: response.status,
              duration,
              rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : undefined,
              correlationId
            }
          });
          
          if (!response.ok) {
            const error = await response.text();
            throw new Error(`GitHub API error: ${response.statusText} - ${error}`);
          }
          
          return true;
        } catch (error) {
          logger.error('Error cancelling workflow run', error as Error);
          throw error;
        }
      },
    },
    Query: {
      githubUser: async (_: any, _args: any, context: GitHubResolverContext) => {
        const { eventBus, correlationId } = context;
        
        if (!GITHUB_TOKEN) {
          throw new Error('GitHub token required for user query');
        }
        
        const startTime = Date.now();
        
        eventBus.emit({
          type: 'github.api.started',
          timestamp: Date.now(),
          payload: {
            endpoint: '/user',
            method: 'GET',
            correlationId
          }
        });
        
        const response = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        });
        
        const duration = Date.now() - startTime;
        const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
        
        eventBus.emit({
          type: 'github.api.completed',
          timestamp: Date.now(),
          payload: {
            endpoint: '/user',
            method: 'GET',
            statusCode: response.status,
            duration,
            rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : undefined,
            correlationId
          }
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
      
      githubRepositories: async (_: any, { perPage = 30, page = 1 }: any, context: GitHubResolverContext) => {
        const { eventBus, correlationId } = context;
        
        if (!GITHUB_TOKEN) {
          throw new Error('GitHub token required for repositories query');
        }
        
        const startTime = Date.now();
        const endpoint = `/user/repos?per_page=${perPage}&page=${page}&sort=updated`;
        
        eventBus.emit({
          type: 'github.api.started',
          timestamp: Date.now(),
          payload: {
            endpoint,
            method: 'GET',
            correlationId
          }
        });
        
        const response = await fetch(
          `https://api.github.com${endpoint}`,
          {
            headers: {
              'Authorization': `Bearer ${GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3+json',
            },
          }
        );
        
        const duration = Date.now() - startTime;
        const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
        
        eventBus.emit({
          type: 'github.api.completed',
          timestamp: Date.now(),
          payload: {
            endpoint,
            method: 'GET',
            statusCode: response.status,
            duration,
            rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : undefined,
            correlationId
          }
        });
        
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

      githubRepository: async (_: any, { owner, name }: any, context: GitHubResolverContext) => {
        const { eventBus, correlationId } = context;
        
        if (!GITHUB_TOKEN) {
          throw new Error('GitHub token required for repository query');
        }
        
        const startTime = Date.now();
        const endpoint = `/repos/${owner}/${name}`;
        
        eventBus.emit({
          type: 'github.api.started',
          timestamp: Date.now(),
          payload: {
            endpoint,
            method: 'GET',
            correlationId
          }
        });
        
        const response = await fetch(
          `https://api.github.com${endpoint}`,
          {
            headers: {
              'Authorization': `Bearer ${GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3+json',
            },
          }
        );
        
        const duration = Date.now() - startTime;
        const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
        
        eventBus.emit({
          type: 'github.api.completed',
          timestamp: Date.now(),
          payload: {
            endpoint,
            method: 'GET',
            statusCode: response.status,
            duration,
            rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : undefined,
            correlationId
          }
        });
        
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

      githubWorkflows: async (_: any, { owner, repo }: any, context: GitHubResolverContext) => {
        const { eventBus, correlationId } = context;
        
        if (!GITHUB_TOKEN) {
          throw new Error('GitHub token required for workflows query');
        }
        
        const startTime = Date.now();
        const endpoint = `/repos/${owner}/${repo}/actions/workflows`;
        
        eventBus.emit({
          type: 'github.api.started',
          timestamp: Date.now(),
          payload: {
            endpoint,
            method: 'GET',
            correlationId
          }
        });
        
        const response = await fetch(
          `https://api.github.com${endpoint}`,
          {
            headers: {
              'Authorization': `Bearer ${GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3+json',
            },
          }
        );
        
        const duration = Date.now() - startTime;
        const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
        
        eventBus.emit({
          type: 'github.api.completed',
          timestamp: Date.now(),
          payload: {
            endpoint,
            method: 'GET',
            statusCode: response.status,
            duration,
            rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : undefined,
            correlationId
          }
        });
        
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

      githubWorkflowRuns: async (_: any, { owner, repo, perPage = 10 }: any, context: GitHubResolverContext) => {
        const { eventBus, correlationId } = context;
        
        if (!GITHUB_TOKEN) {
          throw new Error('GitHub token required for workflow runs query');
        }
        
        const startTime = Date.now();
        const endpoint = `/repos/${owner}/${repo}/actions/runs?per_page=${perPage}`;
        
        eventBus.emit({
          type: 'github.api.started',
          timestamp: Date.now(),
          payload: {
            endpoint,
            method: 'GET',
            correlationId
          }
        });
        
        const response = await fetch(
          `https://api.github.com${endpoint}`,
          {
            headers: {
              'Authorization': `Bearer ${GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3+json',
            },
          }
        );
        
        const duration = Date.now() - startTime;
        const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
        
        eventBus.emit({
          type: 'github.api.completed',
          timestamp: Date.now(),
          payload: {
            endpoint,
            method: 'GET',
            statusCode: response.status,
            duration,
            rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : undefined,
            correlationId
          }
        });
        
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
}