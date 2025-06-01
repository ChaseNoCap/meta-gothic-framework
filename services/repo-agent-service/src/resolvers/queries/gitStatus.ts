import simpleGit from 'simple-git';
import { join } from 'path';
import type { GitStatus, FileChange } from '../../types/generated.js';

interface Context {
  workspaceRoot: string;
}

export async function gitStatusResolver(
  parent: unknown,
  args: { path: string },
  context: Context
): Promise<GitStatus> {
  const fullPath = join(context.workspaceRoot, args.path);
  const git = simpleGit(fullPath);

  try {
    // Check if directory exists and is a git repository
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      throw new Error(`Path ${args.path} is not a git repository`);
    }

    // Get status
    const status = await git.status();
    
    // Get branch info
    const branch = await git.branch();
    const currentBranch = branch.current;
    
    // Get tracking info
    const trackingBranch = status.tracking || null;
    
    // Process files
    const files: FileChange[] = [
      ...status.modified.map(path => ({
        path,
        status: 'M',
        statusDescription: 'Modified',
        isStaged: status.staged.includes(path),
        additions: null,
        deletions: null
      })),
      ...status.not_added.map(path => ({
        path,
        status: '?',
        statusDescription: 'Untracked',
        isStaged: false,
        additions: null,
        deletions: null
      })),
      ...status.created.map(path => ({
        path,
        status: 'A',
        statusDescription: 'Added',
        isStaged: status.staged.includes(path),
        additions: null,
        deletions: null
      })),
      ...status.deleted.map(path => ({
        path,
        status: 'D',
        statusDescription: 'Deleted',
        isStaged: status.staged.includes(path),
        additions: null,
        deletions: null
      })),
      ...status.renamed.map(({ from, to }) => ({
        path: to,
        status: 'R',
        statusDescription: `Renamed from ${from}`,
        isStaged: true,
        additions: null,
        deletions: null
      }))
    ];

    // Get diff stats if needed
    if (files.length > 0) {
      try {
        const diffSummary = await git.diffSummary(['--cached', 'HEAD']);
        const unstagedDiffSummary = await git.diffSummary();
        
        // Merge diff stats into files
        [...diffSummary.files, ...unstagedDiffSummary.files].forEach(file => {
          const fileChange = files.find(f => f.path === file.file);
          if (fileChange) {
            fileChange.additions = file.insertions;
            fileChange.deletions = file.deletions;
          }
        });
      } catch (err) {
        // Diff stats are optional, continue without them
        console.warn('Could not get diff stats:', err);
      }
    }

    return {
      path: args.path,
      branch: currentBranch,
      trackingBranch,
      ahead: status.ahead,
      behind: status.behind,
      files,
      isDirty: files.length > 0,
      changeCount: files.length
    };
  } catch (error) {
    throw new Error(`Failed to get git status for ${args.path}: ${error.message}`);
  }
}