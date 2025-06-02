#!/usr/bin/env node

import fetch from 'node-fetch';

async function testCommit() {
  console.log('Testing GraphQL commit flow...\n');

  // 1. Check initial status
  console.log('1. Checking initial repository status...');
  const statusResponse = await fetch('http://localhost:3000/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query { 
        isRepositoryClean(path: "packages/ui-components") { 
          isClean 
          uncommittedFiles 
          latestCommitHash 
        } 
      }`
    })
  });
  const statusData = await statusResponse.json();
  console.log('Initial status:', statusData.data.isRepositoryClean);
  
  const previousHash = statusData.data.isRepositoryClean.latestCommitHash;
  console.log('Previous commit hash:', previousHash);

  // 2. Perform commit
  console.log('\n2. Performing commit...');
  const commitResponse = await fetch('http://localhost:3000/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `mutation TestCommit($input: BatchCommitInput!) {
        batchCommit(input: $input) {
          totalRepositories
          successCount
          results {
            success
            commitHash
            error
            repository
            committedFiles
          }
        }
      }`,
      variables: {
        input: {
          commits: [{
            repository: "packages/ui-components",
            message: "test: verify GraphQL commit flow works correctly",
            stageAll: true
          }],
          continueOnError: false
        }
      }
    })
  });
  
  const commitData = await commitResponse.json();
  console.log('Commit response:', JSON.stringify(commitData, null, 2));

  if (commitData.errors) {
    console.error('GraphQL errors:', commitData.errors);
    return;
  }

  const result = commitData.data?.batchCommit?.results?.[0];
  if (!result) {
    console.error('No commit result found');
    return;
  }

  if (result.success) {
    console.log(`\n✅ Commit successful! Hash: ${result.commitHash}`);
    console.log(`Files committed: ${result.committedFiles.length}`);
    
    // 3. Wait and check if repository is clean
    console.log('\n3. Waiting for commit to complete...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const finalStatusResponse = await fetch('http://localhost:3000/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query { 
          isRepositoryClean(path: "packages/ui-components") { 
            isClean 
            uncommittedFiles 
            latestCommitHash 
          } 
        }`
      })
    });
    
    const finalStatus = await finalStatusResponse.json();
    console.log('Final status:', finalStatus.data.isRepositoryClean);
    
    const newHash = finalStatus.data.isRepositoryClean.latestCommitHash;
    console.log('\nHash changed:', previousHash !== newHash);
    console.log('Repository clean:', finalStatus.data.isRepositoryClean.isClean);
  } else {
    console.error(`\n❌ Commit failed: ${result.error}`);
  }
}

testCommit().catch(console.error);