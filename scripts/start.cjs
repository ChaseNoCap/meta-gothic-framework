#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

// Service configuration for Cosmo
const services = [
  { name: 'claude-service', port: 3002 },
  { name: 'git-service', port: 3004 },
  { name: 'github-adapter', port: 3005 },
  { name: 'quality-service', port: 3006 },
  { name: 'gateway', port: 4000 },
  { name: 'ui', port: 3001 }
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
      'node.*git-service',
      'node.*quality-service',
      'node.*yoga',
      'node.*gateway',
      'router.*cosmo',
      'router/router',
      './router/router',
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
  
  // Check Cosmo router binary
  const routerPath = path.join(__dirname, '..', 'services', 'gothic-gateway', 'router', 'router');
  if (!fs.existsSync(routerPath)) {
    logError('Cosmo router binary not found at services/gothic-gateway/router/router');
    process.exit(1);
  }
  // Make router executable
  try {
    fs.accessSync(routerPath, fs.constants.X_OK);
  } catch (err) {
    logInfo('Making Cosmo router executable...');
    fs.chmodSync(routerPath, '755');
  }
  
  logSuccess('All dependencies checked');
}

// Check for GitHub token
function checkGitHubToken() {
  // Since we already loaded env vars, just check if they're set
  if (!process.env.GITHUB_TOKEN && !process.env.VITE_GITHUB_TOKEN) {
    log('\n⚠️  Warning: No GitHub token found!', 'yellow');
    log('Repository Health features will not work without a GitHub token.', 'yellow');
    log('Please create .env.gateway with:', 'yellow');
    log('  GITHUB_TOKEN=your_github_token', 'dim');
    log('Or set VITE_GITHUB_TOKEN in packages/ui-components/.env.local', 'dim');
    log('Example: cp .env.gateway.example .env.gateway\n', 'dim');
  }
}

// Start services with PM2
function startServices() {
  return new Promise((resolve, reject) => {
    logInfo('Starting Cosmo services with PM2...');
    
    const ecosystemPath = path.join(__dirname, '..', 'ecosystem.config.cjs');
    if (!fs.existsSync(ecosystemPath)) {
      logError('ecosystem.config.cjs not found');
      reject(new Error('PM2 config not found'));
      return;
    }
    
    // Run pre-flight checks first
    logInfo('Running pre-flight checks...');
    const preflightPath = path.join(__dirname, 'preflight-check.cjs');
    if (fs.existsSync(preflightPath)) {
      const preflight = spawn('node', [preflightPath], {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      
      preflight.on('close', (code) => {
        if (code !== 0) {
          logError('Pre-flight checks failed. Please fix the issues above.');
          reject(new Error('Pre-flight checks failed'));
          return;
        }
        
        // If checks pass, start PM2
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
    } else {
      // If no preflight check, start directly
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
    }
  });
}

// Wait for service to be healthy
function waitForHealth(service, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const port = service.port;
    
    // Different services have different health check methods
    let url, isGraphQL = false, checkQuery;
    
    if (service.name === 'gateway' || service.name === 'gateway-cosmo') {
      // Gateway uses GraphQL endpoint for health check
      url = `http://localhost:${port}/graphql`;
      isGraphQL = true;
      // Simple query that should work on Cosmo router
      checkQuery = '{ __typename }';
    } else if (service.name === 'ui') {
      // UI service just needs to respond
      url = `http://localhost:${port}/`;
    } else if (service.name === 'quality-service') {
      // Quality service doesn't have HTTP endpoint - check via PM2 status
      // Skip HTTP health check and just verify process is running
      return new Promise((resolve) => {
        setTimeout(() => {
          exec(`pm2 jlist | grep -q '"name":"quality-service".*"status":"online"'`, (error) => {
            if (!error) {
              logSuccess(`${service.name} is healthy (process running)`);
              resolve();
            } else {
              reject(new Error(`${service.name} process not found or not online`));
            }
          });
        }, 2000); // Give it 2 seconds to start
      });
    } else {
      // GraphQL services (claude-service, git-service, github-adapter)
      url = `http://localhost:${port}/graphql`;
      isGraphQL = true;
      // Use simpler query for health check
      checkQuery = '{ __typename }';
    }
    
    let lastError = null;
    let attempts = 0;
    const maxAttempts = service.name === 'gateway' ? 60 : 60;
    const delay = 100; // 100ms between attempts for rapid polling
    
    const check = () => {
      attempts++;
      
      if (isGraphQL) {
        // For GraphQL services, check if they respond to introspection
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: checkQuery })
        })
          .then(response => {
            // For services, we just need to know they're responding
            // Even if they return GraphQL errors, the service is "healthy"
            if (response.status === 200 || response.status === 500) {
              logSuccess(`${service.name} is healthy (endpoint responding)`);
              resolve();
              return;
            } else {
              lastError = `Service returned ${response.status}`;
              throw new Error(lastError);
            }
          })
          .catch((error) => {
            lastError = error.message;
            
            // Special handling for gateway - it might need more time
            const effectiveTimeout = service.name === 'gateway' ? timeout * 3 : timeout;
            
            if (Date.now() - start > effectiveTimeout || attempts >= maxAttempts) {
              // Get more detailed error info
              exec(`pm2 logs ${service.name} --lines 20 --nostream`, (execError, stdout, stderr) => {
                const logs = stdout || stderr || 'No logs available';
                reject(new Error(`${service.name} health check timeout on ${url}\nLast error: ${lastError}\nAttempts: ${attempts}\nRecent logs:\n${logs}`));
              });
            } else {
              // Only log every 10th attempt to reduce noise with rapid polling
              if (attempts % 10 === 0) {
                log(`${service.name} health check attempt ${attempts}/${maxAttempts}...`, 'dim');
              }
              setTimeout(check, delay);
            }
          });
      } else {
        // For non-GraphQL services, just check HTTP response
        fetch(url)
          .then(response => {
            if (response.ok) {
              logSuccess(`${service.name} is healthy`);
              resolve();
            } else {
              lastError = `Health check returned ${response.status}`;
              throw new Error(lastError);
            }
          })
          .catch((error) => {
            lastError = error.message;
            if (Date.now() - start > timeout || attempts >= maxAttempts) {
              // Get more detailed error info
              exec(`pm2 logs ${service.name} --lines 20 --nostream`, (execError, stdout, stderr) => {
                const logs = stdout || stderr || 'No logs available';
                reject(new Error(`${service.name} health check timeout on ${url}\nLast error: ${lastError}\nAttempts: ${attempts}\nRecent logs:\n${logs}`));
              });
            } else {
              // Only log every 10th attempt to reduce noise with rapid polling
              if (attempts % 10 === 0) {
                log(`${service.name} health check attempt ${attempts}/${maxAttempts}...`, 'dim');
              }
              setTimeout(check, delay);
            }
          });
      }
    };
    
    // Start checking immediately
    check();
  });
}

