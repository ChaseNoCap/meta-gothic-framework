import { ApolloClient, InMemoryCache, gql, ApolloLink } from '@apollo/client';
import { WebSocketLink } from '@apollo/client/link/ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { split } from '@apollo/client/link/core';
import { createHttpLink } from '@apollo/client/link/http';

/**
 * Example TypeScript client for parallel GraphQL operations
 * This demonstrates how to use the Claude Service GraphQL API for maximum performance
 */

// Configure Apollo Client with both HTTP and WebSocket support
const httpLink = createHttpLink({
  uri: 'http://localhost:3002/graphql',
});

const wsLink = new WebSocketLink({
  uri: 'ws://localhost:3002/graphql',
  options: {
    reconnect: true,
    connectionParams: {
      // Add authentication headers if needed
    }
  }
});

// Split traffic based on operation type
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  httpLink,
);

const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'network-only'
    }
  }
});

// Types
interface Repository {
  path: string;
  name: string;
  diff: string;
  filesChanged: string[];
  recentCommits?: string[];
  context?: string;
}

interface CommitMessageResult {
  repositoryName: string;
  success: boolean;
  message: string | null;
  confidence: number;
  commitType: string | null;
  error: string | null;
}

// Helper function to chunk arrays
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Example 1: Basic parallel commit message generation
 * This uses the built-in parallelism of the generateCommitMessages mutation
 */
export async function generateCommitMessagesBasic(
  repositories: Repository[]
): Promise<CommitMessageResult[]> {
  const GENERATE_COMMIT_MESSAGES = gql`
    mutation GenerateCommitMessages($input: BatchCommitMessageInput!) {
      generateCommitMessages(input: $input) {
        totalRepositories
        successCount
        executionTime
        results {
          repositoryName
          success
          message
          confidence
          commitType
          error
        }
        totalTokenUsage {
          inputTokens
          outputTokens
          estimatedCost
        }
      }
    }
  `;

  try {
    const result = await client.mutate({
      mutation: GENERATE_COMMIT_MESSAGES,
      variables: {
        input: {
          repositories,
          styleGuide: {
            format: 'conventional',
            maxLength: 72,
            includeScope: true
          }
        }
      }
    });

    console.log(`Generated ${result.data.generateCommitMessages.successCount} commit messages in ${result.data.generateCommitMessages.executionTime}ms`);
    console.log(`Estimated cost: $${result.data.generateCommitMessages.totalTokenUsage.estimatedCost.toFixed(4)}`);

    return result.data.generateCommitMessages.results;
  } catch (error) {
    console.error('Failed to generate commit messages:', error);
    throw error;
  }
}

/**
 * Example 2: True parallel execution with field aliases
 * This achieves maximum parallelism by using GraphQL field aliases
 */
export async function generateCommitMessagesParallel(
  repositories: Repository[]
): Promise<CommitMessageResult[]> {
  // Split repositories into optimal chunks (5 per batch based on concurrency limit)
  const chunks = chunkArray(repositories, 5);
  
  // Dynamically build the mutation with field aliases
  const mutation = gql`
    mutation ParallelGeneration {
      ${chunks.map((chunk, index) => `
        batch${index}: generateCommitMessages(input: {
          repositories: [
            ${chunk.map(repo => `{
              path: "${repo.path}"
              name: "${repo.name}"
              diff: """${repo.diff}"""
              filesChanged: ${JSON.stringify(repo.filesChanged)}
              ${repo.recentCommits ? `recentCommits: ${JSON.stringify(repo.recentCommits)}` : ''}
              ${repo.context ? `context: "${repo.context}"` : ''}
            }`).join(',')}
          ]
        }) {
          executionTime
          results {
            repositoryName
            success
            message
            confidence
            commitType
            error
          }
        }
      `).join('\n')}
    }
  `;

  try {
    const startTime = Date.now();
    const result = await client.mutate({ mutation });
    const totalTime = Date.now() - startTime;

    // Aggregate results from all batches
    const allResults: CommitMessageResult[] = [];
    for (const key in result.data) {
      if (key.startsWith('batch')) {
        allResults.push(...result.data[key].results);
      }
    }

    console.log(`Generated ${allResults.length} commit messages in ${totalTime}ms using parallel execution`);
    console.log(`Average time per batch: ${totalTime / chunks.length}ms`);

    return allResults;
  } catch (error) {
    console.error('Failed in parallel generation:', error);
    throw error;
  }
}

/**
 * Example 3: Monitor performance metrics
 */
