#!/usr/bin/env node
/**
 * Debug helper for PM2 services
 * Shows real-time logs and errors from a service
 */

const { spawn } = require('child_process');
const path = require('path');

const serviceName = process.argv[2];

if (!serviceName) {
  console.error('Usage: node debug-service.cjs <service-name>');
  console.error('Available services: claude-service, git-service, github-adapter, gateway, ui');
  process.exit(1);
}

console.log(`🔍 Debugging ${serviceName}...`);
console.log('---');

// Show service status
const status = spawn('pm2', ['show', serviceName], { stdio: 'inherit' });

status.on('close', () => {
  console.log('\n📋 Recent logs:');
  console.log('---');
  
  // Tail logs with proper error output
  const logs = spawn('pm2', ['logs', serviceName, '--lines', '100', '--nostream'], {
    stdio: 'inherit'
  });
  
  logs.on('close', () => {
    console.log('\n🔄 Following live logs (Ctrl+C to exit):');
    console.log('---');
    
    // Follow logs in real-time
    spawn('pm2', ['logs', serviceName], { stdio: 'inherit' });
  });
});