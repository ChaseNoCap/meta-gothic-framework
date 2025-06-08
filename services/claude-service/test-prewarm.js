// Use built-in fetch if available, otherwise fall back to node-fetch
const fetch = globalThis.fetch || (await import('node-fetch')).default;

const GRAPHQL_ENDPOINT = 'http://localhost:3012/graphql';
const SSE_ENDPOINT = 'http://localhost:3012/graphql/stream';

// Test queries and mutations
const queries = {
  preWarmStatus: `
    query PreWarmStatus {
      preWarmStatus {
        status
        sessionId
        timestamp
        error
      }
    }
  `,
  
  preWarmMetrics: `
    query PreWarmMetrics {
      preWarmMetrics {
        configured {
          poolSize
          maxSessionAge
          cleanupInterval
          warmupTimeout
        }
        current {
          total
          ready
          warming
          claimed
          isWarming
        }
        sessions {
          sessionId
          claudeSessionId
          status
          age
          createdAt
        }
      }
    }
  `,
  
  claimPreWarmedSession: `
    mutation ClaimPreWarmedSession {
      claimPreWarmedSession {
        success
        sessionId
        status
        error
      }
    }
  `,
  
  executeCommand: `
    mutation ExecuteCommand($sessionId: ID, $prompt: String!) {
      executeCommand(input: { sessionId: $sessionId, prompt: $prompt }) {
        sessionId
        success
        error
        initialResponse
        metadata {
          startTime
          pid
        }
      }
    }
  `
};

// GraphQL request helper
async function graphqlRequest(query, variables = {}) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  
  return response.json();
}

// SSE subscription helper
function subscribeToPreWarmStatus() {
  console.log('\n📡 Subscribing to pre-warm status updates...');
  
  const body = JSON.stringify({
    query: `
      subscription PreWarmStatus {
        preWarmStatus {
          status
          sessionId
          timestamp
          error
        }
      }
    `
  });
  
  // Note: Node.js fetch doesn't support streaming responses well
  // So we'll skip the subscription test for now
  console.log('⚠️  SSE subscription test skipped (Node.js limitation)');
}

// Main test sequence
async function runTests() {
  console.log('🧪 Testing Claude Service Pre-warming Feature\n');
  
  // 1. Check initial pre-warm status
  console.log('1️⃣ Checking initial pre-warm status...');
  const statusResult = await graphqlRequest(queries.preWarmStatus);
  console.log('Pre-warm status:', statusResult.data?.preWarmStatus);
  
  // 2. Get pre-warm metrics
  console.log('\n2️⃣ Getting pre-warm metrics...');
  const metricsResult = await graphqlRequest(queries.preWarmMetrics);
  console.log('Pre-warm metrics:', JSON.stringify(metricsResult.data?.preWarmMetrics, null, 2));
  
  // 3. Start subscription (in background)
  subscribeToPreWarmStatus();
  
  // 4. Wait a bit for pre-warming to complete
  console.log('\n⏳ Waiting 5 seconds for pre-warming to complete...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // 5. Check status again
  console.log('\n3️⃣ Checking pre-warm status after wait...');
  const statusResult2 = await graphqlRequest(queries.preWarmStatus);
  console.log('Pre-warm status:', statusResult2.data?.preWarmStatus);
  
  // 6. Claim a pre-warmed session
  console.log('\n4️⃣ Claiming a pre-warmed session...');
  const claimResult = await graphqlRequest(queries.claimPreWarmedSession);
  console.log('Claim result:', claimResult.data?.claimPreWarmedSession);
  
  if (claimResult.data?.claimPreWarmedSession?.success) {
    const sessionId = claimResult.data.claimPreWarmedSession.sessionId;
    
    // 7. Use the claimed session
    console.log('\n5️⃣ Using the claimed session...');
    const executeResult = await graphqlRequest(queries.executeCommand, {
      sessionId,
      prompt: 'What is 2 + 2?'
    });
    console.log('Execute result:', executeResult.data?.executeCommand);
  }
  
  // 8. Check metrics again to see the change
  console.log('\n6️⃣ Checking metrics after claim...');
  const metricsResult2 = await graphqlRequest(queries.preWarmMetrics);
  console.log('Updated metrics:', JSON.stringify(metricsResult2.data?.preWarmMetrics, null, 2));
  
  // 9. Wait for new pre-warming
  console.log('\n⏳ Waiting 10 seconds for new pre-warming...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // 10. Final status check
  console.log('\n7️⃣ Final status check...');
  const finalStatus = await graphqlRequest(queries.preWarmStatus);
  console.log('Final status:', finalStatus.data?.preWarmStatus);
  
  console.log('\n✅ Test complete!');
}

// Run the tests
runTests().catch(console.error);