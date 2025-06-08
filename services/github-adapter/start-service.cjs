#!/usr/bin/env node

// This is a wrapper script for PM2 to properly start the TypeScript service
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load .env.gateway file if GITHUB_TOKEN is not set
if (!process.env.GITHUB_TOKEN) {
  const envPath = path.join(__dirname, '../..', '.env.gateway');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
  }
}

// Check again after loading
if (!process.env.GITHUB_TOKEN) {
  console.error('ERROR: GITHUB_TOKEN environment variable is required');
  console.error('Please set it in .env.gateway or as an environment variable');
  process.exit(1);
}

console.log('Starting GitHub service...');

// Use npx to run tsx with the TypeScript file
const child = spawn('npx', ['tsx', 'src/index.ts'], {
  stdio: 'inherit',
  env: process.env,
  cwd: __dirname
});

// Forward exit codes
child.on('exit', (code) => {
  process.exit(code || 0);
});

// Handle errors
child.on('error', (err) => {
  console.error('Failed to start service:', err);
  process.exit(1);
});