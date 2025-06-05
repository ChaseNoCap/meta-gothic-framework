import { GraphQLContext } from '@meta-gothic/shared-types';
import { CachedGitHubService } from './services/CachedGitHubService.js';

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
        const { eventBus, correlationId, logger } = context;
        
        const githubService = new CachedGitHubService(
          GITHUB_TOKEN,
          eventBus,
          logger,
          correlationId
        );
        
        return githubService.getUser();
      },
      
      githubRepositories: async (_: any, { perPage = 30, page = 1 }: any, context: GitHubResolverContext) => {
        const { eventBus, correlationId, logger } = context;
        
        const githubService = new CachedGitHubService(
          GITHUB_TOKEN,
          eventBus,
          logger,
          correlationId
        );
        
        return githubService.getRepositories(perPage, page);
      },
      
      githubRepository: async (_: any, { owner, name }: any, context: GitHubResolverContext) => {
        const { eventBus, correlationId, logger } = context;
        
        const githubService = new CachedGitHubService(
          GITHUB_TOKEN,
          eventBus,
          logger,
          correlationId
        );
        
        return githubService.getRepository(owner, name);
      },
      
      githubWorkflows: async (_: any, { owner, repo }: any, context: GitHubResolverContext) => {
        const { eventBus, correlationId, logger } = context;
        
        const githubService = new CachedGitHubService(
          GITHUB_TOKEN,
          eventBus,
          logger,
          correlationId
        );
        
        return githubService.getWorkflows(owner, repo);
      },
      
      githubWorkflowRuns: async (_: any, { owner, repo, perPage = 10 }: any, context: GitHubResolverContext) => {
        const { eventBus, correlationId, logger } = context;
        
        const githubService = new CachedGitHubService(
          GITHUB_TOKEN,
          eventBus,
          logger,
          correlationId
        );
        
        return githubService.getWorkflowRuns(owner, repo, perPage);
      },
    },
  };
}