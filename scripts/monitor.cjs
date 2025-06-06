#!/usr/bin/env node

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
  clear: '\x1b[2J\x1b[H',
  clearLine: '\x1b[2K',
  saveCursor: '\x1b7',
  restoreCursor: '\x1b8'
};

const services = [
  { name: 'ui', displayName: 'UI Components', port: 3001 },
  { name: 'gateway', displayName: 'GraphQL Gateway', port: 3000 },
  { name: 'claude-service', displayName: 'Claude Service', port: 3002 },
  { name: 'git-service', displayName: 'Git Service', port: 3004 },
  { name: 'github-adapter', displayName: 'GitHub Adapter', port: 3005 }
];

// Terminal cursor control
function moveCursor(row, col) {
  process.stdout.write(`\x1b[${row};${col}H`);
}

function clearFromCursor() {
  process.stdout.write('\x1b[J');
}

function log(message, color = 'reset', newline = true) {
  const output = `${colors[color]}${message}${colors.reset}`;
  if (newline) {
    console.log(output);
  } else {
    process.stdout.write(output);
  }
}

function getPM2Status() {
  try {
    const output = execSync('npx pm2 jlist', { encoding: 'utf8' });
    return JSON.parse(output);
  } catch (e) {
    return [];
  }
}

function getServiceStatus(pm2List, serviceName) {
  const process = pm2List.find(p => p.name === serviceName);
  if (!process) {
    return { status: 'stopped', cpu: 0, memory: 0, restarts: 0, uptime: 0 };
  }
  
  return {
    status: process.pm2_env.status,
    cpu: process.monit ? process.monit.cpu : 0,
    memory: process.monit ? Math.round(process.monit.memory / 1024 / 1024) : 0,
    restarts: process.pm2_env.restart_time || 0,
    uptime: process.pm2_env.pm_uptime || Date.now()
  };
}

