import simpleGit from 'simple-git';
import { Context } from '../context.js';
import { CommitInfo } from '../../types/generated.js';
import path from 'path';
import fs from 'fs/promises';

export async function latestCommit(
  _parent: unknown,
  { path: repoPath }: { path: string },
  context: Context
): Promise<CommitInfo> {
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
    
    // Get latest commit info
    const log = await git.log({ n: 1 });
    const latestCommit = log.latest;
    
    if (!latestCommit) {
      throw new Error('No commits found in repository');
    }
    
    return {
      hash: latestCommit.hash,
      shortHash: latestCommit.hash.substring(0, 7),
      message: latestCommit.message,
      author: latestCommit.author_name,
      timestamp: latestCommit.date,
      repository: repoPath
    };
  } catch (error: any) {
    throw new Error(`Failed to get latest commit: ${error.message}`);
  }
}