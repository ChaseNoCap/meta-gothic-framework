#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Track spawned processes
const spawnedProcesses = [];

// Service configuration with dependencies
const services = [
  {
    name: 'Repo Agent Service',
    dir: path.join(__dirname, '../services/repo-agent-service'),
    command: 'npm',
    args: ['run', 'dev'],
    port: 3004,
    healthUrl: 'http://localhost:3004/graphql',
    healthQuery: '{"query":"{ repoAgentHealth { status } }"}',
    logFile: '/tmp/repo-agent-yoga.log',
    waitTime: 3000,
    dependencies: [] // No dependencies
  },
  {
    name: 'Claude Service',
    dir: path.join(__dirname, '../services/claude-service'),
    command: 'npm',
    args: ['run', 'dev'],
    port: 3002,
    healthUrl: 'http://localhost:3002/graphql',
    healthQuery: '{"query":"{ claudeHealth { healthy } }"}',
    logFile: '/tmp/claude-yoga.log',
    waitTime: 3000,
    dependencies: [] // No dependencies
  },
  {
    name: 'Meta-GOTHIC Gateway',
    dir: path.join(__dirname, '../services/meta-gothic-app'),
    command: 'npm',
    args: ['run', 'dev'],
    port: 3000,
    healthUrl: 'http://localhost:3000/graphql',
    healthQuery: '{"query":"{ __schema { queryType { name } } }"}',
    logFile: '/tmp/meta-gothic-gateway.log',
    waitTime: 3000, // Reduced wait time since we'll check dependencies first
    maxHealthAttempts: 60, // Give gateway 60 seconds to become healthy
    critical: false, // Don't fail everything if gateway fails
    dependencies: [3002, 3004] // Depends on Claude and Repo Agent services
  },
  {
    name: 'UI Components (Frontend)',
    dir: path.join(__dirname, '../packages/ui-components'),
    command: 'npm',
    args: ['run', 'dev'],
    port: 3001,
    healthUrl: 'http://localhost:3001',
    logFile: '/tmp/ui-components.log',
    skipHealthCheck: true, // Vite doesn't have a health endpoint
    dependencies: [3000] // Depends on Gateway
  }
];

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Kill process with retry
async function killProcess(pid, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      process.kill(pid, i === 0 ? 'SIGTERM' : 'SIGKILL');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if process still exists
      try {
        process.kill(pid, 0);
      } catch {
        return true; // Process is gone
      }
    } catch {
      return true; // Process already gone
    }
  }
  return false;
}

