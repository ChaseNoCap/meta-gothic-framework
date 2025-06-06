import { Cacheable } from '../../../shared/cache/index.js';
import type { IEventBus } from '@chasenocap/event-system';
import type { ILogger } from '@chasenocap/logger';

interface GitHubUser {
  login: string;
  name?: string;
  avatarUrl?: string;
  bio?: string;
  company?: string;
  location?: string;
  publicRepos?: number;
}

interface GitHubRepository {
  id: string;
  name: string;
  fullName: string;
  description?: string;
  private: boolean;
  fork: boolean;
  createdAt: string;
  updatedAt: string;
  pushedAt?: string;
  homepage?: string;
  size: number;
  stargazersCount: number;
  watchersCount: number;
  language?: string;
  forksCount: number;
  openIssuesCount: number;
  defaultBranch: string;
  topics?: string[];
  owner: GitHubUser;
}

interface GitHubWorkflow {
  id: number;
  name: string;
  path: string;
  state: string;
}

interface GitHubWorkflowRun {
  id: number;
  name?: string;
  headBranch?: string;
  headSha?: string;
  status?: string;
  conclusion?: string;
  workflowId: number;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export class CachedGitHubService {
  private logger?: ILogger;
  private eventBus?: IEventBus;
  private correlationId?: string;

  constructor(
    private token: string | undefined,
    eventBus?: IEventBus,
    logger?: ILogger,
    correlationId?: string
  ) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.correlationId = correlationId;
  }

  private async githubFetch(url: string, options: RequestInit = {}) {
    if (!this.token) {
      throw new Error('GitHub token required');
    }

    const startTime = Date.now();
    
    // Emit start event
    if (this.eventBus) {
      this.eventBus.emit({
        type: 'github.api.started',
        timestamp: Date.now(),
        payload: {
          endpoint: url,
          method: options.method || 'GET',
          correlationId: this.correlationId
        }
      });
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        ...options.headers
      }
    });

    const duration = Date.now() - startTime;
    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');

    // Emit completion event
    if (this.eventBus) {
      this.eventBus.emit({
        type: 'github.api.completed',
        timestamp: Date.now(),
        payload: {
          endpoint: url,
          method: options.method || 'GET',
          statusCode: response.status,
          duration,
          rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : undefined,
          correlationId: this.correlationId
        }
      });
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error: ${response.statusText} - ${error}`);
    }

    return response.json();
  }

  @Cacheable('github.user', { 
    ttlSeconds: 600  // Cache for 10 minutes
  })
  async getUser(): Promise<GitHubUser | null> {
    if (!this.token) return null;
    
    this.logger?.debug('Fetching GitHub user');
    const data = await this.githubFetch('https://api.github.com/user');
    
    return {
      login: data.login,
      name: data.name,
      avatarUrl: data.avatar_url,
      bio: data.bio,
      company: data.company,
      location: data.location,
      publicRepos: data.public_repos
    };
  }

  @Cacheable('github.repositories', { 
    ttlSeconds: 300,  // Cache for 5 minutes
    keyGenerator: (perPage: number, page: number) => `${perPage}:${page}`
  })
  async getRepositories(perPage = 30, page = 1): Promise<GitHubRepository[]> {
    this.logger?.debug('Fetching GitHub repositories', { perPage, page });
    
    const data = await this.githubFetch(
      `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=updated`
    );

    return data.map((repo: any) => ({
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
      topics: repo.topics,
      owner: {
        login: repo.owner.login,
        avatarUrl: repo.owner.avatar_url
      }
    }));
  }

  @Cacheable('github.repository', { 
    ttlSeconds: 300,  // Cache for 5 minutes
    keyGenerator: (owner: string, name: string) => `${owner}/${name}`
  })
  async getRepository(owner: string, name: string): Promise<GitHubRepository | null> {
    this.logger?.debug('Fetching GitHub repository', { owner, name });
    
    try {
      const data = await this.githubFetch(
        `https://api.github.com/repos/${owner}/${name}`
      );

      return {
        id: data.id.toString(),
        name: data.name,
        fullName: data.full_name,
        description: data.description,
        private: data.private,
        fork: data.fork,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        pushedAt: data.pushed_at,
        homepage: data.homepage,
        size: data.size,
        stargazersCount: data.stargazers_count,
        watchersCount: data.watchers_count,
        language: data.language,
        forksCount: data.forks_count,
        openIssuesCount: data.open_issues_count,
        defaultBranch: data.default_branch,
        topics: data.topics,
        owner: {
          login: data.owner.login,
          name: data.owner.name,
          avatarUrl: data.owner.avatar_url
        }
      };
    } catch (error) {
      this.logger?.error('Failed to fetch repository', error as Error);
      return null;
    }
  }

  @Cacheable('github.workflows', { 
    ttlSeconds: 180,  // Cache for 3 minutes
    keyGenerator: (owner: string, repo: string) => `${owner}/${repo}`
  })
  async getWorkflows(owner: string, repo: string): Promise<GitHubWorkflow[]> {
    this.logger?.debug('Fetching GitHub workflows', { owner, repo });
    
    const data = await this.githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows`
    );

    return data.workflows.map((workflow: any) => ({
      id: workflow.id,
      name: workflow.name,
      path: workflow.path,
      state: workflow.state
    }));
  }

  @Cacheable('github.workflowRuns', { 
    ttlSeconds: 60,  // Cache for 1 minute (runs change frequently)
    keyGenerator: (owner: string, repo: string, perPage: number) => `${owner}/${repo}:${perPage}`
  })
  async getWorkflowRuns(owner: string, repo: string, perPage = 10): Promise<GitHubWorkflowRun[]> {
    this.logger?.debug('Fetching GitHub workflow runs', { owner, repo, perPage });
    
    const data = await this.githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=${perPage}`
    );

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
      updatedAt: run.updated_at
    }));
  }
}