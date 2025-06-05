#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  clear: '\x1b[2J\x1b[H'
};

function log(message, color = 'reset') {
  const colorCode = colors[color] || colors.reset;
  console.log(`${colorCode}${message}${colors.reset}`);
}

// Track all service processes
const serviceProcesses = {
  repoAgent: null,
  claude: null,
  gateway: null,
  ui: null
};

let isShuttingDown = false;
let isRestarting = false;

async function stopAllServices() {
  log('\n🛑 Stopping all services...', 'yellow');
  
  // Kill all tracked processes
  for (const [name, proc] of Object.entries(serviceProcesses)) {
    if (proc && !proc.killed) {
      try {
        process.kill(proc.pid, 'SIGTERM');
        log(`  Stopped ${name} (PID: ${proc.pid})`, 'gray');
      } catch (e) {
        // Process might already be dead
      }
    }
  }
  
  // Also run the stop script to clean up any orphaned processes
  try {
    execSync('npm run stop', { 
      cwd: path.join(__dirname, '..'),
      stdio: 'ignore'
    });
  } catch (e) {
    // Ignore errors
  }
  
  // Clear process references
  Object.keys(serviceProcesses).forEach(key => {
    serviceProcesses[key] = null;
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
}

function startService(name, command, args, cwd, logFile) {
  return new Promise((resolve, reject) => {
    log(`  Starting ${name}...`, 'cyan');
    
    // Create log stream
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    
    // Add startup marker
    logStream.write(`\n[STARTUP ${new Date().toISOString()}] Process started with PID: ${process.pid}\n`);
    logStream.write(`[STARTUP ${new Date().toISOString()}] Command: ${command} ${args.join(' ')}\n`);
    logStream.write(`[STARTUP ${new Date().toISOString()}] Working Directory: ${cwd}\n`);
    
    const proc = spawn(command, args, {
      cwd,
      env: { 
        ...process.env, 
        NODE_ENV: 'development',
        WORKSPACE_ROOT: path.join(__dirname, '..')
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    serviceProcesses[name] = proc;
    
    // Pipe output to log file with timestamps
    proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        logStream.write(`[${new Date().toISOString()}] [STDOUT] ${line}\n`);
      });
    });
    
    proc.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        logStream.write(`[${new Date().toISOString()}] [STDERR] ${line}\n`);
      });
    });
    
    proc.on('error', (err) => {
      log(`  ❌ Failed to start ${name}: ${err.message}`, 'red');
      reject(err);
    });
    
    proc.on('close', (code) => {
      logStream.write(`[EXIT ${new Date().toISOString()}] Process exited with code ${code}\n`);
      logStream.end();
      
      if (!isShuttingDown && !isRestarting) {
        log(`  ⚠️  ${name} exited unexpectedly with code ${code}`, 'yellow');
      }
    });
    
    // Consider started after a short delay
    setTimeout(() => resolve(proc), 1000);
  });
}

async function startAllServices() {
  log('🚀 Starting all services...', 'cyan');
  
  try {
    // Start services in order with proper dependencies
    await startService(
      'repoAgent',
      'npm',
      ['run', 'dev'],
      path.join(__dirname, '../services/repo-agent-service'),
      '/tmp/repo-agent-yoga.log'
    );
    
    await startService(
      'claude',
      'npm',
      ['run', 'dev'],
      path.join(__dirname, '../services/claude-service'),
      '/tmp/claude-yoga.log'
    );
    
    await startService(
      'gateway',
      'npm',
      ['run', 'dev'],
      path.join(__dirname, '../services/meta-gothic-app'),
      '/tmp/meta-gothic-gateway.log'
    );
    
    // UI is optional, don't fail if it doesn't start
    try {
      await startService(
        'ui',
        'npm',
        ['run', 'dev'],
        path.join(__dirname, '../packages/ui-components'),
        '/tmp/ui-components.log'
      );
    } catch (e) {
      log('  ⚠️  UI service failed to start (this is optional)', 'yellow');
    }
    
    log('✅ All services started!', 'green');
  } catch (error) {
    log(`❌ Failed to start services: ${error.message}`, 'red');
    throw error;
  }
}

async function checkServicesHealth() {
  const services = [
    { name: 'Repo Agent', port: 3004, pid: serviceProcesses.repoAgent?.pid },
    { name: 'Claude Service', port: 3002, pid: serviceProcesses.claude?.pid },
    { name: 'Gateway', port: 3000, pid: serviceProcesses.gateway?.pid },
    { name: 'UI', port: 3001, pid: serviceProcesses.ui?.pid }
  ];
  
  const status = [];
  
  for (const service of services) {
    let running = false;
    let listening = false;
    
    // Check if process is alive
    if (service.pid) {
      try {
        process.kill(service.pid, 0);
        running = true;
      } catch {
        running = false;
      }
    }
    
    // Check if port is listening
    try {
      execSync(`lsof -ti:${service.port}`, { stdio: 'ignore' });
      listening = true;
    } catch {
      listening = false;
    }
    
    status.push({
      name: service.name,
      port: service.port,
      pid: service.pid,
      running,
      listening,
      healthy: running && listening
    });
  }
  
  return status;
}

