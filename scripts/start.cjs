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
  { name: 'git-service', port: 3004 },
  { name: 'github-adapter', port: 3005 }
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
    logInfo('Starting services with PM2...');
    
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
function waitForHealth(service, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const port = service.port;
    
    // Different services have different health check methods
    let url, isGraphQL = false;
    
    if (service.name === 'gateway') {
      // Gateway has a dedicated health endpoint
      url = `http://localhost:${port}/health`;
    } else if (service.name === 'ui') {
      // UI service just needs to respond
      url = `http://localhost:${port}/`;
    } else {
      // GraphQL services (claude-service, git-service, github-adapter)
      url = `http://localhost:${port}/graphql`;
      isGraphQL = true;
    }
    
    let lastError = null;
    
    const check = () => {
      if (isGraphQL) {
        // For GraphQL services, check if they respond to introspection
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '{ __schema { queryType { name } } }' })
        })
          .then(response => {
            if (response.ok) {
              return response.json();
            } else {
              lastError = `GraphQL returned ${response.status}`;
              throw new Error(lastError);
            }
          })
          .then(data => {
            if (data && data.data && data.data.__schema) {
              logSuccess(`${service.name} is healthy (GraphQL responding)`);
              resolve();
            } else {
              lastError = 'GraphQL schema not available';
              throw new Error(lastError);
            }
          })
          .catch((error) => {
            lastError = error.message;
            if (Date.now() - start > timeout) {
              // Get more detailed error info
              exec(`pm2 logs ${service.name} --lines 20 --nostream`, (execError, stdout, stderr) => {
                const logs = stdout || stderr || 'No logs available';
                reject(new Error(`${service.name} health check timeout on ${url}\nLast error: ${lastError}\nRecent logs:\n${logs}`));
              });
            } else {
              setTimeout(check, 1000);
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
            if (Date.now() - start > timeout) {
              // Get more detailed error info
              exec(`pm2 logs ${service.name} --lines 20 --nostream`, (execError, stdout, stderr) => {
                const logs = stdout || stderr || 'No logs available';
                reject(new Error(`${service.name} health check timeout on ${url}\nLast error: ${lastError}\nRecent logs:\n${logs}`));
              });
            } else {
              setTimeout(check, 1000);
            }
          });
      }
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

// Generate supergraph schema
function generateSupergraph() {
  return new Promise((resolve, reject) => {
    logInfo('Generating supergraph schema...');
    
    const supergraphScript = path.join(__dirname, '..', 'services', 'gothic-gateway', 'compose-supergraph.sh');
    
    // Check if the script exists
    if (!fs.existsSync(supergraphScript)) {
      log('Supergraph generation script not found, skipping...', 'yellow');
      resolve();
      return;
    }
    
    // Make sure it's executable
    fs.chmodSync(supergraphScript, '755');
    
    const generate = spawn('bash', [supergraphScript], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..', 'services', 'gothic-gateway')
    });
    
    generate.on('close', (code) => {
      if (code === 0) {
        logSuccess('Supergraph schema generated successfully');
        resolve();
      } else {
        log('⚠️  Supergraph generation failed, but continuing...', 'yellow');
        log('You may need to run it manually later', 'dim');
        // Don't reject - allow services to continue
        resolve();
      }
    });
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
  
  // Show loaded environment status
  log('\nEnvironment status:', 'cyan');
  log(`  GITHUB_TOKEN: ${process.env.GITHUB_TOKEN ? '✓ Set' : '✗ Not set'}`, process.env.GITHUB_TOKEN ? 'green' : 'yellow');
  log(`  VITE_GITHUB_TOKEN: ${process.env.VITE_GITHUB_TOKEN ? '✓ Set' : '✗ Not set'}`, process.env.VITE_GITHUB_TOKEN ? 'green' : 'yellow');
  log(`  WORKSPACE_ROOT: ${process.env.WORKSPACE_ROOT}`, 'dim');
}

// Main function
async function main() {
  log('\n🚀 Meta-Gothic Framework Service Manager', 'bright');
  log('=====================================\n', 'dim');
  
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
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check dependencies
    await checkDependencies();
    
    // Check for GitHub token
    checkGitHubToken();
    
    // Start services
    await startServices();
    
    // Wait a bit for services to initialize
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Validate health
    await validateServices();
    
    // Generate supergraph schema
    await generateSupergraph();
    
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