export async function getPerformanceMetrics(lastMinutes = 60) {
  const GET_METRICS = gql`
    query GetPerformanceMetrics($lastMinutes: Int) {
      performanceMetrics(lastMinutes: $lastMinutes) {
        operations {
          operation
          count
          averageDuration
          p95Duration
          successRate
        }
        parallelComparison {
          parallel {
            averageDuration
          }
          sequential {
            averageDuration
          }
          speedup
          efficiency
        }
      }
    }
  `;

  const result = await client.query({
    query: GET_METRICS,
    variables: { lastMinutes }
  });

  const comparison = result.data.performanceMetrics.parallelComparison;
  if (comparison) {
    console.log(`Parallel execution is ${comparison.speedup.toFixed(1)}x faster`);
    console.log(`Efficiency: ${comparison.efficiency.toFixed(1)}%`);
  }

  return result.data.performanceMetrics;
}

/**
 * Example 4: Real-time subscription for command output
 */
export async function subscribeToCommandOutput(
  sessionId: string,
  onOutput: (output: any) => void
) {
  const COMMAND_OUTPUT_SUBSCRIPTION = gql`
    subscription OnCommandOutput($sessionId: ID!) {
      commandOutput(sessionId: $sessionId) {
        sessionId
        type
        content
        timestamp
        isFinal
        tokens
      }
    }
  `;

  const subscription = client.subscribe({
    query: COMMAND_OUTPUT_SUBSCRIPTION,
    variables: { sessionId }
  }).subscribe({
    next: ({ data }) => {
      onOutput(data.commandOutput);
      if (data.commandOutput.isFinal) {
        subscription.unsubscribe();
      }
    },
    error: (err) => console.error('Subscription error:', err),
    complete: () => console.log('Subscription complete')
  });

  return subscription;
}

/**
 * Example 5: Retry failed operations with exponential backoff
 */
export async function retryFailedCommitGeneration(
  failedRepositories: Repository[],
  maxRetries = 3
): Promise<CommitMessageResult[]> {
  let attempt = 0;
  let lastError: any;

  while (attempt < maxRetries) {
    try {
      // Use smaller batches for retries
      const results = await generateCommitMessagesBasic(failedRepositories);
      
      // Filter out any that still failed
      const stillFailed = results.filter(r => !r.success);
      if (stillFailed.length === 0) {
        return results;
      }

      // Update the list for next retry
      failedRepositories = failedRepositories.filter(repo => 
        stillFailed.some(failed => failed.repositoryName === repo.name)
      );

      attempt++;
      
      // Exponential backoff
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Retrying ${stillFailed.length} failed repositories in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      lastError = error;
      attempt++;
    }
  }

  throw new Error(`Failed after ${maxRetries} attempts: ${lastError}`);
}

/**
 * Example 6: Performance comparison demo
 */
export async function comparePerformance(repositories: Repository[]) {
  console.log(`Comparing performance for ${repositories.length} repositories...\n`);

  // Test sequential execution (simulated by processing one at a time)
  console.log('Testing sequential execution...');
  const sequentialStart = Date.now();
  for (const repo of repositories) {
    await generateCommitMessagesBasic([repo]);
  }
  const sequentialTime = Date.now() - sequentialStart;
  console.log(`Sequential time: ${sequentialTime}ms\n`);

  // Test basic parallel execution
  console.log('Testing basic parallel execution...');
  const parallelStart = Date.now();
  await generateCommitMessagesBasic(repositories);
  const parallelTime = Date.now() - parallelStart;
  console.log(`Basic parallel time: ${parallelTime}ms\n`);

  // Test optimized parallel execution with field aliases
  console.log('Testing optimized parallel execution...');
  const optimizedStart = Date.now();
  await generateCommitMessagesParallel(repositories);
  const optimizedTime = Date.now() - optimizedStart;
  console.log(`Optimized parallel time: ${optimizedTime}ms\n`);

  // Calculate speedups
  console.log('Performance Summary:');
  console.log(`Sequential → Basic Parallel: ${(sequentialTime / parallelTime).toFixed(1)}x speedup`);
  console.log(`Sequential → Optimized Parallel: ${(sequentialTime / optimizedTime).toFixed(1)}x speedup`);
  console.log(`Basic → Optimized: ${(parallelTime / optimizedTime).toFixed(1)}x speedup`);
}

// Example usage
async function main() {
  // Sample repositories
  const repositories: Repository[] = [
    {
      path: '/workspace/package1',
      name: 'package1',
      diff: 'diff --git a/index.js b/index.js\n+console.log("hello");',
      filesChanged: ['index.js']
    },
    {
      path: '/workspace/package2',
      name: 'package2',
      diff: 'diff --git a/test.js b/test.js\n+test("new test", () => {});',
      filesChanged: ['test.js']
    },
    // Add more repositories...
  ];

  try {
    // Run performance comparison
    await comparePerformance(repositories);

    // Get performance metrics
    const metrics = await getPerformanceMetrics(60);
    console.log('\nPerformance Metrics:', metrics);

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}