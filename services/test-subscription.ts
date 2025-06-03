import { WebSocket } from 'ws';

const ws = new WebSocket('ws://localhost:3002/graphql', {
  protocols: ['graphql-ws']
});

ws.on('open', () => {
  console.log('Connected to WebSocket');
  
  // Send connection init
  ws.send(JSON.stringify({
    type: 'connection_init',
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('Received:', message);
  
  if (message.type === 'connection_ack') {
    console.log('Connection acknowledged, subscribing...');
    
    // Subscribe to commandOutput
    ws.send(JSON.stringify({
      id: '1',
      type: 'subscribe',
      payload: {
        query: `
          subscription CommandOutput($sessionId: ID!) {
            commandOutput(sessionId: $sessionId) {
              sessionId
              type
              content
              timestamp
              isFinal
            }
          }
        `,
        variables: {
          sessionId: 'test-session-123'
        }
      }
    }));
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', () => {
  console.log('WebSocket closed');
});

// Keep the process running
setTimeout(() => {
  console.log('Closing connection...');
  ws.close();
}, 30000);