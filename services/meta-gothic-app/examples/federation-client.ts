#!/usr/bin/env tsx

/**
 * Example client demonstrating how to use the Meta GOTHIC Federation Gateway
 */

const GATEWAY_URL = 'http://localhost:3000/graphql';

// Helper function to execute GraphQL queries
async function graphqlQuery(query: string, variables?: Record<string, any>) {
  const response = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const result = await response.json();
  
  if (result.errors) {
    console.error('GraphQL Errors:', result.errors);
  }
  
  return result;
}

// Example queries demonstrating federation capabilities
async function runExamples() {
  console.log('🌐 Meta GOTHIC Federation Gateway Examples\n');

  // 1. Health check (from Claude service)
  console.log('1. Checking service health...');
  const healthResult = await graphqlQuery(`
    query {
      health {
        status
        claudeAvailable
      }
    }
  `);
  console.log('Health:', healthResult.data?.health);
  console.log('');

  // 2. Repository scan (from Repo Agent service)
  console.log('2. Scanning all repositories...');
  const scanResult = await graphqlQuery(`
    query {
      scanAllRepositories {
        name
        path
        isDirty
        branch
        uncommittedCount
      }
    }
  `);
  console.log(`Found ${scanResult.data?.scanAllRepositories?.length || 0} repositories`);
  scanResult.data?.scanAllRepositories?.forEach((repo: any) => {
    if (repo.isDirty) {
      console.log(`  - ${repo.name}: ${repo.uncommittedCount} uncommitted files on ${repo.branch}`);
    }
  });
  console.log('');

  // 3. Check if current directory is clean
  console.log('3. Checking if current directory is clean...');
  const cleanResult = await graphqlQuery(`
    query CheckClean($path: String!) {
      isRepositoryClean(path: $path) {
        isClean
        uncommittedFiles
        latestCommitHash
      }
    }
  `, { path: '.' });
  console.log('Repository status:', cleanResult.data?.isRepositoryClean);
  console.log('');

  // 4. Combined query demonstrating federation
  console.log('4. Running federated query across services...');
  const federatedResult = await graphqlQuery(`
    query FederatedStatus {
      # From Claude service
      health {
        status
        claudeAvailable
      }
      sessions {
        id
        status
      }
      
      # From Repo Agent service
      scanAllRepositories {
        name
        isDirty
      }
    }
  `);
  console.log('Federated results:');
  console.log('  Claude status:', federatedResult.data?.health?.status);
  console.log('  Active sessions:', federatedResult.data?.sessions?.length || 0);
  console.log('  Repositories:', federatedResult.data?.scanAllRepositories?.length || 0);
  console.log('');

  // 5. Example mutation for generating commit messages
  console.log('5. Example: Generate commit messages (mutation)...');
  console.log('Note: This would normally include repository changes');
  const mutationExample = `
    mutation GenerateMessages($input: BatchCommitMessageInput!) {
      generateCommitMessages(input: $input) {
        totalRepositories
        successCount
        results {
          repositoryName
          success
          message
          confidence
        }
      }
    }
  `;
  console.log('Mutation structure:', mutationExample);
}

// Run the examples
runExamples().catch(console.error);