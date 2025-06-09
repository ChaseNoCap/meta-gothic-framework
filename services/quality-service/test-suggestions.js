import { spawn } from 'child_process';

console.log('🚀 Testing MCP Suggestions Tool...\n');

const server = spawn('npm', ['run', 'start:mcp'], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'development' }
});

let responseBuffer = '';

server.stdout.on('data', (data) => {
  responseBuffer += data.toString();
  const lines = responseBuffer.split('\n');
  
  // Process complete lines
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    if (line.startsWith('{')) {
      try {
        const response = JSON.parse(line);
        if (response.result) {
          console.log('✅ Tool response received');
          console.log('\nSuggestions content:');
          console.log(response.result.content[0].text);
          console.log('\nMetadata:', JSON.stringify(response.result.metadata, null, 2));
        }
      } catch (e) {
        // Not a JSON response
      }
    }
  }
  
  // Keep the incomplete line in buffer
  responseBuffer = lines[lines.length - 1];
});

server.stderr.on('data', (data) => {
  const error = data.toString();
  if (error.includes('error')) {
    console.error('❌ Server error:', error);
  }
});

// Wait for server to start then send request
setTimeout(() => {
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'get_quality_suggestions',
      arguments: {
        filePath: process.cwd() + '/src/index.ts',
        sessionId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
        violationType: 'eslint',
        maxSuggestions: 5
      }
    }
  };
  
  console.log('📤 Sending suggestions request...\n');
  server.stdin.write(JSON.stringify(request) + '\n');
  
  // Exit after response
  setTimeout(() => {
    server.kill('SIGTERM');
    process.exit(0);
  }, 3000);
}, 2000);