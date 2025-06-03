import WebSocket from 'ws';

async function testWebSocket() {
  console.log('Testing WebSocket connection to gateway...');
  
  const ws = new WebSocket('ws://localhost:3001/graphql', 'graphql-transport-ws');

  ws.on('open', () => {
    console.log('✅ WebSocket connected!');
    
    // Send connection init
    ws.send(JSON.stringify({
      type: 'connection_init'
    }));
  });

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('Received:', message);
    
    if (message.type === 'connection_ack') {
      console.log('✅ Connection acknowledged!');
      
      // Send a subscription
      ws.send(JSON.stringify({
        id: '1',
        type: 'subscribe',
        payload: {
          query: `subscription {
            commandOutput(sessionId: "test") {
              type
              data
              timestamp
            }
          }`
        }
      }));
      
      // Close after 5 seconds
      setTimeout(() => {
        console.log('Closing connection...');
        ws.close();
      }, 5000);
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });

  ws.on('close', () => {
    console.log('WebSocket closed');
  });
}

testWebSocket().catch(console.error);