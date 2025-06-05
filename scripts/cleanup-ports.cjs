#!/usr/bin/env node

const { exec } = require('child_process');
const net = require('net');

// Ports to clean
const ports = [3000, 3001, 3002, 3004];

// Process patterns to kill
const processPatterns = [
  'node.*meta-gothic',
  'node.*claude-service',
  'node.*repo-agent',
  'node.*yoga',
  'node.*gateway',
  'node.*ecosystem.config',
  'node.*vite',
  'pm2.*'
];

// Colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Kill process on a specific port
function killPort(port) {
  return new Promise((resolve) => {
    exec(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, (error) => {
      resolve();
    });
  });
}

// Kill processes by pattern
function killByPattern(pattern) {
  return new Promise((resolve) => {
    exec(`pkill -f "${pattern}" 2>/dev/null || true`, (error) => {
      resolve();
    });
  });
}

// Check if a port is in use
function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

async function main() {
  log('\n🧹 Aggressive Port & Process Cleanup', 'yellow');
  log('====================================\n', 'reset');
  
  // Kill PM2
  log('Stopping PM2...', 'blue');
  await new Promise(resolve => {
    exec('pm2 kill 2>/dev/null || true', () => resolve());
  });
  
  // Kill by patterns
  log('Killing processes by pattern...', 'blue');
  for (const pattern of processPatterns) {
    await killByPattern(pattern);
  }
  
  // Kill by ports
  log('Killing processes by port...', 'blue');
  for (const port of ports) {
    const inUse = await checkPort(port);
    if (inUse) {
      log(`  Port ${port} in use, killing...`, 'yellow');
      await killPort(port);
    } else {
      log(`  Port ${port} is free`, 'green');
    }
  }
  
  // Final cleanup with ps
  log('\nFinal cleanup...', 'blue');
  await new Promise(resolve => {
    exec(`ps aux | grep -E "node.*(meta-gothic|claude|repo-agent|yoga|gateway|vite)" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null || true`, () => {
      resolve();
    });
  });
  
  log('\n✓ Cleanup complete!', 'green');
}

main().catch(error => {
  log(`Error: ${error.message}`, 'red');
  process.exit(1);
});