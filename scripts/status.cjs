#!/usr/bin/env node

const http = require('http');
const { execSync } = require('child_process');

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
    url: 'http://localhost:3000/graphql',
    type: 'API Gateway'
  },
  {
    name: 'Claude Service',
    port: 3002,
    url: 'http://localhost:3002/graphql',
    type: 'GraphQL Service'
  },
  {
    name: 'Repo Agent Service',
    port: 3004,
    url: 'http://localhost:3004/graphql',
    type: 'GraphQL Service'
  }
];

async function checkService(service) {
  return new Promise((resolve) => {
    const urlParts = new URL(service.url);
    const isGraphQL = service.url.includes('/graphql');
    
    const options = {
      hostname: urlParts.hostname,
      port: urlParts.port,
      path: urlParts.pathname,
      method: isGraphQL ? 'POST' : 'GET',
      timeout: 1000,
      headers: isGraphQL ? {
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
    
    if (isGraphQL) {
      request.write(JSON.stringify({ query: '{ __schema { queryType { name } } }' }));
    }
    
    request.end();
  });
}

function getProcessInfo(port) {
  try {
    const pid = execSync(`lsof -ti:${port}`, { encoding: 'utf8' }).trim();
    if (pid) {
      const info = execSync(`ps -p ${pid} -o pid,command`, { encoding: 'utf8' });
      return { pid, running: true };
    }
  } catch (e) {
    return { pid: null, running: false };
  }
  return { pid: null, running: false };
}

async function checkStatus() {
  log('\n📊 Meta-GOTHIC Services Status\n', 'blue');
  
  let allHealthy = true;
  
  for (const service of services) {
    const processInfo = getProcessInfo(service.port);
    const isResponding = await checkService(service);
    const status = processInfo.running && isResponding;
    
    allHealthy = allHealthy && status;
    
    const statusIcon = status ? '✅' : '❌';
    const statusText = status ? 'Running' : 'Stopped';
    const statusColor = status ? 'green' : 'red';
    
    log(`${statusIcon} ${service.name} (${service.type})`, statusColor);
    log(`   Port: ${service.port}`, 'reset');
    log(`   URL: ${service.url}`, 'reset');
    
    if (processInfo.pid) {
      log(`   PID: ${processInfo.pid}`, 'reset');
    }
    
    if (!status) {
      if (processInfo.running && !isResponding) {
        log(`   ⚠️  Process running but not responding`, 'yellow');
      } else {
        log(`   ⚠️  Service is not running`, 'yellow');
      }
    }
    
    console.log('');
  }
  
  if (allHealthy) {
    log('✅ All services are running!\n', 'green');
    log('🚀 Quick Commands:', 'blue');
    log('   npm run stop     - Stop all services', 'reset');
    log('   npm run restart  - Restart all services', 'reset');
    log('   npm run logs     - View all logs', 'reset');
  } else {
    log('❌ Some services are not running\n', 'red');
    log('🛠️  To start all services: npm run start\n', 'yellow');
  }
}

checkStatus();