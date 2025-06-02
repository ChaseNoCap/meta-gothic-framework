import type { Context } from '../../types/context.js';
import type { 
  BatchCommitMessageInput, 
  BatchCommitMessageResult,
  CommitMessageResult 
} from '../../types/generated.js';
import { withCache, runCache } from '../../utils/cache.js';
import { performanceMonitor } from '../../utils/performance.js';
import { progressTracker } from '../../services/ProgressTracker.js';
import crypto from 'crypto';

/**
 * GraphQL resolver for parallel commit message generation
 * This resolver leverages the ClaudeSessionManager's built-in p-queue
 * to automatically handle concurrent execution with rate limiting
 */
export async function generateCommitMessages(
  _parent: unknown,
  { input }: { input: BatchCommitMessageInput },
  context: Context
): Promise<BatchCommitMessageResult> {
  const { sessionManager } = context;
  const startTime = Date.now();
  
  // Create batch for progress tracking
  const batchId = progressTracker.createBatch(input.repositories.length);
  
  // Track parallel execution performance
  return performanceMonitor.measure(
    'parallel-commit-generation',
    async () => {
      // Create promises for all repositories to enable parallel execution
      const promises = input.repositories.map(async (repo) => {
    try {
      // Generate cache key based on repository content
      const cacheKey = crypto
        .createHash('md5')
        .update(JSON.stringify({ name: repo.name, diff: repo.diff }))
        .digest('hex');
      
      // Try to use cached result if available
      const result = await withCache(
        runCache,
        `commit-msg:${cacheKey}`,
        async () => {
          // This will be automatically queued by ClaudeSessionManager's p-queue
          // with concurrency=5 and rate limiting of 3 per second
          const result = await sessionManager.generateCommitMessage({
            repository: repo.name,
            diff: repo.diff,
            recentCommits: repo.recentCommits || [],
            context: repo.context
          });
          
          // Add run to batch for tracking
          progressTracker.addRunToBatch(batchId, result.runId, repo.name);
          
          return result;
        },
        300 // Cache for 5 minutes
      );
      
      return {
        repositoryPath: repo.path,
        repositoryName: repo.name,
        success: true,
        message: result.message,
        confidence: result.confidence,
        commitType: extractCommitType(result.message),
        error: null
      } as CommitMessageResult;
    } catch (error: any) {
      console.error(`Failed to generate commit message for ${repo.name}:`, error);
      
      return {
        repositoryPath: repo.path,
        repositoryName: repo.name,
        success: false,
        message: null,
        error: error.message || 'Unknown error occurred',
        confidence: 0,
        commitType: null
      } as CommitMessageResult;
    }
      });
      
      // Execute all promises in parallel (limited by queue concurrency)
      const results = await Promise.all(promises);
      
      // Calculate statistics
      const successCount = results.filter(r => r.success).length;
      const totalTokens = results.reduce((sum, r) => {
        // Rough estimate: 4 characters per token
        return sum + (r.message ? Math.floor(r.message.length / 4) : 0);
      }, 0);
      
      const executionTime = Date.now() - startTime;
      
      return {
        totalRepositories: input.repositories.length,
        successCount,
        results,
        totalTokenUsage: {
          inputTokens: Math.floor(JSON.stringify(input).length / 4), // Rough estimate
          outputTokens: totalTokens,
          estimatedCost: calculateEstimatedCost(totalTokens)
        },
        executionTime
      };
    },
    {
      repositoryCount: input.repositories.length,
      parallel: true
    }
  );
}

/**
 * Extract commit type from conventional commit message
 */
function extractCommitType(message: string | null): string | null {
  if (!message) return null;
  
  const match = message.match(/^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?:/i);
  return match ? match[1].toLowerCase() : 'chore';
}

/**
 * Calculate estimated cost based on token usage
 * Claude-3 Opus pricing: ~$15/1M input tokens, ~$75/1M output tokens
 */
function calculateEstimatedCost(outputTokens: number): number {
  const costPerMillionOutputTokens = 75; // USD
  return (outputTokens / 1_000_000) * costPerMillionOutputTokens;
}