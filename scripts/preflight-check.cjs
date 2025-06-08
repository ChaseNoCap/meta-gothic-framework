#!/usr/bin/env node
/**
 * Pre-flight check for all services
 * Validates dependencies and configuration before starting
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const services = [
  {
    name: 'claude-service',
    path: './services/claude-service',
    checks: [
      { type: 'file', path: 'src/index.ts', description: 'Cosmo entry point' },
      { type: 'port', port: 3002 }
    ]
  },
  {
    name: 'git-service',
    path: './services/git-service',
    checks: [
      { type: 'file', path: 'src/index.ts', description: 'Cosmo entry point' },
      { type: 'port', port: 3004 }
    ]
  },
  {
    name: 'github-adapter',
    path: './services/github-adapter',
    checks: [
      { type: 'file', path: 'src/index.ts', description: 'TypeScript entry point' },
      { type: 'env', var: 'GITHUB_TOKEN', description: 'GitHub API token' },
      { type: 'port', port: 3005 }
    ]
  },
  {
    name: 'gateway',
    path: './services/gothic-gateway',
    checks: [
      { type: 'file', path: 'router/router', description: 'Cosmo router binary' },
      { type: 'file', path: 'config.yaml', description: 'Router runtime configuration' },
      { type: 'file', path: 'generate-config.sh', description: 'Config generation script' },
      { type: 'file', path: 'wgc', description: 'WunderGraph CLI for config generation' },
      { type: 'port', port: 4000 }
    ]
  },
  {
    name: 'ui',
    path: './packages/ui-components',
    checks: [
      { type: 'file', path: 'package.json', description: 'UI package.json' },
      { type: 'file', path: 'start.sh', description: 'UI start script' },
      { type: 'dir', path: 'node_modules', description: 'UI dependencies installed' },
      { type: 'port', port: 3001 }
    ]
  }
];

console.log('🚀 Running pre-flight checks...\n');

let hasErrors = false;

for (const service of services) {
  console.log(`📦 Checking ${service.name}...`);
  
  // Check if service directory exists
  if (!fs.existsSync(service.path)) {
    console.error(`  ❌ Service directory not found: ${service.path}`);
    hasErrors = true;
    continue;
  }
  
  // Change to service directory
  const originalCwd = process.cwd();
  process.chdir(service.path);
  
  // Run checks
  for (const check of service.checks) {
    try {
      switch (check.type) {
        case 'file':
          if (!fs.existsSync(check.path)) {
            console.error(`  ❌ Missing ${check.description}: ${check.path}`);
            hasErrors = true;
          } else {
            console.log(`  ✅ Found ${check.description}`);
          }
          break;
          
        case 'env':
          if (!process.env[check.var] && !fs.existsSync(path.join(originalCwd, '.env.gateway'))) {
            console.warn(`  ⚠️  Missing environment variable: ${check.var} (${check.description})`);
          } else {
            console.log(`  ✅ Environment configured for ${check.description}`);
          }
          break;
          
        case 'dir':
          if (!fs.existsSync(check.path) || !fs.statSync(check.path).isDirectory()) {
            console.error(`  ❌ Missing directory: ${check.path} (${check.description})`);
            hasErrors = true;
          } else {
            console.log(`  ✅ Found ${check.description}`);
          }
          break;
          
        case 'port':
          try {
            execSync(`lsof -i :${check.port}`, { stdio: 'ignore' });
            console.warn(`  ⚠️  Port ${check.port} is already in use`);
          } catch {
            console.log(`  ✅ Port ${check.port} is available`);
          }
          break;
          
        case 'command':
          try {
            execSync(check.cmd, { stdio: 'ignore' });
            console.log(`  ✅ ${check.description} passed`);
          } catch (error) {
            console.error(`  ❌ ${check.description} failed`);
            console.error(`     Run: ${check.cmd}`);
            hasErrors = true;
          }
          break;
          
        case 'package':
          try {
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            if (packageJson.dependencies && packageJson.dependencies[check.name] || 
                packageJson.devDependencies && packageJson.devDependencies[check.name]) {
              console.log(`  ✅ Package ${check.name} installed (${check.description})`);
            } else {
              console.error(`  ❌ Missing package: ${check.name} (${check.description})`);
              console.error(`     Run: npm install ${check.name}`);
              hasErrors = true;
            }
          } catch (error) {
            console.error(`  ❌ Could not check package: ${error.message}`);
            hasErrors = true;
          }
          break;
      }
    } catch (error) {
      console.error(`  ❌ Check failed: ${error.message}`);
      hasErrors = true;
    }
  }
  
  // Return to original directory
  process.chdir(originalCwd);
  console.log('');
}

if (hasErrors) {
  console.error('❌ Pre-flight checks failed. Please fix the issues above before starting services.');
  process.exit(1);
} else {
  console.log('✅ All pre-flight checks passed! Ready to start services.');
}