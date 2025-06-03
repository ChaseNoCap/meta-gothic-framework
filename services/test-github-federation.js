#!/usr/bin/env node

/**
 * Test script to verify GitHub operations through GraphQL federation gateway
 * Tests the OpenAPI transformation of GitHub REST API to GraphQL
 */

const fetch = require('node-fetch');

const GATEWAY_URL = 'http://localhost:3000/graphql';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error('❌ Error: GITHUB_TOKEN environment variable is required');
  console.error('   Set it with: export GITHUB_TOKEN=your_github_token');
  process.exit(1);
}

// Test queries
const queries = {
  // Test 1: List workflow runs
  listWorkflowRuns: `
    query TestWorkflowRuns {
      GitHub_actionsListWorkflowRunsForRepo(
        owner: "ChaseNoCap"
        repo: "meta-gothic-framework"
        per_page: 5
      ) {
        total_count
        workflow_runs {
          id
          name
          display_title
          status
          conclusion
          workflow_id
          run_number
          created_at
          updated_at
        }
      }
    }
  `,

  // Test 2: List repository issues
  listIssues: `
    query TestIssues {
      GitHub_issuesListForRepo(
        owner: "ChaseNoCap"
        repo: "meta-gothic-framework"
        state: "open"
        per_page: 5
      ) {
        id
        number
        title
        state
        created_at
        user {
          login
          avatar_url
        }
      }
    }
  `,

  // Test 3: List pull requests
  listPullRequests: `
    query TestPullRequests {
      GitHub_pullsList(
        owner: "ChaseNoCap"
        repo: "meta-gothic-framework"
        state: "open"
        per_page: 5
      ) {
        id
        number
        title
        state
        created_at
        user {
          login
        }
        head {
          ref
          sha
        }
      }
    }
  `,

  // Test 4: Get authenticated user repositories
  getUserRepos: `
    query TestUserRepos {
      GitHub_reposListForAuthenticatedUser(
        per_page: 10
        sort: "updated"
      ) {
        id
        name
        full_name
        private
        description
        created_at
        updated_at
        language
        stargazers_count
      }
    }
  `
};

// Test mutations
const mutations = {
  // Test dispatch workflow (commented out to avoid actually triggering)
  dispatchWorkflow: `
    # mutation TestDispatchWorkflow {
    #   GitHub_actionsCreateWorkflowDispatch(
    #     owner: "ChaseNoCap"
    #     repo: "meta-gothic-framework"
    #     workflow_id: "test.yml"
    #     ref: "main"
    #     inputs: {}
    #   ) {
    #     status
    #   }
    # }
  `
};

async function executeQuery(name, query) {
  console.log(`\n📊 Testing: ${name}`);
  console.log('━'.repeat(50));
  
  try {
    const response = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GITHUB_TOKEN}`
      },
      body: JSON.stringify({ query })
    });

    const data = await response.json();
    
    if (data.errors) {
      console.error('❌ GraphQL Errors:', JSON.stringify(data.errors, null, 2));
      return false;
    }

    console.log('✅ Success! Response:');
    console.log(JSON.stringify(data.data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Network Error:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Testing GitHub Operations through GraphQL Federation Gateway');
  console.log('=' .repeat(60));
  console.log(`Gateway URL: ${GATEWAY_URL}`);
  console.log(`GitHub Token: ${GITHUB_TOKEN.substring(0, 8)}...`);
  
  let successCount = 0;
  let totalTests = 0;

  // First, check if the gateway is running
  console.log('\n🔍 Checking gateway health...');
  try {
    const healthResponse = await fetch(GATEWAY_URL.replace('/graphql', '/health'));
    if (!healthResponse.ok) {
      throw new Error(`Health check failed: ${healthResponse.status}`);
    }
    console.log('✅ Gateway is healthy');
  } catch (error) {
    console.error('❌ Gateway health check failed:', error.message);
    console.error('\n⚠️  Make sure the GraphQL Mesh gateway is running:');
    console.error('   cd services/meta-gothic-app');
    console.error('   npm run dev:mesh');
    process.exit(1);
  }

  // Run queries
  for (const [name, query] of Object.entries(queries)) {
    totalTests++;
    if (await executeQuery(name, query)) {
      successCount++;
    }
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📈 Test Summary:');
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   Passed: ${successCount}`);
  console.log(`   Failed: ${totalTests - successCount}`);
  
  if (successCount === totalTests) {
    console.log('\n🎉 All tests passed! GitHub operations working through federation gateway.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
  }

  // Additional notes
  console.log('\n💡 Notes:');
  console.log('- GitHub REST API operations are transformed to GraphQL via OpenAPI handler');
  console.log('- All operations use the GitHub_ prefix in the schema');
  console.log('- Authentication is passed through the Authorization header');
  console.log('- The gateway handles REST→GraphQL transformation automatically');
}

// Run the tests
runTests().catch(console.error);