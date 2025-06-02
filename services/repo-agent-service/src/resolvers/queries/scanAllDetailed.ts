import simpleGit from 'simple-git';
import { Context } from '../context.js';
import { 
  DetailedScanReport, 
  DetailedRepository, 
  ScanStatistics,
  ScanMetadata,
  ChangesByType,
  Commit,
  Remote,
  RepositoryConfig
} from '../../types/generated.js';
import { scanAllRepositories } from './scanAllRepositories.js';
import { gitStatus } from './gitStatus.js';

async function getRecentCommits(repoPath: string, limit: number = 10): Promise<Commit[]> {
  try {
    const git = simpleGit(repoPath);
    const log = await git.log({ n: limit });
    
    return log.all.map(commit => ({
      hash: commit.hash,
      message: commit.message,
      author: commit.author_name,
      authorEmail: commit.author_email,
      timestamp: commit.date
    }));
  } catch {
    return [];
  }
}

async function getRemotes(repoPath: string): Promise<Remote[]> {
  try {
    const git = simpleGit(repoPath);
    const remotes = await git.getRemotes(true);
    
    return remotes.map(remote => ({
      name: remote.name,
      fetchUrl: remote.refs.fetch || '',
      pushUrl: remote.refs.push || remote.refs.fetch || ''
    }));
  } catch {
    return [];
  }
}

async function getRepositoryConfig(repoPath: string): Promise<RepositoryConfig> {
  try {
    const git = simpleGit(repoPath);
    
    // Get default branch
    let defaultBranch = 'main';
    try {
      const symbolic = await git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD']);
      defaultBranch = symbolic.trim().replace('refs/remotes/origin/', '');
    } catch {
      // Try to get from config
      try {
        const configBranch = await git.raw(['config', '--get', 'init.defaultBranch']);
        defaultBranch = configBranch.trim() || 'main';
      } catch {
        // Default to main
      }
    }
    
    // Check if bare
    const isBareStr = await git.raw(['rev-parse', '--is-bare-repository']).catch(() => 'false');
    const isBare = isBareStr.trim() === 'true';
    
    // Check if shallow
    let isShallow = false;
    try {
      await git.raw(['rev-parse', '--is-shallow-repository']);
      isShallow = true;
    } catch {
      // Not shallow
    }
    
    return {
      defaultBranch,
      isBare,
      isShallow
    };
  } catch {
    return {
      defaultBranch: 'main',
      isBare: false,
      isShallow: false
    };
  }
}

async function getDiffs(repoPath: string): Promise<{ staged: string | null; unstaged: string | null }> {
  try {
    const git = simpleGit(repoPath);
    
    // Get staged diff
    let staged: string | null = null;
    try {
      const stagedDiff = await git.diff(['--cached']);
      if (stagedDiff) {
        staged = stagedDiff;
      }
    } catch {
      // No staged changes
    }
    
    // Get unstaged diff
    let unstaged: string | null = null;
    try {
      const unstagedDiff = await git.diff();
      if (unstagedDiff) {
        unstaged = unstagedDiff;
      }
    } catch {
      // No unstaged changes
    }
    
    return { staged, unstaged };
  } catch {
    return { staged: null, unstaged: null };
  }
}

export async function scanAllDetailed(
  _parent: unknown,
  _args: {},
  context: Context
): Promise<DetailedScanReport> {
  const startTime = new Date();
  
  try {
    // First, get all repositories
    const repositories = await scanAllRepositories(_parent, _args, context);
    
    // Get detailed information for each repository
    const detailedRepos: DetailedRepository[] = await Promise.all(
      repositories.map(async (repo) => {
        const status = await gitStatus(_parent, { path: repo.path }, context);
        const recentCommits = await getRecentCommits(repo.path);
        const remotes = await getRemotes(repo.path);
        const config = await getRepositoryConfig(repo.path);
        const diffs = await getDiffs(repo.path);
        
        return {
          name: repo.name,
          path: repo.path,
          status,
          stagedDiff: diffs.staged,
          unstagedDiff: diffs.unstaged,
          recentCommits,
          remotes,
          config
        };
      })
    );
    
    // Calculate statistics
    const changesByType: ChangesByType = {
      modified: 0,
      added: 0,
      deleted: 0,
      renamed: 0,
      untracked: 0
    };
    
    let totalAdditions = 0;
    let totalDeletions = 0;
    let totalUncommittedFiles = 0;
    let dirtyRepositories = 0;
    
    for (const repo of detailedRepos) {
      if (repo.status.isDirty) {
        dirtyRepositories++;
      }
      
      totalUncommittedFiles += repo.status.files.length;
      
      for (const file of repo.status.files) {
        switch (file.status) {
          case 'M':
            changesByType.modified++;
            break;
          case 'A':
            changesByType.added++;
            break;
          case 'D':
            changesByType.deleted++;
            break;
          case 'R':
            changesByType.renamed++;
            break;
          case '??':
            changesByType.untracked++;
            break;
        }
      }
      
      // Parse diffs for additions/deletions count
      if (repo.stagedDiff) {
        const lines = repo.stagedDiff.split('\n');
        for (const line of lines) {
          if (line.startsWith('+') && !line.startsWith('+++')) {
            totalAdditions++;
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            totalDeletions++;
          }
        }
      }
      
      if (repo.unstagedDiff) {
        const lines = repo.unstagedDiff.split('\n');
        for (const line of lines) {
          if (line.startsWith('+') && !line.startsWith('+++')) {
            totalAdditions++;
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            totalDeletions++;
          }
        }
      }
    }
    
    const endTime = new Date();
    
    const statistics: ScanStatistics = {
      totalRepositories: repositories.length,
      dirtyRepositories,
      totalUncommittedFiles,
      totalAdditions,
      totalDeletions,
      changesByType
    };
    
    const metadata: ScanMetadata = {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: endTime.getTime() - startTime.getTime(),
      workspaceRoot: context.workspaceRoot
    };
    
    return {
      repositories: detailedRepos,
      statistics,
      metadata
    };
  } catch (error: any) {
    throw new Error(`Failed to perform detailed scan: ${error.message}`);
  }
}