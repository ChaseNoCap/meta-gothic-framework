const path = require('path');

// Get the workspace root (parent directory of this config)
const WORKSPACE_ROOT = path.resolve(__dirname);

module.exports = {
  apps: [
    {
      name: 'claude-service',
      script: 'npx',
      args: 'tsx src/index-federation.ts',
      cwd: './services/claude-service',
      interpreter: '/Users/josh/.nvm/versions/node/v18.20.8/bin/node',
      env: {
        NODE_ENV: 'development',
        PORT: 3002,
        WORKSPACE_ROOT: WORKSPACE_ROOT
      },
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/claude-service-error.log',
      out_file: './logs/claude-service-out.log',
      log_file: './logs/claude-service-combined.log',
      time: true,
      combine_logs: true,
      merge_logs: true
    },
    {
      name: 'repo-agent-service',
      script: 'npx',
      args: 'tsx src/index-federation.ts',
      cwd: './services/repo-agent-service',
      interpreter: '/Users/josh/.nvm/versions/node/v18.20.8/bin/node',
      env: {
        NODE_ENV: 'development',
        PORT: 3004,
        WORKSPACE_ROOT: WORKSPACE_ROOT
      },
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/repo-agent-error.log',
      out_file: './logs/repo-agent-out.log',
      log_file: './logs/repo-agent-combined.log',
      time: true,
      combine_logs: true,
      merge_logs: true
    },
    {
      name: 'github-mesh',
      script: './start-service.cjs',
      cwd: './services/github-mesh',
      env: {
        NODE_ENV: 'development',
        PORT: 3005,
        WORKSPACE_ROOT: WORKSPACE_ROOT,
        DEBUG: '1' // Enable verbose logging
      },
      env_file: path.join(__dirname, '.env.gateway'),
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/github-mesh-error.log',
      out_file: './logs/github-mesh-out.log',
      log_file: './logs/github-mesh-combined.log',
      time: true,
      // Ensure errors are properly captured
      combine_logs: true,
      merge_logs: true,
      log_type: 'json',
      // Enable restart but limit it
      autorestart: true,
      max_restarts: 3,
      min_uptime: '10s'
    },
    {
      name: 'gateway',
      script: 'npx',
      args: 'tsx src/gateway-federation.ts',
      cwd: './services/meta-gothic-app',
      interpreter: '/Users/josh/.nvm/versions/node/v18.20.8/bin/node',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        WORKSPACE_ROOT: WORKSPACE_ROOT
      },
      env_file: path.join(__dirname, '.env.gateway'),
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/gateway-error.log',
      out_file: './logs/gateway-out.log',
      log_file: './logs/gateway-combined.log',
      time: true,
      combine_logs: true,
      merge_logs: true,
      // Wait for other services before starting
      wait_ready: true,
      listen_timeout: 10000
    },
    {
      name: 'ui',
      script: 'bash',
      args: '-c "cd ./packages/ui-components && npm run dev"',
      cwd: './',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
        WORKSPACE_ROOT: WORKSPACE_ROOT,
        // Vite will load .env.local automatically from the package directory
      },
      watch: false,
      max_memory_restart: '2G',
      error_file: './logs/ui-error.log',
      out_file: './logs/ui-out.log',
      log_file: './logs/ui-combined.log',
      time: true
    }
  ]
};