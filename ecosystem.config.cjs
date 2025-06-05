const path = require('path');

// Get the workspace root (parent directory of this config)
const WORKSPACE_ROOT = path.resolve(__dirname);

module.exports = {
  apps: [
    {
      name: 'claude-service',
      script: 'npx',
      args: 'tsx src/index-yoga.ts',
      cwd: './services/claude-service',
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
      time: true
    },
    {
      name: 'repo-agent-service',
      script: 'npx',
      args: 'tsx src/index-yoga.ts',
      cwd: './services/repo-agent-service',
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
      time: true
    },
    {
      name: 'gateway',
      script: 'npx',
      args: 'tsx src/gateway.ts',
      cwd: './services/meta-gothic-app',
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