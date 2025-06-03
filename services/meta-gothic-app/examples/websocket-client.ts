import WebSocket from 'ws';

// WebSocket Event Client Example
// This demonstrates how to connect to the Meta-GOTHIC event stream

const WS_URL = 'ws://localhost:3000/ws/events';
const CORRELATION_ID = 'test-correlation-' + Date.now();

console.log('🔌 Connecting to Meta-GOTHIC Event Stream...');
console.log(`📍 URL: ${WS_URL}`);
console.log(`🔑 Correlation ID: ${CORRELATION_ID}`);

const ws = new WebSocket(WS_URL, {
  headers: {
    'x-correlation-id': CORRELATION_ID
  }
});

// Connection opened
ws.on('open', () => {
  console.log('✅ Connected to event stream\n');
  
  // Subscribe to specific event types
  console.log('📡 Subscribing to events...');
  ws.send(JSON.stringify({
    type: 'subscribe',
    payload: {
      eventTypes: [
        'claude.*',           // All Claude events
        'repo.*',            // All repository events
        'github.api.*',      // All GitHub API events
        'performance.*',     // All performance events
        'graphql.query.*',   // All GraphQL queries
        'graphql.mutation.*' // All GraphQL mutations
      ],
      correlationId: CORRELATION_ID
    }
  }));
  
  // Send a ping to test connection
  setTimeout(() => {
    console.log('\n🏓 Sending ping...');
    ws.send(JSON.stringify({
      type: 'ping',
      payload: { timestamp: Date.now() }
    }));
  }, 1000);
});

// Message received
ws.on('message', (data) => {
  try {
    const event = JSON.parse(data.toString());
    
    // Format output based on event type
    switch (event.type) {
      case 'websocket.connected':
        console.log('🤝 Welcome message received:', event.payload);
        break;
        
      case 'websocket.subscribed':
        console.log('✅ Subscribed to events:', event.payload.eventTypes);
        console.log('\n🎯 Waiting for events...\n');
        break;
        
      case 'pong':
        console.log('🏓 Pong received:', event.payload);
        break;
        
      case 'performance.slowOperation.detected':
        console.log('⚠️  SLOW OPERATION DETECTED');
        console.log(`   Service: ${event.payload.service}`);
        console.log(`   Operation: ${event.payload.operation}`);
        console.log(`   Duration: ${event.payload.duration}ms`);
        console.log(`   Threshold: ${event.payload.threshold}ms`);
        console.log(`   Exceeded by: ${event.payload.duration - event.payload.threshold}ms\n`);
        break;
        
      case 'github.api.completed':
        console.log('🐙 GitHub API Call');
        console.log(`   Endpoint: ${event.payload.endpoint}`);
        console.log(`   Method: ${event.payload.method}`);
        console.log(`   Status: ${event.payload.statusCode}`);
        console.log(`   Duration: ${event.payload.duration}ms`);
        if (event.payload.rateLimitRemaining) {
          console.log(`   Rate Limit Remaining: ${event.payload.rateLimitRemaining}`);
        }
        console.log('');
        break;
        
      case 'claude.session.started':
        console.log('🤖 Claude Session Started');
        console.log(`   Session ID: ${event.payload.sessionId}`);
        console.log(`   Working Dir: ${event.payload.workingDirectory}`);
        console.log('');
        break;
        
      case 'repo.commit.created':
        console.log('💾 Git Commit Created');
        console.log(`   Path: ${event.payload.path}`);
        console.log(`   Hash: ${event.payload.commitHash}`);
        console.log(`   Message: ${event.payload.message}`);
        console.log('');
        break;
        
      default:
        if (event.type.startsWith('graphql.')) {
          const [, operation, phase] = event.type.split('.');
          if (phase === 'started') {
            console.log(`📊 GraphQL ${operation} started: ${event.payload.operationName || 'anonymous'}`);
          } else if (phase === 'completed') {
            console.log(`✅ GraphQL ${operation} completed: ${event.payload.operationName || 'anonymous'} (${event.payload.duration}ms)`);
          }
        } else {
          console.log(`📨 Event: ${event.type}`);
          console.log('   Payload:', JSON.stringify(event.payload, null, 2));
        }
    }
  } catch (error) {
    console.error('❌ Error parsing message:', error);
  }
});

// Connection closed
ws.on('close', () => {
  console.log('\n🔌 Disconnected from event stream');
  process.exit(0);
});

// Error occurred
ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Closing connection...');
  ws.close();
});

console.log('\nPress Ctrl+C to exit\n');