// Validate all services are healthy
async function validateServices() {
  logInfo('Validating service health...');
  
  try {
    // Health check services in order, but handle gateway and UI specially
    const backendServices = services.filter(s => !['gateway', 'ui'].includes(s.name));
    await Promise.all(backendServices.map(service => waitForHealth(service)));
    
    // Check gateway immediately after backend services are ready
    const gatewayService = services.find(s => s.name === 'gateway');
    if (gatewayService) {
      try {
        await waitForHealth(gatewayService);
      } catch (err) {
        log('⚠️  Gateway health check failed, but continuing...', 'yellow');
        log('You can check gateway status with: pm2 logs gateway', 'dim');
      }
    }
    
    // Finally check UI service
    const uiService = services.find(s => s.name === 'ui');
    if (uiService) {
      await waitForHealth(uiService);
    }
    
    logSuccess('Services are running!');
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

// Generate Cosmo Router configuration
function generateSupergraph() {
  return new Promise((resolve, reject) => {
    logInfo('Setting up Cosmo Router configuration...');
    
    const configSource = path.join(__dirname, '..', 'services', 'gothic-gateway', 'router-execution-config.json');
    const configDest = path.join(__dirname, '..', 'services', 'gothic-gateway', 'config.json');
    
    // Check if the source config exists
    if (!fs.existsSync(configSource)) {
      log('Router execution config not found, skipping...', 'yellow');
      resolve();
      return;
    }
    
    try {
      // Copy the working router-execution-config.json to config.json
      fs.copyFileSync(configSource, configDest);
      logSuccess('Cosmo Router configuration copied successfully');
      resolve();
    } catch (error) {
      log('⚠️  Failed to copy router configuration, but continuing...', 'yellow');
      log(`Error: ${error.message}`, 'dim');
      // Don't reject - allow services to continue
      resolve();
    }
  });
}

// Load environment variables from .env files
function loadEnvironment() {
  const rootDir = path.join(__dirname, '..');
  
  // Helper to load a single .env file
  const loadEnvFile = (filePath, name) => {
    if (fs.existsSync(filePath)) {
      const envContent = fs.readFileSync(filePath, 'utf8');
      let count = 0;
      envContent.split('\n').forEach(line => {
        if (line && !line.startsWith('#')) {
          const [key, ...valueParts] = line.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim();
            process.env[key.trim()] = value;
            count++;
          }
        }
      });
      if (count > 0) {
        log(`  ✓ Loaded ${count} variables from ${name}`, 'green');
      }
    }
  };
  
  logInfo('Loading environment variables...');
  
  // Load .env.gateway for GitHub token
  loadEnvFile(path.join(rootDir, '.env.gateway'), '.env.gateway');
  
  // Load UI .env.local for Vite
  loadEnvFile(path.join(rootDir, 'packages', 'ui-components', '.env.local'), 'ui-components/.env.local');
  
  // Set workspace root
  process.env.WORKSPACE_ROOT = rootDir;
  
  // Set federation mode
  process.env.FEDERATION = 'cosmo';
  
  // Show loaded environment status
  log('\nEnvironment status:', 'cyan');
  log(`  GITHUB_TOKEN: ${process.env.GITHUB_TOKEN ? '✓ Set' : '✗ Not set'}`, process.env.GITHUB_TOKEN ? 'green' : 'yellow');
  log(`  VITE_GITHUB_TOKEN: ${process.env.VITE_GITHUB_TOKEN ? '✓ Set' : '✗ Not set'}`, process.env.VITE_GITHUB_TOKEN ? 'green' : 'yellow');
  log(`  WORKSPACE_ROOT: ${process.env.WORKSPACE_ROOT}`, 'dim');
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    noMonitor: false
  };
  
  for (const arg of args) {
    if (arg === '--no-monitor' || arg === '-n') {
      options.noMonitor = true;
    }
  }
  
  return options;
}

