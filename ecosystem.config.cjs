const path = require('path');

// Get the workspace root (parent directory of this config)
const WORKSPACE_ROOT = path.resolve(__dirname);

module.exports = {
  apps: [
    {
      name: 'claude-service',
      script: './start.sh',
      cwd: './services/claude-service',
      interpreter: 'bash',
      env: {
        NODE_ENV: 'development',
        PORT: 3002,
        WORKSPACE_ROOT: WORKSPACE_ROOT,
        FEDERATION: 'cosmo',
        CLAUDE_DANGEROUS_MODE: 'true' // Enable for development - grants all permissions
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
      name: 'git-service',
      script: './start.sh',
      cwd: './services/git-service',
      interpreter: 'bash',
      env: {
        NODE_ENV: 'development',
        PORT: 3004,
        WORKSPACE_ROOT: WORKSPACE_ROOT,
        FEDERATION: 'cosmo'
      },
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/git-service-error.log',
      out_file: './logs/git-service-out.log',
      log_file: './logs/git-service-combined.log',
      time: true,
      combine_logs: true,
      merge_logs: true
    },
    {
      name: 'github-adapter',
      script: './start.sh',
      cwd: './services/github-adapter',
      interpreter: 'bash',
      env: {
        NODE_ENV: 'development',
        PORT: 3005,
        WORKSPACE_ROOT: WORKSPACE_ROOT,
        FEDERATION: 'cosmo'
      },
      env_file: path.join(__dirname, '.env.gateway'),
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/github-adapter-error.log',
      out_file: './logs/github-adapter-out.log',
      log_file: './logs/github-adapter-combined.log',
      time: true,
      combine_logs: true,
      merge_logs: true
    },
    {
      name: 'gateway',
      script: './start-router-pm2.sh',
      cwd: './services/gothic-gateway',
      interpreter: 'bash',
      env: {
        NODE_ENV: 'development',
        PORT: 4000,
        WORKSPACE_ROOT: WORKSPACE_ROOT,
        CONFIG_PATH: './config.yaml',
        EXECUTION_CONFIG_FILE_PATH: './config.json',
        DEV_MODE: 'true'
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
      kill_timeout: 10000,
      listen_timeout: 60000,
      shutdown_with_message: true
    },
    {
      name: 'ui',
      script: './start.sh',
      cwd: './packages/ui-components',
      interpreter: 'bash',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
        VITE_PORT: 3001,
        VITE_GATEWAY_URL: 'http://localhost:4000/graphql',
        VITE_GATEWAY_WS_URL: 'ws://localhost:4000/graphql',
        WORKSPACE_ROOT: WORKSPACE_ROOT
      },
      env_file: path.join(__dirname, 'packages/ui-components/.env.local'),
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/ui-error.log',
      out_file: './logs/ui-out.log',
      log_file: './logs/ui-combined.log',
      time: true,
      combine_logs: true,
      merge_logs: true
    }
  ]
};