async function displayStatus() {
  process.stdout.write(colors.clear);
  
  const timestamp = new Date().toLocaleTimeString();
  log(`📊 Meta-GOTHIC Services Monitor - ${timestamp}`, 'blue');
  log('─'.repeat(50), 'gray');
  
  const status = await checkServicesHealth();
  let allHealthy = true;
  
  for (const service of status) {
    allHealthy = allHealthy && service.healthy;
    
    const icon = service.healthy ? '✅' : '❌';
    const color = service.healthy ? 'green' : 'red';
    
    log(`\n${icon} ${service.name}`, color);
    log(`   Port: ${service.port}`, 'gray');
    if (service.pid) {
      log(`   PID: ${service.pid}`, 'gray');
    }
    
    if (!service.healthy) {
      if (service.running && !service.listening) {
        log(`   ⚠️  Process running but not listening on port`, 'yellow');
      } else if (!service.running && service.listening) {
        log(`   ⚠️  Port in use by another process`, 'yellow');
      } else {
        log(`   ⚠️  Service is not running`, 'yellow');
      }
    }
  }
  
  log('\n' + '─'.repeat(50), 'gray');
  
  if (allHealthy) {
    log('✅ All services are healthy!', 'green');
  } else {
    log('❌ Some services need attention', 'red');
  }
  
  log('\n📋 Commands:', 'cyan');
  log('  [R] Restart all services', 'yellow');
  log('  [S] Stop all services', 'yellow');
  log('  [H] Check health status', 'yellow');
  log('  [L] Show recent logs', 'yellow');
  log('  [Q] Quit', 'yellow');
  log('\nPress a key to select an option...', 'gray');
}

async function showRecentLogs() {
  log('\n📜 Recent logs from all services:', 'cyan');
  log('─'.repeat(50), 'gray');
  
  const logFiles = [
    { name: 'Claude Service', file: '/tmp/claude-yoga.log' },
    { name: 'Repo Agent', file: '/tmp/repo-agent-yoga.log' },
    { name: 'Gateway', file: '/tmp/meta-gothic-gateway.log' },
    { name: 'UI', file: '/tmp/ui-components.log' }
  ];
  
  for (const { name, file } of logFiles) {
    try {
      const logs = execSync(`tail -5 ${file} 2>/dev/null || echo "No logs"`, { encoding: 'utf8' });
      log(`\n${name}:`, 'blue');
      console.log(logs.trim());
    } catch (e) {
      log(`\n${name}: No logs available`, 'gray');
    }
  }
  
  log('\nPress any key to return to monitor...', 'gray');
}

async function main() {
  // Setup readline for keyboard input
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  
  let refreshInterval;
  let waitingForInput = false;
  
  try {
    // Clean up any existing processes on our ports first
    log('🧹 Cleaning up existing processes...', 'cyan');
    await stopAllServices();
    
    // Start all services
    await startAllServices();
    
    // Wait for services to stabilize
    log('\n⏳ Waiting for services to stabilize...', 'cyan');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Initial status display
    await displayStatus();
    
    // Auto-refresh every 5 seconds
    refreshInterval = setInterval(async () => {
      if (!waitingForInput && !isRestarting) {
        await displayStatus();
      }
    }, 5000);
    
    // Handle keyboard input
    process.stdin.on('keypress', async (str, key) => {
      if (waitingForInput && str !== 'r' && str !== 's' && str !== 'h' && str !== 'l' && str !== 'q') {
        // Any other key returns to monitor
        waitingForInput = false;
        await displayStatus();
        return;
      }
      
      if (key && key.ctrl && key.name === 'c') {
        // Ctrl+C to exit
        clearInterval(refreshInterval);
        await gracefulShutdown();
      }
      
      const input = str ? str.toLowerCase() : '';
      
      switch (input) {
        case 'q':
          clearInterval(refreshInterval);
          await gracefulShutdown();
          break;
          
        case 'r':
          // Restart all services
          waitingForInput = true;
          isRestarting = true;
          clearInterval(refreshInterval);
          
          log('\n🔄 Restarting all services...', 'cyan');
          
          // Log restart event
          const restartLog = path.join(__dirname, '../logs/service-restarts.log');
          fs.appendFileSync(restartLog, `[${new Date().toISOString()}] Manual restart initiated\n`);
          
          await stopAllServices();
          await startAllServices();
          
          log('\n✅ Services restarted!', 'green');
          log('Press any key to continue...', 'gray');
          
          isRestarting = false;
          
          // Resume refresh
          refreshInterval = setInterval(async () => {
            if (!waitingForInput && !isRestarting) {
              await displayStatus();
            }
          }, 5000);
          break;
          
        case 's':
          // Stop all services
          waitingForInput = true;
          clearInterval(refreshInterval);
          
          await stopAllServices();
          log('✅ All services stopped!', 'green');
          log('Press any key to continue...', 'gray');
          
          // Resume refresh
          refreshInterval = setInterval(async () => {
            if (!waitingForInput && !isRestarting) {
              await displayStatus();
            }
          }, 5000);
          break;
          
        case 'h':
          // Force health check
          await displayStatus();
          break;
          
        case 'l':
          // Show logs
          waitingForInput = true;
          await showRecentLogs();
          break;
      }
    });
    
    // Keep process alive
    process.stdin.resume();
    
  } catch (error) {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    await gracefulShutdown();
  }
}

async function gracefulShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  process.stdout.write(colors.clear);
  log('\n🛑 Shutting down gracefully...', 'yellow');
  
  await stopAllServices();
  
  log('✅ Shutdown complete', 'green');
  process.exit(0);
}

// Handle cleanup
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

process.on('uncaughtException', (error) => {
  log(`\n❌ Uncaught exception: ${error.message}`, 'red');
  console.error(error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  log(`\n❌ Unhandled rejection at: ${promise}, reason: ${reason}`, 'red');
  gracefulShutdown();
});

// Run
main();