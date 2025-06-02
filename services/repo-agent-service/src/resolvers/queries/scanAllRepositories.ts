import simpleGit from 'simple-git';
import { Context } from '../context.js';
import { RepositoryScan, RepositoryType } from '../../types/generated.js';
import path from 'path';
import fs from 'fs/promises';

async function getSubmodules(repoPath: string): Promise<string[]> {
  try {
    const git = simpleGit(repoPath);
    const submoduleStatus = await git.raw(['submodule', 'status']);
    
    if (!submoduleStatus) return [];
    
    const submodules: string[] = [];
    const lines = submoduleStatus.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      // Parse submodule status line
      // Format: " 160000 commit-hash 0 path/to/submodule"
      const match = line.match(/^\s*[\+\-\s]?[0-9a-f]+\s+(\S+)/);
      if (match) {
        const submodulePath = path.join(repoPath, match[1]);
        submodules.push(submodulePath);
      }
    }
    
    return submodules;
  } catch {
    return [];
  }
}

async function findGitRepositories(dir: string, results: string[] = []): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    // Check if current directory is a git repository
    const hasGit = entries.some(entry => entry.name === '.git' && entry.isDirectory());
    if (hasGit) {
      results.push(dir);
      
      // Also get submodules for this repository
      const submodules = await getSubmodules(dir);
      results.push(...submodules);
      
      return results;
    }
    
    // Recurse into subdirectories
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await findGitRepositories(path.join(dir, entry.name), results);
      }
    }
    
    return results;
  } catch (error) {
    // If we can't read a directory, just skip it
    return results;
  }
}

async function getRepositoryType(repoPath: string): Promise<RepositoryType> {
  try {
    const git = simpleGit(repoPath);
    
    // Check if it's a bare repository
    const isBare = await git.raw(['rev-parse', '--is-bare-repository']);
    if (isBare.trim() === 'true') {
      return 'BARE';
    }
    
    // Check if it's inside a worktree
    const worktreeDir = await git.raw(['rev-parse', '--git-common-dir']).catch(() => null);
    if (worktreeDir && worktreeDir.trim() !== '.git') {
      return 'WORKTREE';
    }
    
    // Check if it's a submodule by looking for .git file (not directory)
    const gitPath = path.join(repoPath, '.git');
    const stat = await fs.stat(gitPath);
    if (stat.isFile()) {
      return 'SUBMODULE';
    }
    
    return 'REGULAR';
  } catch {
    return 'REGULAR';
  }
}

export async function scanAllRepositories(
  _parent: unknown,
  _args: {},
  context: Context
): Promise<RepositoryScan[]> {
  try {
    // Find all git repositories in the workspace
    const repositories = await findGitRepositories(context.workspaceRoot);
    
    // Get information for each repository
    const scans = await Promise.all(
      repositories.map(async (repoPath) => {
        try {
          const git = simpleGit(repoPath);
          const status = await git.status();
          const branchSummary = await git.branch();
          const type = await getRepositoryType(repoPath);
          
          // Get repository name from path
          const name = path.basename(repoPath);
          
          return {
            name,
            path: repoPath,
            isDirty: status.files.length > 0,
            branch: branchSummary.current,
            uncommittedCount: status.files.length,
            type
          };
        } catch (error: any) {
          // If we can't get status for a repository, return minimal info
          return {
            name: path.basename(repoPath),
            path: repoPath,
            isDirty: false,
            branch: 'unknown',
            uncommittedCount: 0,
            type: 'REGULAR' as RepositoryType
          };
        }
      })
    );
    
    // Sort by name for consistent output
    return scans.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error: any) {
    throw new Error(`Failed to scan repositories: ${error.message}`);
  }
}