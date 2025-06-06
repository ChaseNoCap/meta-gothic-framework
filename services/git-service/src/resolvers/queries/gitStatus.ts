import simpleGit from 'simple-git';
import { Context } from '../context.js';
import { GitStatus, FileStatus, Stash } from '../../types/generated.js';
import path from 'path';
import fs from 'fs/promises';

export async function gitStatus(
  _parent: unknown,
  { path: repoPath }: { path: string },
  context: Context
): Promise<GitStatus> {
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
    
    // Get branch info
    const branchSummary = await git.branch();
    const currentBranch = branchSummary.current;

    // Get status
    const status = await git.status();
    
    // Get ahead/behind info
    let ahead = 0;
    let behind = 0;
    let hasRemote = false;

    if (status.tracking) {
      hasRemote = true;
      ahead = status.ahead;
      behind = status.behind;
    }

    // Get stash list
    const stashList = await git.stashList();
    const stashes: Stash[] = stashList.all.map((stash, index) => ({
      index,
      message: stash.message || '',
      timestamp: stash.date || new Date().toISOString()
    }));

    // Process files
    const files: FileStatus[] = [
      ...status.not_added.map(f => ({
        path: f,
        status: '??',
        statusDescription: 'Untracked',
        isStaged: false
      })),
      ...status.created.map(f => ({
        path: f,
        status: 'A',
        statusDescription: 'Added',
        isStaged: true
      })),
      ...status.modified.map(f => ({
        path: f,
        status: 'M',
        statusDescription: 'Modified',
        isStaged: status.staged.includes(f)
      })),
      ...status.deleted.map(f => ({
        path: f,
        status: 'D',
        statusDescription: 'Deleted',
        isStaged: status.staged.includes(f)
      })),
      ...status.renamed.map(r => ({
        path: r.to,
        status: 'R',
        statusDescription: `Renamed from ${r.from}`,
        isStaged: true
      }))
    ];

    // Check for conflicts
    const conflicted = status.conflicted.map(f => ({
      path: f,
      status: 'U',
      statusDescription: 'Conflicted',
      isStaged: false
    }));

    files.push(...conflicted);

    return {
      branch: currentBranch,
      isDirty: status.files.length > 0,
      files,
      ahead,
      behind,
      hasRemote,
      stashes
    };
  } catch (error: any) {
    throw new Error(`Failed to get git status: ${error.message}`);
  }
}