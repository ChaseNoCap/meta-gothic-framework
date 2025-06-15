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

// Service configuration
const services = [
  { name: 'gateway', displayName: 'Cosmo Router', port: 4000 },
  { name: 'claude-service', displayName: 'Claude Service', port: 3002 },
  { name: 'git-service', displayName: 'Git Service', port: 3004 },
  { name: 'github-adapter', displayName: 'GitHub Adapter', port: 3005 },
  { name: 'quality-service', displayName: 'Quality Service (MCP)', port: 3006, isQualityMcp: true },
  { name: 'quality-service', displayName: 'Quality Service (GraphQL)', port: 3007, isQualityGraphql: true },
  { name: 'ui', displayName: 'UI Dashboard', port: 3001 }
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
  } catch (error) {
    return [];
  }
}

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatMemory(bytes) {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(1)}MB`;
}

function truncateWithEllipsis(str, maxLength) {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

function getServiceStatus(pm2Process) {
  const status = pm2Process.pm2_env.status;
  const color = status === 'online' ? 'green' : status === 'stopped' ? 'red' : 'yellow';
  const icon = status === 'online' ? '✓' : status === 'stopped' ? '✗' : '⚡';
  return { status, color, icon };
}

function renderHeader() {
  process.stdout.write(colors.clear);
  log('🚀 Meta-Gothic Services Monitor', 'cyan');
  log('━'.repeat(80), 'gray');
  log('');
}

function renderServices(processes) {
  // Fixed column widths for 80-char limit (no icon)
  // name + │_(2) + status + _│_(3) + port + _│_(3) + uptime + _│_(3) + cpu + _│_(3) + mem + _│_(3) + restart = 80
  const nameWidth = 26;  // Service name (increased by 2 from removed icon)
  const statusWidth = 8;  // Status  
  const portWidth = 4;   // Port number
  const uptimeWidth = 8;  // Uptime
  const cpuWidth = 5;    // CPU
  const memWidth = 7;    // Memory
  const restartWidth = 3; // Restarts
  // Total: 26 + 2 + 8 + 3 + 4 + 3 + 8 + 3 + 5 + 3 + 7 + 3 + 3 = 78 (leaving 2 for padding)
  
  // Header row
  log('Service'.padEnd(nameWidth), 'gray', false);
  log('│ ', 'gray', false);
  log('Status'.padEnd(statusWidth), 'gray', false);
  log(' │ ', 'gray', false);
  log('Port'.padEnd(portWidth), 'gray', false);
  log(' │ ', 'gray', false);
  log('Uptime'.padEnd(uptimeWidth), 'gray', false);
  log(' │ ', 'gray', false);
  log('CPU'.padEnd(cpuWidth), 'gray', false);
  log(' │ ', 'gray', false);
  log('Memory'.padEnd(memWidth), 'gray', false);
  log(' │ ', 'gray', false);
  log('🔄', 'gray');
  log('─'.repeat(80), 'gray');
  
  services.forEach(service => {
    // For quality service entries, we show the same PM2 process but different ports
    const pm2Process = processes.find(p => p.name === service.name);
    
    if (pm2Process) {
      const { status, color, icon } = getServiceStatus(pm2Process);
      const uptime = pm2Process.pm2_env.status === 'online' ? formatUptime(Date.now() - pm2Process.pm2_env.pm_uptime) : '-';
      const memory = pm2Process.monit ? formatMemory(pm2Process.monit.memory) : '-';
      const cpu = pm2Process.monit ? `${pm2Process.monit.cpu}%` : '-';
      const restarts = pm2Process.pm2_env.restart_time || 0;
      
      // Format each field with fixed width
      const name = truncateWithEllipsis(service.displayName, nameWidth).padEnd(nameWidth);
      const statusStr = status.toUpperCase().substring(0, statusWidth).padEnd(statusWidth);
      const portStr = String(service.port).substring(0, portWidth).padEnd(portWidth);
      const uptimeStr = uptime.substring(0, uptimeWidth).padEnd(uptimeWidth);
      const cpuStr = cpu.substring(0, cpuWidth).padEnd(cpuWidth);
      const memStr = memory.substring(0, memWidth).padEnd(memWidth);
      const restartStr = String(restarts).substring(0, restartWidth).padEnd(restartWidth);
      
      // Build the line (no icon)
      log(`${name}`, 'reset', false);
      log('│ ', 'gray', false);
      log(`${statusStr}`, color, false);
      log(' │ ', 'gray', false);
      log(`${portStr}`, 'reset', false);
      log(' │ ', 'gray', false);
      log(`${uptimeStr}`, 'reset', false);
      log(' │ ', 'gray', false);
      log(`${cpuStr}`, 'reset', false);
      log(' │ ', 'gray', false);
      log(`${memStr}`, 'reset', false);
      log(' │ ', 'gray', false);
      log(`${restartStr}`, restarts > 0 ? 'yellow' : 'reset');
    } else {
      const name = truncateWithEllipsis(service.displayName, nameWidth).padEnd(nameWidth);
      log(`${name}`, 'reset', false);
      log('│ ', 'gray', false);
      log(`NOT FOUND`, 'red');
    }
  });
}

function renderLogs(processes) {
  log('');
  log('━'.repeat(80), 'gray');
  log('📋 Recent Logs (last error from each service):', 'cyan');
  log('');
  
  services.forEach(service => {
    const pm2Process = processes.find(p => p.name === service.name);
    if (pm2Process && pm2Process.pm2_env.status === 'errored') {
      log(`${service.displayName}:`, 'yellow');
      try {
        const errorLog = execSync(`npx pm2 logs ${service.name} --err --lines 3 --nostream`, { encoding: 'utf8' });
        const lines = errorLog.split('\n').filter(line => line.trim());
        lines.forEach(line => {
          // Truncate long log lines to fit 80 chars (with 2-space indent)
          const truncated = line.substring(0, 76);
          log(`  ${truncated}`, 'gray');
        });
      } catch (error) {
        log('  Unable to fetch logs', 'gray');
      }
      log('');
    }
  });
}

function renderFooter() {
  log('━'.repeat(80), 'gray');
  log('');
  log('Commands:', 'cyan');
  log('  l - View logs           r - Restart all       s - Stop all', 'gray');
  log(`  1-${services.length} - Restart service   m - PM2 monit         q - Quit`, 'gray');
  log('');
  log('Endpoints:', 'cyan');
  log('  Gateway (Cosmo Router): http://localhost:4000/graphql', 'gray');
  log('  UI Dashboard: http://localhost:3001', 'gray');
  log('  Services: Direct access via ports above', 'gray');
}

let showLogs = false;

function render() {
  const processes = getPM2Status();
  
  renderHeader();
  renderServices(processes);
  
  if (showLogs) {
    renderLogs(processes);
  }
  
  renderFooter();
}

// Set up key handling
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

process.stdin.on('keypress', (str, key) => {
  if (key.ctrl && key.name === 'c') {
    process.stdout.write(colors.clear);
    process.exit();
  }
  
  switch (str) {
    case 'q':
      process.stdout.write(colors.clear);
      process.exit();
      break;
      
    case 'l':
      showLogs = !showLogs;
      render();
      break;
      
    case 'r':
      log('\nRestarting all services...', 'yellow');
      try {
        execSync('npx pm2 restart all');
        log('All services restarted!', 'green');
      } catch (error) {
        log('Failed to restart services', 'red');
      }
      setTimeout(render, 2000);
      break;
      
    case 's':
      log('\nStopping all services...', 'yellow');
      try {
        execSync('npx pm2 stop all');
        log('All services stopped!', 'green');
      } catch (error) {
        log('Failed to stop services', 'red');
      }
      setTimeout(render, 2000);
      break;
      
    case 'm':
      process.stdout.write(colors.clear);
      const monit = spawn('npx', ['pm2', 'monit'], { stdio: 'inherit' });
      monit.on('close', () => {
        render();
      });
      break;
      
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
    case '7':
      const index = parseInt(str) - 1;
      if (index < services.length) {
        const service = services[index];
        // Get unique service name (for quality service, both entries restart the same process)
        const uniqueServices = [...new Set(services.map(s => s.name))];
        const actualServiceName = service.name;
        
        log(`\nRestarting ${service.displayName}...`, 'yellow');
        try {
          execSync(`npx pm2 restart ${actualServiceName}`);
          log(`${service.displayName} restarted!`, 'green');
        } catch (error) {
          log(`Failed to restart ${service.displayName}`, 'red');
        }
        setTimeout(render, 2000);
      }
      break;
  }
});

// Initial render
render();

// Update every 2 seconds
setInterval(render, 2000);

// Handle exit
process.on('SIGINT', () => {
  process.stdout.write(colors.clear);
  process.exit();
});

process.on('SIGTERM', () => {
  process.stdout.write(colors.clear);
  process.exit();
});