// Main function
async function main() {
  const options = parseArgs();
  
  log('\n🚀 Meta-Gothic Framework Service Manager (Cosmo)', 'bright');
  log('==========================================\n', 'dim');
  
  try {
    // Load environment variables first
    loadEnvironment();
    
    // Check PM2 is installed
    await checkPM2();
    
    // Always do a clean start
    log('🧹 Performing clean startup...', 'yellow');
    await cleanPM2();
    await killZombies();
    await cleanPorts();
    
    // Check dependencies
    await checkDependencies();
    
    // Check for GitHub token
    checkGitHubToken();
    
    // Start services
    await startServices();
    
    // Validate health immediately
    await validateServices();
    
    // Generate supergraph schema first (with timeout)
    // This needs to complete before UI can work properly
    await generateSupergraph().catch(err => {
      log('⚠️  Supergraph generation had issues, but continuing...', 'yellow');
    });
    
    // Verify gateway can handle GraphQL queries immediately
    try {
      const testQuery = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: '{ __schema { queryType { name } } }' 
        })
      });
      
      if (testQuery.ok) {
        const result = await testQuery.json();
        if (result.data) {
          logSuccess('Gateway GraphQL endpoint is fully operational');
        } else {
          log('⚠️  Gateway responded but GraphQL schema might not be ready', 'yellow');
        }
      }
    } catch (err) {
      log('⚠️  Could not verify gateway GraphQL endpoint', 'yellow');
    }
    
    // UI is now started with PM2 along with other services
    
    // Show status
    await showStatus();
    
    log('\n✨ All services running!', 'green');
    log('\n🌐 Services:', 'cyan');
    log('   Gateway (Cosmo Router): http://localhost:4000/graphql', 'dim');
    log('   Claude Service: http://localhost:3002/graphql', 'dim');
    log('   Git Service: http://localhost:3004/graphql', 'dim');
    log('   GitHub Adapter: http://localhost:3005/graphql', 'dim');
    log('   Quality Service: http://localhost:3006 (MCP: npm run start:mcp)', 'dim');
    log('   UI Dashboard: http://localhost:3001', 'dim');
    
    if (options.noMonitor) {
      log('\n✅ Services started successfully (monitor skipped)', 'green');
      log('\n📝 Commands:', 'cyan');
      log('   View logs: pm2 logs', 'dim');
      log('   View status: pm2 list', 'dim');
      log('   Stop all: pm2 stop all', 'dim');
      log('   Monitor: npm run monitor', 'dim');
    } else {
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
    }
    
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