import simpleGit, { SimpleGit, StatusResult } from 'simple-git';
import { join } from 'path';
import { Emits, Traces, setEventBus, IEventBus } from '@chasenocap/event-system';
import type { ILogger } from '@chasenocap/logger';

export class GitServiceWithEvents {
  private git: SimpleGit;
  private logger?: ILogger;
  private correlationId?: string;

  constructor(
    private workspaceRoot: string,
    eventBus?: IEventBus,
    logger?: ILogger,
    correlationId?: string
  ) {
    this.git = simpleGit(workspaceRoot);
    this.logger = logger;
    this.correlationId = correlationId;

    // Set event bus for decorators
    if (eventBus) {
      setEventBus(this, eventBus);
    }
  }

  @Emits('repo.status.queried', {
    payloadMapper: (path: string) => ({ path, timestamp: Date.now() })
  })
  @Traces({ threshold: 100 })
  async getStatus(path: string = '.'): Promise<StatusResult> {
    const statusLogger = this.logger?.child({ operation: 'getStatus', path });
    statusLogger?.debug('Getting git status');

    try {
      const fullPath = join(this.workspaceRoot, path);
      const git = simpleGit(fullPath);
      const status = await git.status();

      statusLogger?.info('Git status retrieved', {
        fileCount: status.files.length,
        branch: status.current,
        ahead: status.ahead,
        behind: status.behind
      });

      return status;
    } catch (error) {
      statusLogger?.error('Failed to get git status', error as Error);
      throw error;
    }
  }

  @Emits('repo.commit.created', {
    payloadMapper: (path: string, message: string, files?: string[]) => ({
      path,
      message: message.substring(0, 100),
      fileCount: files?.length || 0,
      timestamp: Date.now()
    })
  })
  @Traces({ threshold: 500 })
  async commit(
    path: string,
    message: string,
    files?: string[]
  ): Promise<{ commitHash: string }> {
    const commitLogger = this.logger?.child({ 
      operation: 'commit', 
      path,
      fileCount: files?.length 
    });

    commitLogger?.info('Creating commit', { 
      messagePreview: message.substring(0, 50) 
    });

    try {
      const fullPath = join(this.workspaceRoot, path);
      const git = simpleGit(fullPath);

      // Stage files if specified
      if (files && files.length > 0) {
        await git.add(files);
      }

      // Create commit
      const result = await git.commit(message);
      const commitHash = result.commit || '';

      commitLogger?.info('Commit created successfully', { 
        commitHash,
        filesChanged: result.summary.changes,
        insertions: result.summary.insertions,
        deletions: result.summary.deletions
      });

      return { commitHash };
    } catch (error) {
      commitLogger?.error('Failed to create commit', error as Error);
      throw error;
    }
  }

  @Emits('repo.push.completed', {
    payloadMapper: (path: string, remote: string, branch: string) => ({
      path,
      remote,
      branch,
      timestamp: Date.now()
    })
  })
  @Traces({ threshold: 2000 })
  async push(
    path: string,
    remote: string = 'origin',
    branch?: string
  ): Promise<void> {
    const pushLogger = this.logger?.child({ 
      operation: 'push', 
      path,
      remote,
      branch 
    });

    pushLogger?.info('Pushing changes');

    try {
      const fullPath = join(this.workspaceRoot, path);
      const git = simpleGit(fullPath);

      if (branch) {
        await git.push(remote, branch);
      } else {
        await git.push(remote);
      }

      pushLogger?.info('Push completed successfully');
    } catch (error) {
      pushLogger?.error('Failed to push changes', error as Error);
      throw error;
    }
  }

  @Emits('repo.scan.completed', {
    payloadMapper: (path: string, repositoryCount: number) => ({
      path,
      repositoryCount,
      timestamp: Date.now()
    })
  })
  @Traces({ threshold: 1000 })
  async scanRepositories(path: string = '.'): Promise<string[]> {
    const scanLogger = this.logger?.child({ operation: 'scanRepositories', path });
    scanLogger?.info('Scanning for repositories');

    try {
      const { glob } = await import('glob');
      const fullPath = join(this.workspaceRoot, path);
      
      // Find all .git directories
      const gitDirs = await glob('**/.git', {
        cwd: fullPath,
        ignore: ['**/node_modules/**'],
        absolute: true
      });

      // Extract repository paths (parent of .git)
      const repoPaths = gitDirs.map(gitPath => {
        const repoPath = gitPath.replace(/\/.git$/, '');
        return repoPath.replace(this.workspaceRoot + '/', '');
      });

      scanLogger?.info('Repository scan completed', {
        repositoryCount: repoPaths.length,
        repositories: repoPaths.slice(0, 10) // Log first 10 for preview
      });

      return repoPaths;
    } catch (error) {
      scanLogger?.error('Failed to scan repositories', error as Error);
      throw error;
    }
  }

  @Emits('repo.branch.created', {
    payloadMapper: (path: string, branchName: string) => ({
      path,
      branchName,
      timestamp: Date.now()
    })
  })
  @Traces({ threshold: 200 })
  async createBranch(path: string, branchName: string): Promise<void> {
    const branchLogger = this.logger?.child({ 
      operation: 'createBranch', 
      path,
      branchName 
    });

    branchLogger?.info('Creating branch');

    try {
      const fullPath = join(this.workspaceRoot, path);
      const git = simpleGit(fullPath);
      
      await git.checkoutLocalBranch(branchName);
      
      branchLogger?.info('Branch created successfully');
    } catch (error) {
      branchLogger?.error('Failed to create branch', error as Error);
      throw error;
    }
  }

  @Emits('repo.command.executed', {
    payloadMapper: (path: string, command: string) => ({
      path,
      command,
      timestamp: Date.now()
    })
  })
  @Traces({ threshold: 500 })
  async executeCommand(path: string, command: string[]): Promise<string> {
    const cmdLogger = this.logger?.child({ 
      operation: 'executeCommand', 
      path,
      command: command.join(' ') 
    });

    cmdLogger?.info('Executing git command');

    try {
      const fullPath = join(this.workspaceRoot, path);
      const git = simpleGit(fullPath);
      
      const result = await git.raw(command);
      
      cmdLogger?.info('Git command executed successfully', {
        outputLength: result.length
      });

      return result;
    } catch (error) {
      cmdLogger?.error('Failed to execute git command', error as Error);
      throw error;
    }
  }

  async getLatestCommit(path: string): Promise<{
    hash: string;
    message: string;
    author: string;
    date: string;
  }> {
    const fullPath = join(this.workspaceRoot, path);
    const git = simpleGit(fullPath);
    
    const log = await git.log({ maxCount: 1 });
    const latest = log.latest;
    
    if (!latest) {
      throw new Error('No commits found');
    }

    return {
      hash: latest.hash,
      message: latest.message,
      author: latest.author_name,
      date: latest.date
    };
  }

  async getDiff(path: string, cached: boolean = false): Promise<string> {
    const fullPath = join(this.workspaceRoot, path);
    const git = simpleGit(fullPath);
    
    if (cached) {
      return await git.diff(['--cached']);
    }
    
    return await git.diff();
  }
}