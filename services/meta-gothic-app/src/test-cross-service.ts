import fetch from 'node-fetch';

async function testCrossServiceQuery() {
  console.log('🧪 Testing Cross-Service Query...\n');

  const query = `
    query CrossServiceTest {
      # From claude-service
      health {
        healthy
        version
        claudeAvailable
        activeSessions
      }
      
      # From repo-agent-service
      gitStatus(path: "/Users/josh/Documents/meta-gothic-framework") {
        branch
        isDirty
        ahead
        behind
        files {
          path
          status
        }
      }
      
      # From claude-service
      sessions {
        id
        status
        workingDirectory
      }
      
      # From repo-agent-service
      scanAllRepositories {
        name
        path
        isDirty
        branch
      }
    }
  `;

  try {
    const response = await fetch('http://localhost:3000/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const result = await response.json();
    
    if (result.errors) {
      console.error('❌ GraphQL Errors:', result.errors);
    } else {
      console.log('✅ Cross-Service Query Success!');
      console.log('\n📊 Results:');
      console.log('- Health:', result.data.health);
      console.log('- Git Status:', {
        branch: result.data.gitStatus.branch,
        isDirty: result.data.gitStatus.isDirty,
        fileCount: result.data.gitStatus.files.length
      });
      console.log('- Active Sessions:', result.data.sessions.length);
      console.log('- Repositories Found:', result.data.scanAllRepositories.length);
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

// Test mutation from both services
async function testCrossServiceMutation() {
  console.log('\n🧪 Testing Cross-Service Mutation...\n');

  const mutation = `
    mutation TestMutation($prompt: String!) {
      # Claude service mutation
      executeCommand(input: {
        prompt: $prompt
        workingDirectory: "/tmp"
      }) {
        sessionId
        success
        error
      }
    }
  `;

  try {
    const response = await fetch('http://localhost:3000/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query: mutation,
        variables: {
          prompt: "test from cross-service"
        }
      }),
    });

    const result = await response.json();
    
    if (result.errors) {
      console.error('❌ Mutation Errors:', result.errors);
    } else {
      console.log('✅ Mutation Success!');
      console.log('- Session ID:', result.data.executeCommand.sessionId);
      console.log('- Success:', result.data.executeCommand.success);
    }
  } catch (error) {
    console.error('❌ Mutation failed:', error);
  }
}

// Run tests
async function runTests() {
  await testCrossServiceQuery();
  await testCrossServiceMutation();
  console.log('\n✨ Tests complete!');
}

runTests().catch(console.error);