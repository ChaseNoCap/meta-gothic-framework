import { Context } from '../context.js';
import { BatchCommitResult, BatchCommitInput, CommitResult } from '../../types/generated.js';
import { commitChanges } from './commitChanges.js';

export async function batchCommit(
  _parent: unknown,
  { input }: { input: BatchCommitInput },
  context: Context
): Promise<BatchCommitResult> {
  const startTime = Date.now();
  const results: CommitResult[] = [];
  let successCount = 0;
  
  const { commits, continueOnError = true } = input;
  
  // Process commits sequentially to avoid conflicts
  for (const commit of commits) {
    try {
      const result = await commitChanges(
        _parent,
        { input: commit },
        context
      );
      
      results.push(result);
      if (result.success) {
        successCount++;
      }
    } catch (error: any) {
      const failedResult: CommitResult = {
        success: false,
        commitHash: null,
        error: error.message || 'Unknown error occurred',
        repository: commit.repository,
        committedFiles: []
      };
      results.push(failedResult);
      
      if (!continueOnError) {
        break;
      }
    }
  }
  
  const executionTime = Date.now() - startTime;
  
  return {
    totalRepositories: commits.length,
    successCount,
    results,
    executionTime
  };
}