import simpleGit from 'simple-git';
import { Context } from '../context.js';
import { RepositoryScan, RepositoryType } from '../../types/generated.js';
import { getFileSystem } from '@meta-gothic/shared-types/file-system';
import type { IFileSystem } from '@meta-gothic/shared-types/file-system';

async function getSubmodules(repoPath: string, fileSystem: IFileSystem): Promise<string[]> {
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
        const submodulePath = fileSystem.join(repoPath, match[1]);
        submodules.push(submodulePath);
      }
    }
    
    return submodules;
  } catch {
    return [];
  }
}

async function findGitRepositories(dir: string, fileSystem: IFileSystem, results: string[] = []): Promise<string[]> {
  try {
    const entries = await fileSystem.listDirectory(dir);
    const entriesWithTypes = [];
    
    for (const entry of entries) {
      const isDir = await fileSystem.isDirectory(entry);
      const basename = fileSystem.basename(entry);
      entriesWithTypes.push({ path: entry, name: basename, isDirectory: isDir });
    }
    
    // Check if current directory is a git repository
    const hasGit = entriesWithTypes.some(entry => entry.name === '.git' && entry.isDirectory);
    if (hasGit) {
      results.push(dir);
      
      // Also get submodules for this repository
      const submodules = await getSubmodules(dir, fileSystem);
      results.push(...submodules);
      
      return results;
    }
    
    // Recurse into subdirectories
    for (const entry of entriesWithTypes) {
      if (entry.isDirectory && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await findGitRepositories(entry.path, fileSystem, results);
      }
    }
    
    return results;
  } catch (error) {
    // If we can't read a directory, just skip it
    return results;
  }
}

async function getRepositoryType(repoPath: string, fileSystem: IFileSystem): Promise<RepositoryType> {
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
    const gitPath = fileSystem.join(repoPath, '.git');
    const isFile = await fileSystem.isFile(gitPath);
    if (isFile) {
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
    const fileSystem = getFileSystem({ 
      eventBus: context.eventBus, 
      logger: context.logger, 
      correlationId: context.correlationId 
    });
    // Find all git repositories in the workspace
    const repositories = await findGitRepositories(context.workspaceRoot, fileSystem);
    
    // Get information for each repository
    const scans = await Promise.all(
      repositories.map(async (repoPath) => {
        try {
          const git = simpleGit(repoPath);
          const status = await git.status();
          const branchSummary = await git.branch();
          const type = await getRepositoryType(repoPath, fileSystem);
          
          // Get repository name from path
          const name = fileSystem.basename(repoPath);
          
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
            name: fileSystem.basename(repoPath),
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