import simpleGit from 'simple-git';
import { Context } from '../context.js';
import { CommitResult, CommitInput } from '../../types/generated.js';
import path from 'path';
import fs from 'fs/promises';

export async function commitChanges(
  _parent: unknown,
  { input }: { input: CommitInput },
  context: Context
): Promise<CommitResult> {
  try {
    const { repository: repoPath, message, files, stageAll, author, authorEmail } = input;
    
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
    
    // Stage files if specified
    if (stageAll) {
      await git.add('.');
    } else if (files && files.length > 0) {
      for (const file of files) {
        // Validate file paths
        const filePath = path.join(absolutePath, file);
        
        // Check if file exists (unless it's being deleted)
        try {
          await fs.access(filePath);
        } catch {
          // File might be deleted, continue
        }
        
        // Check for sensitive files
        const sensitivePatterns = ['.env', 'secrets', 'credentials', 'private', 'key'];
        const lowerPath = file.toLowerCase();
        if (sensitivePatterns.some(pattern => lowerPath.includes(pattern))) {
          throw new Error(`Cannot commit potentially sensitive file: ${file}`);
        }
        
        await git.add(file);
      }
    } else {
      // If no files specified, check if there are staged changes
      const status = await git.status();
      if (status.staged.length === 0) {
        throw new Error('No staged changes to commit. Stage files first or provide files to commit.');
      }
    }
    
    // Set author if provided
    if (author && authorEmail) {
      await git.addConfig('user.name', author, false);
      await git.addConfig('user.email', authorEmail, false);
    }
    
    // Perform the commit
    await git.commit(message);
    
    // Get the commit details
    const log = await git.log({ n: 1 });
    const latestCommit = log.latest;
    
    if (!latestCommit) {
      throw new Error('Failed to retrieve commit information');
    }
    
    // Get the files that were committed
    const diff = await git.diff(['HEAD~1', 'HEAD', '--name-status']);
    const committedFiles = diff.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const parts = line.split('\t');
        return parts.length > 1 ? parts.slice(1).join('\t') : parts[0];
      });
    
    // Verify the working directory is now clean for the committed files
    const postCommitStatus = await git.status();
    const isClean = postCommitStatus.files.length === 0 || 
      (files && files.length > 0 && !postCommitStatus.files.some(f => files.includes(f.path)));
    
    return {
      success: true,
      commitHash: latestCommit.hash,
      error: null,
      repository: repoPath,
      committedFiles: committedFiles.filter((f): f is string => f !== undefined),
      isClean, // Add this to help clients know if working directory is clean
      remainingFiles: postCommitStatus.files.length // Number of uncommitted files remaining
    };
  } catch (error: any) {
    return {
      success: false,
      commitHash: null,
      error: error.message || 'Failed to commit changes',
      repository: input.repository,
      committedFiles: []
    };
  }
}