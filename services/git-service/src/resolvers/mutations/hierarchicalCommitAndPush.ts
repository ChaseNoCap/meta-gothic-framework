import { hierarchicalCommit } from './hierarchicalCommit.js';
import { pushChanges } from './pushChanges.js';

interface HierarchicalCommitInput {
  message: string;
  stageAll?: boolean;
  author?: string;
  authorEmail?: string;
}

interface PushResult {
  success: boolean;
  remote: string;
  branch: string;
  error?: string;
  repository: string;
}

interface HierarchicalCommitAndPushResult {
  success: boolean;
  commitResult: any;
  pushResults: PushResult[];
  executionTime: number;
  error?: string;
}

export async function hierarchicalCommitAndPush(
  _parent: any,
  { input }: { input: HierarchicalCommitInput },
  context: any
): Promise<HierarchicalCommitAndPushResult> {
  const startTime = Date.now();
  
  try {
    // First, perform hierarchical commit
    const commitResult = await hierarchicalCommit(_parent, { input }, context);
    
    if (!commitResult.success) {
      return {
        success: false,
        commitResult,
        pushResults: [],
        executionTime: Date.now() - startTime,
        error: 'Failed to commit all repositories'
      };
    }

    // Collect all repositories that were committed
    const repositoriesToPush: string[] = [];
    
    // Add successfully committed submodules
    for (const submoduleCommit of commitResult.submoduleCommits) {
      if (submoduleCommit.success && submoduleCommit.commitHash) {
        repositoriesToPush.push(submoduleCommit.repository);
      }
    }
    
    // Add parent repository if it was committed
    if (commitResult.parentCommit?.success && commitResult.parentCommit?.commitHash) {
      repositoriesToPush.push(commitResult.parentCommit.repository);
    }

    // Push each repository
    const pushResults: PushResult[] = [];
    let pushSuccess = true;

    for (const repository of repositoriesToPush) {
      try {
        const pushResult = await pushChanges(
          _parent,
          {
            input: {
              repository,
              setUpstream: true
            }
          },
          context
        );
        
        pushResults.push(pushResult);
        if (!pushResult.success) {
          pushSuccess = false;
        }
      } catch (error: any) {
        pushResults.push({
          success: false,
          remote: 'origin',
          branch: 'unknown',
          error: error.message,
          repository
        });
        pushSuccess = false;
      }
    }

    const executionTime = Date.now() - startTime;

    return {
      success: commitResult.success && pushSuccess,
      commitResult,
      pushResults,
      executionTime,
      error: !pushSuccess ? 'Some repositories failed to push' : undefined
    };
  } catch (error: any) {
    return {
      success: false,
      commitResult: {
        success: false,
        totalRepositories: 0,
        successCount: 0,
        submoduleCommits: [],
        executionTime: 0,
        error: error.message
      },
      pushResults: [],
      executionTime: Date.now() - startTime,
      error: error.message
    };
  }
}