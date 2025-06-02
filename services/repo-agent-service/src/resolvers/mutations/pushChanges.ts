import simpleGit from 'simple-git';
import { Context } from '../context.js';
import { PushResult, PushInput } from '../../types/generated.js';
import path from 'path';
import fs from 'fs/promises';

export async function pushChanges(
  _parent: unknown,
  { input }: { input: PushInput },
  context: Context
): Promise<PushResult> {
  const { repository: repoPath, remote, branch, setUpstream = false, pushTags = false } = input;
  const remoteToUse = remote || 'origin';
  
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
    
    // Get current branch if not specified
    const branchSummary = await git.branch();
    const targetBranch = branch || branchSummary.current || 'main';
    
    // Check if remote exists
    const remotes = await git.getRemotes();
    if (!remotes.find(r => r.name === remoteToUse)) {
      throw new Error(`Remote '${remoteToUse}' not found. Available remotes: ${remotes.map(r => r.name).join(', ')}`);
    }
    
    // Prepare push options
    const pushOptions: string[] = [remoteToUse, targetBranch];
    
    if (setUpstream) {
      pushOptions.unshift('-u');
    }
    
    // Additional push for tags if requested
    if (pushTags) {
      pushOptions.push('--tags');
    }
    
    // Check if there are commits to push
    try {
      const status = await git.status();
      if (status.ahead === 0) {
        return {
          success: true,
          remote: remoteToUse,
          branch: targetBranch,
          error: null,
          repository: repoPath
        };
      }
    } catch {
      // If we can't get status, continue with push anyway
    }
    
    // Get commits that will be pushed (optional, for logging)
    try {
      const log = await git.log([`${remoteToUse}/${targetBranch}..HEAD`]);
      console.log(`Pushing ${log.all.length} commits to ${remoteToUse}/${targetBranch}`);
    } catch {
      // If we can't get the log, continue
    }
    
    // Perform the push
    await git.push(pushOptions);
    
    return {
      success: true,
      remote: remoteToUse,
      branch: targetBranch,
      error: null,
      repository: repoPath
    };
  } catch (error: any) {
    // Handle specific git errors
    if (error.message.includes('non-fast-forward')) {
      throw new Error('Push rejected: remote contains commits not present locally. Pull changes first.');
    } else if (error.message.includes('no upstream branch')) {
      throw new Error(`No upstream branch set. Use setUpstream: true to set '${remoteToUse}' as upstream.`);
    } else if (error.message.includes('authentication')) {
      throw new Error('Authentication failed. Check your credentials or SSH keys.');
    }
    
    return {
      success: false,
      remote: remoteToUse,
      branch: branch || 'unknown',
      error: error.message,
      repository: input?.repository || ''
    };
  }
}