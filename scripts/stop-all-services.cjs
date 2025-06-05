#!/usr/bin/env node

const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

log('\n🛑 Stopping all Meta-GOTHIC services...', 'yellow');

// Services and their ports
const services = [
  { name: 'UI Components', port: 3001 },
  { name: 'GraphQL Gateway', port: 3000 },
  { name: 'Claude Service', port: 3002 },
  { name: 'Repo Agent Service', port: 3004 }
];

// Kill by port - more aggressive approach
services.forEach(service => {
  try {
    if (process.platform === 'darwin' || process.platform === 'linux') {
      // First try graceful kill
      try {
        execSync(`lsof -ti:${service.port} | xargs kill`, { stdio: 'ignore' });
        // Give it a moment to shut down
        execSync('sleep 0.5', { stdio: 'ignore' });
      } catch (e) {
        // Ignore graceful kill errors
      }
      // Then force kill any remaining
      execSync(`lsof -ti:${service.port} | xargs kill -9`, { stdio: 'ignore' });
    } else {
      // Windows
      execSync(`netstat -ano | findstr :${service.port} | findstr LISTENING`, { stdio: 'ignore' });
    }
    log(`  ✓ Stopped ${service.name} on port ${service.port}`, 'green');
  } catch (e) {
    log(`  - ${service.name} was not running on port ${service.port}`, 'yellow');
  }
});

// Also kill by process name
try {
  execSync('pkill -f "claude-service|repo-agent|meta-gothic|ui-components|vite"', { stdio: 'ignore' });
  log('  ✓ Killed all related processes', 'green');
} catch (e) {
  // Processes might not exist
}

// Kill any node processes on our ports
try {
  execSync('pkill -f "node.*3000|node.*3001|node.*3002|node.*3004"', { stdio: 'ignore' });
} catch (e) {
  // Ignore
}

// Kill any tsx processes
try {
  execSync('pkill -f "tsx watch"', { stdio: 'ignore' });
  execSync('pkill -f "tsx src"', { stdio: 'ignore' });
} catch (e) {
  // Ignore
}

// Final cleanup - kill anything still listening on our ports
services.forEach(service => {
  try {
    execSync(`lsof -ti:${service.port} | xargs kill -9`, { stdio: 'ignore' });
  } catch (e) {
    // Port is clear
  }
});

log('\n✅ All services stopped and ports cleared\n', 'green');