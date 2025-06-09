import { spawn } from 'child_process';
import { createInterface } from 'readline';

// Start the MCP server
const server = spawn('npm', ['run', 'start'], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'pipe']
});

const rl = createInterface({
  input: server.stdout,
  output: process.stdout,
  terminal: false
});

server.stderr.on('data', (data) => {
  console.error(`stderr: ${data}`);
});

server.on('error', (error) => {
  console.error(`Failed to start server: ${error.message}`);
});

rl.on('line', (line) => {
  console.log(`Server: ${line}`);
  
  // After server starts, send test requests
  if (line.includes('MCP Server started')) {
    testMCPServer();
  }
});

async function testMCPServer() {
  console.log('\n🧪 Testing MCP Server...\n');
  
  // Test 1: List tools
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };
  
  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
  
  // Give it time to respond
  setTimeout(() => {
    // Test 2: Call quality check tool
    const qualityCheckRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'quality_check_interactive',
        arguments: {
          filePath: './src/index.ts',
          sessionId: 'test-session-1'
        }
      }
    };
    
    server.stdin.write(JSON.stringify(qualityCheckRequest) + '\n');
  }, 1000);
  
  // Exit after tests
  setTimeout(() => {
    console.log('\n✅ Test completed. Shutting down...');
    server.kill();
    process.exit(0);
  }, 5000);
}

console.log('🚀 Starting Quality Service MCP Server test...');