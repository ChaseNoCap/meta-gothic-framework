import { spawn } from 'child_process';

console.log('🚀 Starting MCP Server test...\n');

// Start the MCP server
const server = spawn('npm', ['run', 'start:mcp'], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'development' }
});

// Capture server output
server.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('📥 Server output:', output);
  
  // Parse JSON-RPC responses
  try {
    const lines = output.split('\n').filter(line => line.trim());
    for (const line of lines) {
      if (line.startsWith('{')) {
        const response = JSON.parse(line);
        console.log('✅ Parsed response:', JSON.stringify(response, null, 2));
      }
    }
  } catch (e) {
    // Not JSON, just regular output
  }
});

server.stderr.on('data', (data) => {
  console.error('❌ Server error:', data.toString());
});

server.on('error', (error) => {
  console.error('❌ Failed to start server:', error.message);
  process.exit(1);
});

// Send test requests after a delay to let server start
setTimeout(async () => {
  console.log('\n🧪 Sending test requests...\n');
  
  // Test 1: List tools
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };
  
  console.log('📤 Request 1 - List tools:', JSON.stringify(listToolsRequest));
  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
  
  // Wait a bit then send quality check request
  setTimeout(() => {
    const qualityCheckRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'quality_check_interactive',
        arguments: {
          filePath: process.cwd() + '/src/index.ts',
          sessionId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'  // Valid UUID
        }
      }
    };
    
    console.log('\n📤 Request 2 - Quality check:', JSON.stringify(qualityCheckRequest));
    server.stdin.write(JSON.stringify(qualityCheckRequest) + '\n');
  }, 2000);
  
  // Exit after tests
  setTimeout(() => {
    console.log('\n✅ Test completed. Shutting down...');
    server.kill('SIGTERM');
    setTimeout(() => process.exit(0), 1000);
  }, 5000);
}, 3000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Interrupted. Shutting down...');
  server.kill('SIGTERM');
  process.exit(0);
});