import { createClient } from 'graphql-ws';
import WebSocket from 'ws';

const client = createClient({
  url: 'ws://localhost:3001/graphql',
  webSocketImpl: WebSocket,
});

async function testSubscriptions() {
  console.log('Testing WebSocket subscriptions...');

  // Test 1: Command Output Subscription
  console.log('\n1. Testing commandOutput subscription:');
  
  // First we need a session - let's create one
  const createSessionQuery = `
    mutation CreateSession {
      executeCommand(
        input: {
          prompt: "run echo 'Hello from subscription test'"
          workingDirectory: "/tmp"
        }
      ) {
        sessionId
        success
      }
    }
  `;

  // Execute the mutation to get a session ID
  const response = await fetch('http://localhost:3001/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: createSessionQuery }),
  });

  const result = await response.json();
  console.log('Created session:', result);

  if (!result.data?.executeCommand?.sessionId) {
    console.error('Failed to create session');
    return;
  }

  const sessionId = result.data.executeCommand.sessionId;

  // Subscribe to command output
  console.log(`Subscribing to commandOutput for session: ${sessionId}`);
  
  const unsubscribe = client.subscribe(
    {
      query: `
        subscription CommandOutput($sessionId: ID!) {
          commandOutput(sessionId: $sessionId) {
            type
            data
            timestamp
          }
        }
      `,
      variables: { sessionId },
    },
    {
      next: (data) => console.log('Received:', data),
      error: (err) => console.error('Error:', err),
      complete: () => console.log('Subscription complete'),
    }
  );

  // Wait for events
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('\nUnsubscribing...');
  unsubscribe();

  // Test 2: Agent Run Progress
  console.log('\n2. Testing agentRunProgress subscription:');
  
  // Create an agent run
  const createRunQuery = `
    mutation CreateRun {
      createAgentRun(
        input: {
          repositoryPath: "/tmp/test-repo"
          task: "Test subscription"
          sessionId: "${sessionId}"
        }
      ) {
        id
        status
      }
    }
  `;

  const runResponse = await fetch('http://localhost:3001/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: createRunQuery }),
  });

  const runResult = await runResponse.json();
  console.log('Created run:', runResult);

  if (runResult.data?.createAgentRun?.id) {
    const runId = runResult.data.createAgentRun.id;
    
    const runUnsubscribe = client.subscribe(
      {
        query: `
          subscription AgentRunProgress($runId: ID!) {
            agentRunProgress(runId: $runId) {
              id
              status
              progress
              currentStep
            }
          }
        `,
        variables: { runId },
      },
      {
        next: (data) => console.log('Run progress:', data),
        error: (err) => console.error('Run error:', err),
        complete: () => console.log('Run subscription complete'),
      }
    );

    await new Promise(resolve => setTimeout(resolve, 3000));
    runUnsubscribe();
  }

  // Clean up
  console.log('\nClosing WebSocket connection...');
  await client.dispose();
  console.log('Test complete!');
}

testSubscriptions().catch(console.error);