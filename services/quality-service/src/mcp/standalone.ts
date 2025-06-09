#!/usr/bin/env node
import { TimescaleQualityEngine } from '../core/quality-engine.js';
import { QualityMCPServer } from './server.js';
import type { QualityConfig } from '../types/index.js';

// MCP servers run as standalone processes, not as part of the main service
async function runMCPServer() {
  const config: QualityConfig = {
    database: {
      connectionString: process.env['DATABASE_URL'] || 
        'postgresql://josh@localhost:5432/quality_service',
      poolSize: 5,
      statementTimeout: 30000,
      queryTimeout: 30000
    },
    analysis: {
      excludePatterns: ['node_modules/**', 'dist/**', '*.min.js'],
      ...(process.env['ESLINT_CONFIG'] && { eslintConfig: process.env['ESLINT_CONFIG'] }),
      ...(process.env['PRETTIER_CONFIG'] && { prettierConfig: process.env['PRETTIER_CONFIG'] }),
      ...(process.env['TSCONFIG_PATH'] && { tsconfigPath: process.env['TSCONFIG_PATH'] })
    },
    scoring: {
      errorWeight: 3,
      warningWeight: 1,
      infoWeight: 0.1,
      maxScore: 10
    },
    mcp: {
      heartbeatInterval: 30000,
      sessionTimeout: 3600000 // 1 hour
    }
  };

  try {
    // Initialize the quality engine
    const engine = new TimescaleQualityEngine(config);
    await engine.connect();
    
    // Start MCP Server
    const mcpServer = new QualityMCPServer(engine, config);
    await mcpServer.start();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      await mcpServer.stop();
      await engine.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await mcpServer.stop();
      await engine.disconnect();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Run the server
runMCPServer().catch(console.error);