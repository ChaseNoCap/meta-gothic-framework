import { execSync } from 'child_process';
import path from 'path';

interface HierarchicalCommitInput {
  message: string;
  stageAll?: boolean;
  author?: string;
  authorEmail?: string;
}

interface CommitResult {
  success: boolean;
  commitHash?: string;
  error?: string;
  repository: string;
  committedFiles: string[];
  isClean?: boolean;
  remainingFiles?: number;
}

interface HierarchicalCommitResult {
  success: boolean;
  totalRepositories: number;
  successCount: number;
  submoduleCommits: CommitResult[];
  parentCommit?: CommitResult;
  executionTime: number;
  error?: string;
}

async function executeGitCommand(
  command: string,
  cwd: string
): Promise<{ success: boolean; output?: string; error?: string }> {
  try {
    const output = execSync(command, {
      cwd,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return { success: true, output: output.trim() };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || error.stderr?.toString() || 'Unknown error'
    };
  }
}

async function getChangedFiles(repoPath: string): Promise<string[]> {
  console.log('[getChangedFiles] Checking path:', repoPath);
  
  // Use git status to check for ANY changes (staged, unstaged, or untracked)
  const statusResult = await executeGitCommand('git status --porcelain', repoPath);
  console.log('[getChangedFiles] Status result:', statusResult);
  
  if (!statusResult.success || !statusResult.output) {
    console.log('[getChangedFiles] No changes or error');
    return [];
  }
  
  const files = statusResult.output
    .split('\n')
    .filter(line => line.trim())
    .map(line => line.substring(3)); // Remove status indicators (e.g., "M  ", "?? ")
    
  console.log('[getChangedFiles] Found files:', files);
  return files;
}

async function commitRepository(
  repoPath: string,
  message: string,
  options: Omit<HierarchicalCommitInput, 'message'>
): Promise<CommitResult> {
  try {
    console.log('[commitRepository] Starting commit for:', repoPath);
    console.log('[commitRepository] Message:', message);
    console.log('[commitRepository] Options:', options);
    
    // Check if there are changes
    const changedFiles = await getChangedFiles(repoPath);
    if (changedFiles.length === 0) {
      console.log('[commitRepository] No changes in', repoPath);
      return {
        success: true,
        repository: repoPath,
        committedFiles: [],
        isClean: true,
        remainingFiles: 0
      };
    }

    // Stage files
    if (options.stageAll) {
      const stageResult = await executeGitCommand('git add -A', repoPath);
      if (!stageResult.success) {
        return {
          success: false,
          error: `Failed to stage files: ${stageResult.error}`,
          repository: repoPath,
          committedFiles: []
        };
      }
    }

    // Build commit command
    let commitCmd = 'git commit --no-verify'; // Skip hooks in non-interactive environment
    if (options.author) {
      commitCmd += ` --author="${options.author} <${options.authorEmail || 'noreply@example.com'}>"`;
    }
    commitCmd += ` -m "${message}"`;

    // Execute commit
    console.log('[commitRepository] Executing:', commitCmd);
    const commitResult = await executeGitCommand(commitCmd, repoPath);
    if (!commitResult.success) {
      return {
        success: false,
        error: commitResult.error,
        repository: repoPath,
        committedFiles: []
      };
    }

    // Get commit hash
    const hashResult = await executeGitCommand('git rev-parse HEAD', repoPath);
    const commitHash = hashResult.output?.substring(0, 7);

    // Check remaining files
    const remainingFiles = await getChangedFiles(repoPath);

    return {
      success: true,
      commitHash,
      repository: repoPath,
      committedFiles: changedFiles,
      isClean: remainingFiles.length === 0,
      remainingFiles: remainingFiles.length
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      repository: repoPath,
      committedFiles: []
    };
  }
}

export async function hierarchicalCommit(
  _parent: any,
  { input }: { input: HierarchicalCommitInput },
  context: any
): Promise<HierarchicalCommitResult> {
  const startTime = Date.now();
  const workspaceRoot = process.env.WORKSPACE_ROOT || process.cwd();
  
  console.log('[hierarchicalCommit] Starting with workspaceRoot:', workspaceRoot);
  console.log('[hierarchicalCommit] Input:', input);
  
  try {
    // Get submodules
    const submodulesResult = await executeGitCommand(
      'git submodule status',
      workspaceRoot
    );
    
    console.log('[hierarchicalCommit] Submodules result:', submodulesResult);
    
    const submodulePaths: string[] = [];
    if (submodulesResult.success && submodulesResult.output) {
      const lines = submodulesResult.output.split('\n').filter(line => line.trim());
      console.log('[hierarchicalCommit] Submodule lines:', lines);
      
      for (const line of lines) {
        const match = line.match(/^\s*[\+\-\s]*[0-9a-f]+\s+([^\s]+)/);
        if (match) {
          submodulePaths.push(path.join(workspaceRoot, match[1]));
        }
      }
    }
    
    console.log('[hierarchicalCommit] Found submodules:', submodulePaths);

    // Commit submodules first
    const submoduleCommits: CommitResult[] = [];
    let successCount = 0;

    for (const submodulePath of submodulePaths) {
      const result = await commitRepository(submodulePath, input.message, {
        stageAll: input.stageAll,
        author: input.author,
        authorEmail: input.authorEmail
      });
      
      submoduleCommits.push(result);
      if (result.success && result.commitHash) {
        successCount++;
      }
    }

    // Commit parent repository
    console.log('[hierarchicalCommit] Committing parent repository at:', workspaceRoot);
    let parentCommit: CommitResult | undefined;
    const parentResult = await commitRepository(workspaceRoot, input.message, {
      stageAll: input.stageAll,
      author: input.author,
      authorEmail: input.authorEmail
    });
    
    console.log('[hierarchicalCommit] Parent commit result:', parentResult);
    
    if (parentResult.success || parentResult.commitHash) {
      parentCommit = parentResult;
      successCount++;
    } else {
      console.log('[hierarchicalCommit] Parent commit failed, including in response');
      parentCommit = parentResult; // Include failed result too
    }

    const totalRepositories = submodulePaths.length + 1;
    const executionTime = Date.now() - startTime;

    return {
      success: successCount === totalRepositories,
      totalRepositories,
      successCount,
      submoduleCommits,
      parentCommit,
      executionTime,
      error: successCount < totalRepositories 
        ? `Committed ${successCount} of ${totalRepositories} repositories`
        : undefined
    };
  } catch (error: any) {
    return {
      success: false,
      totalRepositories: 0,
      successCount: 0,
      submoduleCommits: [],
      executionTime: Date.now() - startTime,
      error: error.message
    };
  }
}