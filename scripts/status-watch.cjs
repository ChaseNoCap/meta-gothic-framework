#!/usr/bin/env node

const http = require('http');
const { execSync, spawn } = require('child_process');
const readline = require('readline');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  clear: '\x1b[2J\x1b[H'
};

const services = [
  {
    name: 'UI Components',
    port: 3001,
    url: 'http://localhost:3001',
    type: 'Frontend'
  },
  {
    name: 'GraphQL Gateway',
    port: 3000,
    url: 'http://localhost:3000/health',
    type: 'API Gateway',
    isHealth: true
  },
  {
    name: 'Claude Service',
    port: 3002,
    url: 'http://localhost:3002/graphql',
    type: 'GraphQL Service',
    isGraphQL: true,
    healthQuery: '{ claudeHealth { healthy } }'
  },
  {
    name: 'Repo Agent Service',
    port: 3004,
    url: 'http://localhost:3004/graphql',
    type: 'GraphQL Service',
    isGraphQL: true,
    healthQuery: '{ repoAgentHealth { status } }'
  }
];

function log(message, color = 'reset', newline = true) {
  const output = `${colors[color]}${message}${colors.reset}`;
  if (newline) {
    console.log(output);
  } else {
    process.stdout.write(output);
  }
}

async function checkService(service) {
  return new Promise((resolve) => {
    const urlParts = new URL(service.url);
    
    const options = {
      hostname: urlParts.hostname,
      port: urlParts.port,
      path: urlParts.pathname,
      method: service.isGraphQL ? 'POST' : 'GET',
      timeout: 1000,
      headers: service.isGraphQL ? {
        'Content-Type': 'application/json',
      } : {}
    };
    
    const request = http.request(options, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    
    request.on('error', () => resolve(false));
    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
    
    if (service.isGraphQL) {
      const query = service.healthQuery || '{ __schema { queryType { name } } }';
      request.write(JSON.stringify({ query }));
    }
    
    request.end();
  });
}

function getProcessInfo(port) {
  try {
    const pid = execSync(`lsof -ti:${port}`, { encoding: 'utf8' }).trim().split('\n')[0];
    if (pid) {
      return { pid, running: true };
    }
  } catch (e) {
    return { pid: null, running: false };
  }
  return { pid: null, running: false };
}

async function displayStatus() {
  // Clear screen and move cursor to top
  process.stdout.write(colors.clear);
  
  const timestamp = new Date().toLocaleTimeString();
  log(`📊 Meta-GOTHIC Services Status - ${timestamp}`, 'blue');
  log('─'.repeat(50), 'gray');
  
  let allHealthy = true;
  const statusInfo = [];
  
  for (const service of services) {
    const processInfo = getProcessInfo(service.port);
    const isResponding = await checkService(service);
    const status = processInfo.running && isResponding;
    
    allHealthy = allHealthy && status;
    
    const statusIcon = status ? '✅' : '❌';
    const statusText = status ? 'Running' : 'Stopped';
    const statusColor = status ? 'green' : 'red';
    
    statusInfo.push({
      service,
      processInfo,
      isResponding,
      status
    });
    
    log(`\n${statusIcon} ${service.name} (${service.type})`, statusColor);
    log(`   Port: ${service.port}`, 'gray');
    log(`   URL: ${service.url}`, 'gray');
    
    if (processInfo.pid) {
      log(`   PID: ${processInfo.pid}`, 'gray');
    }
    
    if (!status) {
      if (processInfo.running && !isResponding) {
        log(`   ⚠️  Process running but not responding`, 'yellow');
      } else {
        log(`   ⚠️  Service is not running`, 'yellow');
      }
    }
  }
  
  log('\n' + '─'.repeat(50), 'gray');
  
  if (allHealthy) {
    log('✅ All services are running!', 'green');
  } else {
    log('❌ Some services are not running', 'red');
  }
  
  log('\n📋 Commands:', 'cyan');
  log('  [R] Restart all services', 'yellow');
  log('  [S] Stop all services', 'yellow');
  log('  [Q] Quit status monitor', 'yellow');
  log('\nPress a key to select an option...', 'gray');
  
  return statusInfo;
}


async function stopServices() {
  log('\n🛑 Stopping all services...', 'yellow');
  
  try {
    // Run the stop script
    const stop = spawn('npm', ['run', 'stop'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    
    await new Promise((resolve, reject) => {
      stop.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Stop failed with code ${code}`));
        }
      });
      stop.on('error', reject);
    });
    
    log('\n✅ All services stopped!', 'green');
    log('Press any key to continue...', 'gray');
    
  } catch (error) {
    log(`\n❌ Failed to stop services: ${error.message}`, 'red');
    log('Press any key to continue...', 'gray');
  }
}

async function main() {
  // Set up readline for keyboard input
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  
  let running = true;
  let refreshInterval;
  let waitingForKeypress = false;
  
  // Initial display
  await displayStatus();
  
  // Set up auto-refresh every 2 seconds
  refreshInterval = setInterval(async () => {
    if (!waitingForKeypress) {
      await displayStatus();
    }
  }, 2000);
  
  // Handle keyboard input
  process.stdin.on('keypress', async (str, key) => {
    if (waitingForKeypress) {
      // Any key continues after an action
      waitingForKeypress = false;
      await displayStatus();
      return;
    }
    
    if (key && key.ctrl && key.name === 'c') {
      // Ctrl+C to exit
      running = false;
      clearInterval(refreshInterval);
      process.stdout.write(colors.clear);
      log('\n👋 Exiting status monitor...', 'yellow');
      process.exit(0);
    }
    
    const input = str ? str.toLowerCase() : '';
    
    switch (input) {
      case 'q':
        // Quit
        running = false;
        clearInterval(refreshInterval);
        process.stdout.write(colors.clear);
        log('\n👋 Exiting status monitor...', 'yellow');
        process.exit(0);
        break;
        
      case 'r':
        // Restart services
        waitingForKeypress = true;
        clearInterval(refreshInterval);
        log('\n🔄 Restarting all services...', 'cyan');
        
        try {
          // Stop all services first
          execSync('npm run stop', { 
            cwd: path.join(__dirname, '..'),
            stdio: 'inherit'
          });
          
          // Wait a bit
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Start services again
          execSync('npm run start', { 
            cwd: path.join(__dirname, '..'),
            stdio: 'inherit'
          });
          
          log('\n✅ Services restarted successfully!', 'green');
          log('Press any key to continue...', 'gray');
        } catch (error) {
          log(`\n❌ Failed to restart services: ${error.message}`, 'red');
          log('Press any key to continue...', 'gray');
        }
        
        // Resume refresh after any key
        refreshInterval = setInterval(async () => {
          if (!waitingForKeypress) {
            await displayStatus();
          }
        }, 2000);
        break;
        
      case 's':
        // Stop services
        waitingForKeypress = true;
        clearInterval(refreshInterval);
        await stopServices();
        // Resume refresh after stop
        refreshInterval = setInterval(async () => {
          if (!waitingForKeypress) {
            await displayStatus();
          }
        }, 2000);
        break;
    }
  });
  
  // Keep the process alive
  process.stdin.resume();
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  process.stdout.write(colors.clear);
  log('\n👋 Exiting status monitor...', 'yellow');
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.stdout.write(colors.clear);
  log('\n👋 Exiting status monitor...', 'yellow');
  process.exit(0);
});

// Run the monitor
main().catch((error) => {
  log(`\n❌ Error: ${error.message}`, 'red');
  process.exit(1);
});