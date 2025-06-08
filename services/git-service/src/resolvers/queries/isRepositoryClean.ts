import simpleGit from 'simple-git';
import { Context } from '../context.js';
import { RepositoryCleanStatus } from '../../types/generated.js';
import path from 'path';
import fs from 'fs/promises';

export async function isRepositoryClean(
  _parent: unknown,
  { path: repoPath }: { path: string },
  context: Context
): Promise<RepositoryCleanStatus> {
  try {
    // Resolve absolute path
    const absolutePath = path.isAbsolute(repoPath) 
      ? repoPath 
      : path.join(context.workspaceRoot, repoPath);
    
    // Check if directory exists and is a git repository
    try {
      await fs.access(path.join(absolutePath, '.git'));
    } catch {
      throw new Error(`Not a git repository: ${repoPath}`);
    }
    
    const git = simpleGit(absolutePath);
    
    // Get current status
    const status = await git.status();
    const isClean = status.files.length === 0;
    
    // Get latest commit info
    const log = await git.log({ n: 1 });
    const latestCommit = log.latest;
    
    if (!latestCommit) {
      throw new Error('No commits found in repository');
    }
    
    return {
      isClean,
      uncommittedFiles: status.files.length,
      latestCommitHash: latestCommit.hash,
      repository: repoPath
    };
  } catch (error: any) {
    throw new Error(`Failed to check repository status: ${error.message}`);
  }
}