function formatUptime(startTime) {
  const uptime = Date.now() - startTime;
  const seconds = Math.floor(uptime / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function getStatusIcon(status) {
  switch (status) {
    case 'online': return '🟢';
    case 'stopping': return '🟡';
    case 'stopped': return '🔴';
    case 'errored': return '❌';
    default: return '⚪';
  }
}

let isFirstRender = true;
const HEADER_LINES = 4;
const SERVICE_START_LINE = 7;
const STATUS_LINE = SERVICE_START_LINE + services.length + 2;
const COMMANDS_START_LINE = STATUS_LINE + 2;

async function displayStatus(fullRedraw = false) {
  if (isFirstRender || fullRedraw) {
    // Clear screen and draw static content
    process.stdout.write(colors.clear);
    
    // Header
    log('🚀 Meta-Gothic Framework Monitor', 'cyan');
    log('=' .repeat(50), 'gray');
    moveCursor(3, 1);
    log('Updated: ', 'gray', false);
    log('');
    
    // Service header
    moveCursor(5, 1);
    log('📊 Service Status:', 'yellow');
    log('─'.repeat(50), 'gray');
    
    // Commands section (static)
    moveCursor(COMMANDS_START_LINE, 1);
    log('📋 Service Commands:', 'cyan');
    log('  [R] Restart all       [S] Stop all         [T] Start all', 'yellow');
    log('  [L] Show logs         [M] PM2 monitor      [D] Delete all', 'yellow');
    
    log('\n🛠️  Utilities:', 'cyan');
    log('  [B] Build all         [C] Clean ports      [F] Flush logs', 'yellow');
    log('  [U] Update submodules [I] Install deps     [G] Git status', 'yellow');
    log('  [P] List processes    [N] NPM outdated     [H] Health check', 'yellow');
    
    log('\n🎯 Quick Actions:', 'cyan');
    log('  [1] Restart Gateway   [2] Restart UI       [3] Restart Claude', 'yellow');
    log('  [4] Restart Repo      [W] Open web UI      [A] API playground', 'yellow');
    
    log('\n[Q] Quit monitor', 'gray');
    log('\nPress a key to select an option...', 'gray');
    
    isFirstRender = false;
  }
  
  // Update timestamp
  moveCursor(3, 10);
  process.stdout.write(colors.clearLine);
  log(new Date().toLocaleTimeString(), 'gray', false);
  
  // Get PM2 status
  const pm2List = getPM2Status();
  
  // Update service status (only the dynamic parts)
  let allRunning = true;
  
  for (let i = 0; i < services.length; i++) {
    const service = services[i];
    const status = getServiceStatus(pm2List, service.name);
    const icon = getStatusIcon(status.status);
    
    if (status.status !== 'online') {
      allRunning = false;
    }
    
    // Move to service line and clear it
    moveCursor(SERVICE_START_LINE + i, 1);
    process.stdout.write(colors.clearLine);
    
    // Redraw service line
    log(`${icon} ${service.displayName.padEnd(20)} Port: ${service.port}`, 'reset', false);
    
    if (status.status === 'online') {
      log(` | CPU: ${status.cpu.toString().padStart(3)}% | RAM: ${status.memory.toString().padStart(4)}MB | ↻ ${status.restarts} | ⏱️  ${formatUptime(status.uptime)}`, 'green');
    } else {
      log(` | ${status.status.toUpperCase()}`, 'red');
    }
  }
  
  // Update overall status
  moveCursor(STATUS_LINE, 1);
  process.stdout.write(colors.clearLine);
  if (allRunning) {
    log('✅ All services are running!', 'green');
  } else {
    log('❌ Some services are not running', 'red');
  }
  
  // Move cursor to end
  moveCursor(COMMANDS_START_LINE + 14, 1);
}

async function startServices() {
  log('\n🚀 Starting all services...', 'cyan');
  
  try {
    // Use our start script
    execSync('node scripts/start.cjs', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    
    log('\n✅ All services started!', 'green');
    log('Press any key to continue...', 'gray');
    
  } catch (error) {
    log(`\n❌ Failed to start services: ${error.message}`, 'red');
    log('Press any key to continue...', 'gray');
  }
}

async function stopServices() {
  log('\n⏹️  Stopping all services...', 'cyan');
  
  try {
    execSync('npx pm2 stop all', { stdio: 'inherit' });
    log('\n✅ All services stopped!', 'green');
    log('Press any key to continue...', 'gray');
  } catch (error) {
    log(`\n❌ Failed to stop services: ${error.message}`, 'red');
    log('Press any key to continue...', 'gray');
  }
}

async function restartServices() {
  log('\n🔄 Restarting all services...', 'cyan');
  
  try {
    execSync('npx pm2 restart all', { stdio: 'inherit' });
    log('\n✅ All services restarted!', 'green');
    log('Press any key to continue...', 'gray');
  } catch (error) {
    log(`\n❌ Failed to restart services: ${error.message}`, 'red');
    log('Press any key to continue...', 'gray');
  }
}

async function deleteServices() {
  log('\n🗑️  Deleting all PM2 processes...', 'cyan');
  
  try {
    execSync('npx pm2 delete all', { stdio: 'inherit' });
    log('\n✅ All PM2 processes deleted!', 'green');
    log('Press any key to continue...', 'gray');
  } catch (error) {
    log(`\n❌ Failed to delete processes: ${error.message}`, 'red');
    log('Press any key to continue...', 'gray');
  }
}

async function restartService(serviceName) {
  log(`\n🔄 Restarting ${serviceName}...`, 'cyan');
  
  try {
    execSync(`npx pm2 restart ${serviceName}`, { stdio: 'inherit' });
    log(`\n✅ ${serviceName} restarted!`, 'green');
    log('Press any key to continue...', 'gray');
  } catch (error) {
    log(`\n❌ Failed to restart ${serviceName}: ${error.message}`, 'red');
    log('Press any key to continue...', 'gray');
  }
}

async function buildAll() {
  log('\n🔨 Building all packages...', 'cyan');
  
  try {
    execSync('npm run build', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    log('\n✅ Build complete!', 'green');
    log('Press any key to continue...', 'gray');
  } catch (error) {
    log(`\n❌ Build failed: ${error.message}`, 'red');
    log('Press any key to continue...', 'gray');
  }
}

async function cleanPorts() {
  log('\n🧹 Cleaning ports...', 'cyan');
  
  try {
    execSync('node scripts/cleanup-ports.cjs', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    log('\n✅ Ports cleaned!', 'green');
    log('Press any key to continue...', 'gray');
  } catch (error) {
    log(`\n❌ Clean failed: ${error.message}`, 'red');
    log('Press any key to continue...', 'gray');
  }
}

async function flushLogs() {
  log('\n🚿 Flushing PM2 logs...', 'cyan');
  
  try {
    execSync('npx pm2 flush', { stdio: 'inherit' });
    log('\n✅ Logs flushed!', 'green');
    log('Press any key to continue...', 'gray');
  } catch (error) {
    log(`\n❌ Failed to flush logs: ${error.message}`, 'red');
    log('Press any key to continue...', 'gray');
  }
}

async function updateSubmodules() {
  log('\n📦 Updating submodules...', 'cyan');
  
  try {
    execSync('git submodule update --remote --merge', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    log('\n✅ Submodules updated!', 'green');
    log('Press any key to continue...', 'gray');
  } catch (error) {
    log(`\n❌ Update failed: ${error.message}`, 'red');
    log('Press any key to continue...', 'gray');
  }
}

async function installDeps() {
  log('\n📥 Installing dependencies...', 'cyan');
  
  try {
    execSync('npm install', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    log('\n✅ Dependencies installed!', 'green');
    log('Press any key to continue...', 'gray');
  } catch (error) {
    log(`\n❌ Install failed: ${error.message}`, 'red');
    log('Press any key to continue...', 'gray');
  }
}

async function gitStatus() {
  log('\n📊 Git status:', 'cyan');
  
  try {
    execSync('git status', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    log('\nPress any key to continue...', 'gray');
  } catch (error) {
    log(`\n❌ Git status failed: ${error.message}`, 'red');
    log('Press any key to continue...', 'gray');
  }
}

async function listProcesses() {
  log('\n📋 All processes:', 'cyan');
  
  try {
    execSync('ps aux | grep -E "node|pm2" | grep -v grep', {
      stdio: 'inherit'
    });
    log('\nPress any key to continue...', 'gray');
  } catch (error) {
    log(`\n❌ Failed to list processes: ${error.message}`, 'red');
    log('Press any key to continue...', 'gray');
  }
}

async function npmOutdated() {
  log('\n📦 Checking outdated packages...', 'cyan');
  
  try {
    execSync('npm outdated', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
  } catch (error) {
    // npm outdated returns non-zero if packages are outdated
  }
  log('\nPress any key to continue...', 'gray');
}

async function healthCheck() {
  log('\n🏥 Running health checks...', 'cyan');
  
  for (const service of services) {
    try {
      const response = await fetch(`http://localhost:${service.port}/health`);
      if (response.ok) {
        log(`✅ ${service.displayName}: Healthy`, 'green');
      } else {
        log(`❌ ${service.displayName}: Unhealthy (${response.status})`, 'red');
      }
    } catch (error) {
      log(`❌ ${service.displayName}: Not reachable`, 'red');
    }
  }
  
  log('\nPress any key to continue...', 'gray');
}

async function openWebUI() {
  log('\n🌐 Opening web UI...', 'cyan');
  
  try {
    const platform = process.platform;
    const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
    execSync(`${command} http://localhost:3001`);
    log('✅ Opened in browser!', 'green');
  } catch (error) {
    log('❌ Failed to open browser. Navigate to http://localhost:3001', 'red');
  }
  
  log('Press any key to continue...', 'gray');
}

async function openAPIPlayground() {
  log('\n🎮 Opening API playground...', 'cyan');
  
  try {
    const platform = process.platform;
    const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
    execSync(`${command} http://localhost:3000/graphql`);
    log('✅ Opened in browser!', 'green');
  } catch (error) {
    log('❌ Failed to open browser. Navigate to http://localhost:3000/graphql', 'red');
  }
  
  log('Press any key to continue...', 'gray');
}

function openPM2Logs() {
  log('\n📜 Opening PM2 logs (press Ctrl+C to exit)...', 'cyan');
  
  // Spawn PM2 logs in a new process that takes over the terminal
  const logs = spawn('npx', ['pm2', 'logs'], {
    stdio: 'inherit'
  });
  
  logs.on('close', () => {
    // When user exits logs (Ctrl+C), force full redraw
    isFirstRender = true;
    displayStatus(true);
  });
}

function openPM2Monitor() {
  log('\n📊 Opening PM2 monitor (press Ctrl+C to exit)...', 'cyan');
  
  // Spawn PM2 monit in a new process that takes over the terminal
  const monit = spawn('npx', ['pm2', 'monit'], {
    stdio: 'inherit'
  });
  
  monit.on('close', () => {
    // When user exits monit, force full redraw
    isFirstRender = true;
    displayStatus(true);
  });
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
  await displayStatus(true);
  
  // Set up auto-refresh every 2 seconds
  refreshInterval = setInterval(async () => {
    if (!waitingForKeypress && process.stdin.isTTY) {
      await displayStatus(false);
    }
  }, 2000);
  
  // Handle keyboard input
  process.stdin.on('keypress', async (str, key) => {
    if (waitingForKeypress && str !== 'l' && str !== 'm') {
      // Any key continues after an action (except for logs/monitor which handle their own exit)
      waitingForKeypress = false;
      isFirstRender = true; // Force full redraw after actions
      await displayStatus(true);
      return;
    }
    
    if (key && key.ctrl && key.name === 'c') {
      // Ctrl+C to exit
      running = false;
      clearInterval(refreshInterval);
      process.stdout.write(colors.clear);
      log('\n👋 Exiting monitor...', 'yellow');
      process.exit(0);
    }
    
    const input = str ? str.toLowerCase() : '';
    
    // Helper to pause refresh and wait for keypress
    const pauseAndWait = async (action) => {
      waitingForKeypress = true;
      clearInterval(refreshInterval);
      process.stdout.write(colors.clear); // Clear for action output
      await action();
      refreshInterval = setInterval(async () => {
        if (!waitingForKeypress && process.stdin.isTTY) {
          await displayStatus(false);
        }
      }, 2000);
    };
    
    switch (input) {
      case 'q':
        running = false;
        clearInterval(refreshInterval);
        process.stdout.write(colors.clear);
        log('\n👋 Exiting monitor...', 'yellow');
        process.exit(0);
        break;
        
      // Service commands
      case 'r': await pauseAndWait(restartServices); break;
      case 's': await pauseAndWait(stopServices); break;
      case 't': await pauseAndWait(startServices); break;
      case 'd': await pauseAndWait(deleteServices); break;
      
      // Utilities
      case 'b': await pauseAndWait(buildAll); break;
      case 'c': await pauseAndWait(cleanPorts); break;
      case 'f': await pauseAndWait(flushLogs); break;
      case 'u': await pauseAndWait(updateSubmodules); break;
      case 'i': await pauseAndWait(installDeps); break;
      case 'g': await pauseAndWait(gitStatus); break;
      case 'p': await pauseAndWait(listProcesses); break;
      case 'n': await pauseAndWait(npmOutdated); break;
      case 'h': await pauseAndWait(healthCheck); break;
      
      // Quick actions
      case '1': await pauseAndWait(() => restartService('gateway')); break;
      case '2': await pauseAndWait(() => restartService('ui')); break;
      case '3': await pauseAndWait(() => restartService('claude-service')); break;
      case '4': await pauseAndWait(() => restartService('git-service')); break;
      case 'w': await pauseAndWait(openWebUI); break;
      case 'a': await pauseAndWait(openAPIPlayground); break;
      
      // Special cases that take over terminal
      case 'l':
        clearInterval(refreshInterval);
        process.stdout.write(colors.clear);
        openPM2Logs();
        refreshInterval = setInterval(async () => {
          if (!waitingForKeypress && process.stdin.isTTY) {
            await displayStatus(false);
          }
        }, 2000);
        break;
        
      case 'm':
        clearInterval(refreshInterval);
        process.stdout.write(colors.clear);
        openPM2Monitor();
        refreshInterval = setInterval(async () => {
          if (!waitingForKeypress && process.stdin.isTTY) {
            await displayStatus(false);
          }
        }, 2000);
        break;
    }
  });
  
  // Keep the process running
  process.stdin.resume();
}

// Handle process termination
process.on('SIGINT', () => {
  process.stdout.write(colors.clear);
  log('\n👋 Exiting monitor...', 'yellow');
  process.exit(0);
});

// Run the main function
main().catch(error => {
  log(`Fatal error: ${error.message}`, 'red');
  process.exit(1);
});