// Clean up ports
async function cleanupPort(port) {
  try {
    const pids = execSync(`lsof -ti:${port}`, { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(pid => pid);
    
    for (const pid of pids) {
      await killProcess(parseInt(pid));
    }
    
    // Verify port is free
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      execSync(`lsof -ti:${port}`, { stdio: 'ignore' });
      return false; // Port still in use
    } catch {
      return true; // Port is free
    }
  } catch {
    return true; // Port was already free
  }
}

// Stop all services
async function stopAllServices() {
  log('\n🛑 Stopping all services...', 'yellow');
  
  // Kill by port
  for (const service of services) {
    const freed = await cleanupPort(service.port);
    if (freed) {
      log(`  ✓ Port ${service.port} cleared`, 'green');
    } else {
      log(`  ⚠️  Port ${service.port} still in use`, 'yellow');
    }
  }
  
  // Kill by process name patterns - more aggressive cleanup
  const patterns = [
    'tsx watch src/index-yoga.ts',
    'tsx watch src/gateway.ts',
    'claude-service',
    'repo-agent',
    'meta-gothic',
    'ui-components',
    'vite',
    'node_modules/.bin/tsx watch'  // Catch all tsx watch processes
  ];
  
  for (const pattern of patterns) {
    try {
      // First try SIGTERM
      execSync(`pkill -f "${pattern}"`, { stdio: 'ignore' });
      // Wait a bit
      execSync('sleep 0.5', { stdio: 'ignore' });
      // Then force kill any remaining
      execSync(`pkill -9 -f "${pattern}"`, { stdio: 'ignore' });
    } catch {
      // Process might not exist
    }
  }
  
  // Additional cleanup - kill all processes running from our service directories
  const servicePaths = [
    'meta-gothic-framework/services/claude-service',
    'meta-gothic-framework/services/repo-agent-service',
    'meta-gothic-framework/services/meta-gothic-app',
    'meta-gothic-framework/packages/ui-components'
  ];
  
  for (const path of servicePaths) {
    try {
      execSync(`pkill -f "${path}"`, { stdio: 'ignore' });
      execSync('sleep 0.1', { stdio: 'ignore' });
      execSync(`pkill -9 -f "${path}"`, { stdio: 'ignore' });
    } catch {
      // Process might not exist
    }
  }
  
  // Most aggressive cleanup - kill all node processes running tsx watch from our project
  try {
    const pids = execSync("ps aux | grep -E 'node.*meta-gothic-framework.*tsx watch' | grep -v grep | awk '{print $2}'", { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(pid => pid);
    
    if (pids.length > 0) {
      log(`  → Found ${pids.length} zombie tsx watch processes, killing...`, 'yellow');
      for (const pid of pids) {
        try {
          process.kill(parseInt(pid), 'SIGKILL');
        } catch {
          // Process might be already dead
        }
      }
    }
  } catch {
    // No processes found
  }
  
  // Also kill any vite processes from our project
  try {
    const vitePids = execSync("ps aux | grep -E 'vite.*meta-gothic-framework' | grep -v grep | awk '{print $2}'", { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(pid => pid);
    
    if (vitePids.length > 0) {
      for (const pid of vitePids) {
        try {
          process.kill(parseInt(pid), 'SIGKILL');
        } catch {
          // Process might be already dead
        }
      }
    }
  } catch {
    // No processes found
  }
  
  log('  ✓ All services stopped\n', 'green');
}

// Health check
async function checkHealth(service) {
  const http = require('http');
  
  return new Promise((resolve) => {
    const options = {
      method: service.healthQuery ? 'POST' : 'GET',
      headers: service.healthQuery ? {
        'Content-Type': 'application/json',
      } : {},
      timeout: 2000
    };
    
    const req = http.request(service.healthUrl, options, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    
    if (service.healthQuery) {
      req.write(service.healthQuery);
    }
    
    req.end();
  });
}

// Check if a port is listening
async function isPortListening(port) {
  const net = require('net');
  
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(true)) // Port is in use (good)
      .once('listening', () => {
        tester.close();
        resolve(false); // Port is free (bad)
      })
      .listen(port);
  });
}

// Check if all dependencies are ready
async function checkDependencies(service) {
  if (!service.dependencies || service.dependencies.length === 0) {
    return true;
  }
  
  log(`  → Checking dependencies for ${service.name}...`, 'cyan');
  
  for (const depPort of service.dependencies) {
    const depService = services.find(s => s.port === depPort);
    const depName = depService ? depService.name : `port ${depPort}`;
    
    // First check if port is listening
    if (!await isPortListening(depPort)) {
      log(`    ❌ Dependency ${depName} is not running`, 'red');
      return false;
    }
    
    // Then check health if we have a service definition
    if (depService && !depService.skipHealthCheck) {
      const healthy = await checkHealth(depService);
      if (!healthy) {
        log(`    ❌ Dependency ${depName} is not healthy`, 'red');
        return false;
      }
    }
    
    log(`    ✓ Dependency ${depName} is ready`, 'green');
  }
  
  return true;
}

// Wait for service to be ready
async function waitForService(service) {
  if (service.skipHealthCheck) {
    log(`  ⏭️  Skipping health check`, 'yellow');
    return true;
  }
  
  const maxAttempts = service.maxHealthAttempts || 30;
  
  log(`  ⏳ Waiting for service to be ready at ${service.healthUrl}... (max ${maxAttempts}s)`, 'blue');
  
  for (let i = 0; i < maxAttempts; i++) {
    const healthy = await checkHealth(service);
    
    if (healthy) {
      log(`  ✅ Service is ready! (${i + 1} attempts)`, 'green');
      return true;
    }
    
    if (i === 0) {
      process.stdout.write('  → Checking health: ');
    }
    process.stdout.write('.');
    
    // Show progress every 10 seconds
    if ((i + 1) % 10 === 0) {
      process.stdout.write(` [${i + 1}s]`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  log(`\n  ❌ Service failed to become healthy after ${maxAttempts} seconds`, 'red');
  return false;
}

// Start a service with retries
async function startService(service, attempt = 1, maxAttempts = 3) {
  log(`\n🚀 Starting ${service.name}...`, 'magenta');
  
  // Check dependencies first
  if (!await checkDependencies(service)) {
    log(`  ❌ Dependencies are not ready for ${service.name}`, 'red');
    return false;
  }
  
  // Clean up port first
  if (!await cleanupPort(service.port)) {
    log(`  ❌ Failed to free port ${service.port}`, 'red');
    return false;
  }
  
  // Clear log file
  if (service.logFile) {
    try {
      fs.writeFileSync(service.logFile, '');
    } catch {
      // Ignore
    }
  }
  
  // Check directory exists
  if (!fs.existsSync(service.dir)) {
    log(`  ❌ Directory not found: ${service.dir}`, 'red');
    return false;
  }
  
  // Start the service
  try {
    log(`  → Spawning process: ${service.command} ${service.args.join(' ')}`, 'cyan');
    
    const proc = spawn(service.command, service.args, {
      cwd: service.dir,
      detached: true, // Keep detached but manage properly
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        WORKSPACE_ROOT: path.join(__dirname, '..'),
        NODE_ENV: 'development'
      }
    });
    
    if (!proc.pid) {
      throw new Error('Failed to spawn process');
    }
    
    log(`  → Process spawned with PID: ${proc.pid}`, 'green');
    
    // Store PID and process reference
    service.pid = proc.pid;
    spawnedProcesses.push({
      name: service.name,
      pid: proc.pid,
      process: proc
    });
    
    // Log output to file with enhanced logging
    if (service.logFile) {
      const timestamp = new Date().toISOString();
      fs.appendFileSync(service.logFile, `\n[STARTUP ${timestamp}] Process started with PID: ${proc.pid}\n`);
      fs.appendFileSync(service.logFile, `[STARTUP ${timestamp}] Command: ${service.command} ${service.args.join(' ')}\n`);
      fs.appendFileSync(service.logFile, `[STARTUP ${timestamp}] Working Directory: ${service.dir}\n`);
      
      const logStream = fs.createWriteStream(service.logFile, { flags: 'a' });
      
      // Enhanced logging with timestamps
      proc.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        lines.forEach(line => {
          const logLine = `[${new Date().toISOString()}] [STDOUT] ${line}\n`;
          logStream.write(logLine);
          
          // Detect tsx watch restart messages
          if (line.includes('Restarting') || line.includes('File change detected') || line.includes('watching for file changes')) {
            log(`  🔄 ${service.name} restarting due to file changes: ${line}`, 'yellow');
            fs.appendFileSync(service.logFile, `[${new Date().toISOString()}] [RESTART] Service restarting due to file change\n`);
          }
          
          // Detect service started messages
          if (line.includes('started') && line.includes('http://localhost:')) {
            log(`  ✅ ${service.name} started successfully`, 'green');
          }
        });
      });
      
      proc.stderr.on('data', (data) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        lines.forEach(line => {
          const logLine = `[${new Date().toISOString()}] [STDERR] ${line}\n`;
          logStream.write(logLine);
          // Also log errors to console
          log(`  ⚠️  ${service.name} error: ${line}`, 'red');
        });
      });
    }
    
    // Handle process exit
    proc.on('exit', (code, signal) => {
      const timestamp = new Date().toISOString();
      if (service.logFile) {
        fs.appendFileSync(service.logFile, `\n[EXIT ${timestamp}] Process exited with code: ${code}, signal: ${signal}\n`);
        fs.appendFileSync(service.logFile, `[EXIT ${timestamp}] Service ran for: ${Math.round((Date.now() - proc.startTime) / 1000)} seconds\n`);
      }
      log(`  ⚠️  ${service.name} exited (code: ${code}, signal: ${signal})`, 'yellow');
      // Remove from spawned processes
      const index = spawnedProcesses.findIndex(p => p.pid === proc.pid);
      if (index > -1) {
        spawnedProcesses.splice(index, 1);
      }
    });
    
    // Track start time
    proc.startTime = Date.now();
    
    // Handle process errors
    proc.on('error', (error) => {
      const timestamp = new Date().toISOString();
      if (service.logFile) {
        fs.appendFileSync(service.logFile, `\n[ERROR ${timestamp}] Process error: ${error.message}\n`);
        fs.appendFileSync(service.logFile, `[ERROR ${timestamp}] Stack: ${error.stack}\n`);
      }
      log(`  ❌ ${service.name} error: ${error.message}`, 'red');
    });
    
    // Unref to allow main process to exit
    proc.unref();
    
    // Wait for service to initialize
    const waitTime = service.waitTime || 3000;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // Check if service is ready
    if (await waitForService(service)) {
      return true;
    }
    
    // Retry on failure
    if (attempt < maxAttempts) {
      log(`  ⚠️  Retrying (${attempt}/${maxAttempts})...`, 'yellow');
      await cleanupPort(service.port);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return startService(service, attempt + 1, maxAttempts);
    }
    
    return false;
    
  } catch (error) {
    log(`  ❌ Failed to start: ${error.message}`, 'red');
    
    if (attempt < maxAttempts) {
      log(`  ⚠️  Retrying (${attempt}/${maxAttempts})...`, 'yellow');
      await new Promise(resolve => setTimeout(resolve, 2000));
      return startService(service, attempt + 1, maxAttempts);
    }
    
    return false;
  }
}

// Main startup function
async function main() {
  log('\n🎯 Meta-GOTHIC Framework - Starting All Services\n', 'blue');
  
  // Check Node version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
  if (majorVersion < 18) {
    log(`❌ Node.js ${nodeVersion} is too old. Required: >= 18.0.0`, 'red');
    process.exit(1);
  }
  
  // Stop all existing services
  await stopAllServices();
  
  // Wait for ports to be released
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Start services in order
  let allStarted = true;
  
  for (const service of services) {
    const started = await startService(service);
    if (!started) {
      allStarted = false;
      log(`\n❌ Failed to start ${service.name}`, 'red');
      
      // Stop all services on critical failure
      if (service.name !== 'UI Components (Frontend)') {
        log('\n🛑 Critical service failed. Stopping all services...', 'red');
        await stopAllServices();
        process.exit(1);
      }
    }
  }
  
  if (allStarted) {
    log('\n✅ All services started successfully!\n', 'green');
  } else {
    log('\n⚠️  Some services failed to start\n', 'yellow');
  }
  
  log('🌐 Service URLs:', 'cyan');
  log('  - Frontend: http://localhost:3001', 'green');
  log('  - GraphQL Gateway: http://localhost:3000/graphql', 'green');
  log('  - Claude Service: http://localhost:3002/graphql', 'green');
  log('  - Repo Agent Service: http://localhost:3004/graphql\n', 'green');
  
  log('📋 Commands:', 'cyan');
  log('  - npm run stop    - Stop all services', 'yellow');
  log('  - npm run status  - Check service status', 'yellow');
  log('  - npm run logs    - View service logs\n', 'yellow');
  
  process.exit(0);
}

// Cleanup function
async function cleanup() {
  log('\n⚠️  Cleaning up spawned processes...', 'yellow');
  
  // Kill all spawned processes
  for (const proc of spawnedProcesses) {
    try {
      process.kill(proc.pid, 'SIGTERM');
      log(`  → Sent SIGTERM to ${proc.name} (PID: ${proc.pid})`, 'yellow');
    } catch (e) {
      // Process might already be dead
    }
  }
  
  // Give them time to exit gracefully
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Force kill any remaining
  for (const proc of spawnedProcesses) {
    try {
      process.kill(proc.pid, 'SIGKILL');
    } catch (e) {
      // Process already dead
    }
  }
  
  await stopAllServices();
}

// Handle interrupts
process.on('SIGINT', async () => {
  log('\n\n⚠️  Interrupted, stopping services...', 'yellow');
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(0);
});

process.on('exit', () => {
  // Last-ditch cleanup
  for (const proc of spawnedProcesses) {
    try {
      process.kill(proc.pid, 'SIGKILL');
    } catch (e) {
      // Ignore
    }
  }
});

// Run
main().catch(async (error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  await stopAllServices();
  process.exit(1);
});