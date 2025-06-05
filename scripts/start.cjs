#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

// Service configuration from ecosystem.config.cjs
const services = [
  { name: 'gateway', port: 3000 },
  { name: 'ui', port: 3001 },
  { name: 'claude-service', port: 3002 },
  { name: 'repo-agent-service', port: 3004 }
];

// Ports that need to be available
const requiredPorts = services.map(s => s.port);

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logError(message) {
  console.error(`${colors.red}✗ ${message}${colors.reset}`);
}

function logSuccess(message) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

function logInfo(message) {
  console.log(`${colors.blue}ℹ ${message}${colors.reset}`);
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

// Kill process on a specific port
function killPort(port) {
  return new Promise((resolve) => {
    exec(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, (error) => {
      // Ignore errors - port might not be in use
      resolve();
    });
  });
}

// Kill all zombie processes
function killZombies() {
  return new Promise((resolve) => {
    logInfo('Cleaning up zombie processes...');
    
    const processPatterns = [
      'node.*meta-gothic',
      'node.*claude-service',
      'node.*repo-agent',
      'node.*yoga',
      'node.*gateway',
      'pm2.*'
    ];
    
    const killCommands = processPatterns.map(pattern => 
      `pkill -f "${pattern}" 2>/dev/null || true`
    ).join(' && ');
    
    exec(killCommands, (error) => {
      // Ignore errors - processes might not exist
      resolve();
    });
  });
}

// Clean all ports
async function cleanPorts() {
  logInfo('Cleaning up ports...');
  for (const port of requiredPorts) {
    const inUse = await checkPort(port);
    if (inUse) {
      log(`Port ${port} is in use, killing process...`, 'yellow');
      await killPort(port);
    }
  }
  logSuccess('All ports cleaned');
}

// Check if PM2 is installed
function checkPM2() {
  return new Promise((resolve) => {
    exec('which pm2', (error) => {
      if (error) {
        logError('PM2 is not installed. Please install it with: npm install -g pm2');
        process.exit(1);
      }
      resolve();
    });
  });
}

// Clean PM2 processes
function cleanPM2() {
  return new Promise((resolve) => {
    logInfo('Cleaning PM2 processes...');
    exec('pm2 delete all 2>/dev/null || true', () => {
      exec('pm2 flush 2>/dev/null || true', () => {
        resolve();
      });
    });
  });
}

// Check dependencies
async function checkDependencies() {
  logInfo('Checking dependencies...');
  
  const rootPackageJson = path.join(__dirname, '..', 'package.json');
  if (!fs.existsSync(rootPackageJson)) {
    logError('Root package.json not found. Are you in the right directory?');
    process.exit(1);
  }
  
  const nodeModules = path.join(__dirname, '..', 'node_modules');
  if (!fs.existsSync(nodeModules)) {
    logError('Root node_modules not found. Please run: npm install');
    process.exit(1);
  }
  
  // Check ecosystem config
  const ecosystemPath = path.join(__dirname, '..', 'ecosystem.config.cjs');
  if (!fs.existsSync(ecosystemPath)) {
    logError('ecosystem.config.cjs not found');
    process.exit(1);
  }
  
  logSuccess('All dependencies checked');
}

// Start services with PM2
function startServices() {
  return new Promise((resolve, reject) => {
    logInfo('Starting services with PM2...');
    
    const ecosystemPath = path.join(__dirname, '..', 'ecosystem.config.cjs');
    if (!fs.existsSync(ecosystemPath)) {
      logError('ecosystem.config.cjs not found');
      reject(new Error('PM2 config not found'));
      return;
    }
    
    const pm2Start = spawn('pm2', ['start', ecosystemPath], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    pm2Start.on('close', (code) => {
      if (code === 0) {
        logSuccess('All services started with PM2');
        resolve();
      } else {
        reject(new Error(`PM2 start failed with code ${code}`));
      }
    });
  });
}

// Wait for service to be healthy
function waitForHealth(service, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const url = `http://localhost:${service.port}/health`;
    
    const check = () => {
      fetch(url)
        .then(response => {
          if (response.ok) {
            logSuccess(`${service.name} is healthy`);
            resolve();
          } else {
            throw new Error(`Health check returned ${response.status}`);
          }
        })
        .catch(() => {
          if (Date.now() - start > timeout) {
            reject(new Error(`${service.name} health check timeout`));
          } else {
            setTimeout(check, 1000);
          }
        });
    };
    
    setTimeout(check, 2000); // Initial delay
  });
}

// Validate all services are healthy
async function validateServices() {
  logInfo('Validating service health...');
  
  try {
    await Promise.all(services.map(service => waitForHealth(service)));
    logSuccess('All services are healthy!');
  } catch (error) {
    logError(`Service validation failed: ${error.message}`);
    throw error;
  }
}

// Show PM2 status
function showStatus() {
  return new Promise((resolve) => {
    log('\nService Status:', 'cyan');
    const status = spawn('pm2', ['list'], { stdio: 'inherit' });
    status.on('close', resolve);
  });
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const cleanFlag = args.includes('--clean');
  
  log('\n🚀 Meta-Gothic Framework Service Manager', 'bright');
  log('=====================================\n', 'dim');
  
  try {
    // Check PM2 is installed
    await checkPM2();
    
    // Clean everything if requested
    if (cleanFlag) {
      log('🧹 Clean start requested', 'yellow');
      await cleanPM2();
      await killZombies();
      await cleanPorts();
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Always clean ports to be safe
    await cleanPorts();
    
    // Check dependencies
    await checkDependencies();
    
    // Start services
    await startServices();
    
    // Wait a bit for services to initialize
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Validate health
    await validateServices();
    
    // Show status
    await showStatus();
    
    log('\n✨ All services running!', 'green');
    log('\n🚀 Launching monitor...', 'cyan');
    
    // Launch the monitor
    const monitor = spawn('node', ['scripts/monitor.cjs'], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    monitor.on('close', (code) => {
      log('\n👋 Monitor closed', 'yellow');
      process.exit(code || 0);
    });
    
  } catch (error) {
    logError(`Startup failed: ${error.message}`);
    
    // Cleanup on failure
    log('\nCleaning up...', 'yellow');
    await cleanPM2();
    
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  log('\n\nShutdown requested...', 'yellow');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log('\n\nShutdown requested...', 'yellow');
  process.exit(0);
});

// Run main function
main().catch(error => {
  logError(`Fatal error: ${error.message}`);
  process.exit(1);
});