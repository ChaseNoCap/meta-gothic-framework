import simpleGit from 'simple-git';
import { Context } from '../context.js';
import { 
  RepositoryDetails, 
  Branch, 
  Tag, 
  Remote, 
  RepositorySize,
  PackageInfo,
  Commit
} from '../../types/generated.js';
import { gitStatus } from './gitStatus.js';
import path from 'path';
import fs from 'fs/promises';

async function getBranches(repoPath: string): Promise<Branch[]> {
  try {
    const git = simpleGit(repoPath);
    const branchSummary = await git.branch(['-a', '-v']);
    
    const branches: Branch[] = [];
    
    for (const [name, branch] of Object.entries(branchSummary.branches)) {
      // Skip remote branches for now, we'll handle them separately
      if (name.startsWith('remotes/')) continue;
      
      const lastCommit: Commit = {
        hash: branch.commit,
        message: branch.label || '',
        author: '',
        authorEmail: '',
        timestamp: ''
      };
      
      // Get more commit details if possible
      try {
        const log = await git.log({ from: branch.commit, to: branch.commit, n: 1 });
        if (log.latest) {
          lastCommit.message = log.latest.message;
          lastCommit.author = log.latest.author_name;
          lastCommit.authorEmail = log.latest.author_email;
          lastCommit.timestamp = log.latest.date;
        }
      } catch {
        // Ignore errors getting commit details
      }
      
      branches.push({
        name,
        isCurrent: branch.current,
        isTracking: !!branch.label,
        trackingBranch: typeof branch.linkedWorkTree === 'string' ? branch.linkedWorkTree : null,
        lastCommit
      });
    }
    
    return branches;
  } catch {
    return [];
  }
}

async function getTags(repoPath: string): Promise<Tag[]> {
  try {
    const git = simpleGit(repoPath);
    const tagList = await git.tags(['--sort=-creatordate']);
    
    const tags: Tag[] = [];
    
    for (const tagName of tagList.all) {
      try {
        // Get tag details
        const tagInfo = await git.show([tagName]);
        const isAnnotated = tagInfo.includes('tag ') && tagInfo.includes('Tagger:');
        
        let commit = '';
        let message: string | null = null;
        let tagger: string | null = null;
        let date: string | null = null;
        
        if (isAnnotated) {
          // Parse annotated tag info
          const lines = tagInfo.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('commit ')) {
              commit = line.replace('commit ', '').trim();
            } else if (line.startsWith('Tagger: ')) {
              tagger = line.replace('Tagger: ', '').trim();
            } else if (line.startsWith('Date: ')) {
              date = line.replace('Date: ', '').trim();
            } else if (i > 3 && line.trim() && !message) {
              // First non-empty line after headers is the message
              message = line.trim();
            }
          }
        } else {
          // Lightweight tag - get the commit it points to
          commit = await git.revparse([tagName]);
          commit = commit.trim();
        }
        
        tags.push({
          name: tagName,
          type: isAnnotated ? 'ANNOTATED' : 'LIGHTWEIGHT',
          commit,
          message,
          tagger,
          date
        });
      } catch {
        // If we can't get tag details, skip it
      }
    }
    
    return tags;
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

async function getRepositorySize(repoPath: string): Promise<RepositorySize> {
  try {
    const git = simpleGit(repoPath);
    
    // Get file count
    const fileList = await git.raw(['ls-files']);
    const fileCount = fileList.split('\n').filter(f => f.trim()).length;
    
    // Get commit count
    const commitCount = await git.raw(['rev-list', '--count', 'HEAD']);
    
    // Get sizes
    let totalSize = 0;
    let gitSize = 0;
    
    // Calculate .git directory size
    const gitDir = path.join(repoPath, '.git');
    gitSize = await getDirectorySize(gitDir);
    
    // Calculate total repository size
    totalSize = await getDirectorySize(repoPath);
    
    return {
      totalSize,
      fileCount,
      commitCount: parseInt(commitCount.trim()) || 0,
      gitSize
    };
  } catch {
    return {
      totalSize: 0,
      fileCount: 0,
      commitCount: 0,
      gitSize: 0
    };
  }
}

async function getDirectorySize(dirPath: string): Promise<number> {
  let size = 0;
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        size += await getDirectorySize(fullPath);
      } else {
        try {
          const stat = await fs.stat(fullPath);
          size += stat.size;
        } catch {
          // Ignore files we can't stat
        }
      }
    }
  } catch {
    // Ignore directories we can't read
  }
  
  return size;
}

async function getPackageInfo(repoPath: string): Promise<PackageInfo | null> {
  try {
    const packageJsonPath = path.join(repoPath, 'package.json');
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content);
    
    return {
      name: pkg.name || 'unknown',
      version: pkg.version || '0.0.0',
      description: pkg.description || null,
      main: pkg.main || null,
      scripts: Object.keys(pkg.scripts || {}),
      dependencyCount: Object.keys(pkg.dependencies || {}).length,
      devDependencyCount: Object.keys(pkg.devDependencies || {}).length
    };
  } catch {
    return null;
  }
}

export async function repositoryDetails(
  _parent: unknown,
  { path: repoPath }: { path: string },
  context: Context
): Promise<RepositoryDetails> {
  try {
    // Resolve absolute path
    const absolutePath = path.isAbsolute(repoPath) 
      ? repoPath 
      : path.join(context.workspaceRoot, repoPath);
    
    // Get all the information
    const [status, branches, tags, remotes, size, packageInfo] = await Promise.all([
      gitStatus(_parent, { path: repoPath }, context),
      getBranches(absolutePath),
      getTags(absolutePath),
      getRemotes(absolutePath),
      getRepositorySize(absolutePath),
      getPackageInfo(absolutePath)
    ]);
    
    const name = path.basename(absolutePath);
    
    return {
      name,
      path: absolutePath,
      status,
      branches,
      tags,
      remotes,
      size,
      packageInfo
    };
  } catch (error: any) {
    throw new Error(`Failed to get repository details: ${error.message}`);
  }
}