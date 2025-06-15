import { TimescaleQualityEngine } from './core/quality-engine.js';
import { QualityMCPServer } from './mcp/server.js';
import { QualityGraphQLServer } from './graphql-server.js';
import type { QualityConfig } from './types/index.js';

// Default configuration
const defaultConfig: QualityConfig = {
  database: {
    connectionString: process.env['DATABASE_URL'] || 
      'postgresql://josh@localhost:5432/quality_service',
    poolSize: 10,
    statementTimeout: 30000,
    queryTimeout: 30000
  },
  analysis: {
    excludePatterns: ['node_modules/**', 'dist/**', '*.min.js']
  },
  scoring: {
    errorWeight: 3,
    warningWeight: 1,
    infoWeight: 0.1,
    maxScore: 10
  },
  mcp: {
    port: parseInt(process.env['MCP_PORT'] || '3006'),
    heartbeatInterval: 30000
  }
};

// Track server instances for cleanup
let engine: TimescaleQualityEngine | null = null;
let mcpServer: QualityMCPServer | null = null;
let graphqlServer: QualityGraphQLServer | null = null;

async function main(): Promise<void> {
  console.log('🚀 Starting Quality Service...');
  console.log(`   Process ID: ${process.pid}`);
  console.log(`   Node version: ${process.version}`);
  console.log(`   Environment: ${process.env['NODE_ENV'] || 'development'}`);
  
  try {
    // Initialize the quality engine
    console.log('📊 Initializing Quality Engine...');
    engine = new TimescaleQualityEngine(defaultConfig);
    await engine.connect();
    console.log('✅ Connected to TimescaleDB');

    // Start MCP Server
    console.log('🔌 Starting MCP Server...');
    mcpServer = new QualityMCPServer(engine, defaultConfig);
    await mcpServer.start();
    console.log(`✅ MCP Server started on port ${defaultConfig.mcp?.port || 3006}`);

    // Start GraphQL Server
    console.log('🌐 Starting GraphQL Server...');
    graphqlServer = new QualityGraphQLServer(engine, defaultConfig);
    const graphqlPort = parseInt(process.env['GRAPHQL_PORT'] || '3007');
    await graphqlServer.start(graphqlPort);
    console.log(`✅ GraphQL Server started on http://localhost:${graphqlPort}/graphql`);

    // For now, just demonstrate basic functionality
    console.log('\n📊 Quality Service is ready!');
    console.log('   - Database: Connected');
    console.log('   - MCP Server: Ready (stdio)');
    console.log('   - GraphQL API: http://localhost:3007/graphql');
    
    // Example: Process a test file
    if (process.argv[2] === 'test') {
      console.log('\n🧪 Running test analysis...');
      const testFile = process.argv[3] || './test-files/sample.js';
      
      const result = await engine.processFile(testFile, {
        sessionType: 'HEADLESS',
        triggeredBy: 'cli-test'
      });
      
      console.log(`\n📈 Analysis Results for ${testFile}:`);
      console.log(`   - Session ID: ${result.session.id}`);
      console.log(`   - Quality Score: ${result.metrics?.qualityScore?.toFixed(2) || 'N/A'}/10.00`);
      console.log(`   - Violations: ${result.violations.length}`);
      
      if (result.violations.length > 0) {
        console.log('\n📋 Violations found:');
        const violationsBySeverity = result.violations.reduce((acc, v) => {
          acc[v.severity] = (acc[v.severity] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        Object.entries(violationsBySeverity).forEach(([severity, count]) => {
          console.log(`   - ${severity}: ${count}`);
        });
        
        console.log('\n🔍 First 5 violations:');
        result.violations.slice(0, 5).forEach((v, i) => {
          console.log(`   ${i + 1}. [${v.severity}] ${v.rule} at line ${v.lineNumber}: ${v.message}`);
        });
      }
      
      await engine.completeSession(result.session.id, 'completed');
    }

    // Keep the process running
    process.stdin.resume();

  } catch (error) {
    console.error('❌ Failed to start Quality Service:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      code: (error as any).code
    });
    
    // Clean up on error
    await cleanup();
    process.exit(1);
  }
}

// Graceful shutdown handler
async function cleanup(): Promise<void> {
  console.log('\n🧹 Cleaning up Quality Service...');
  
  try {
    // Stop GraphQL server
    if (graphqlServer) {
      console.log('   - Stopping GraphQL server...');
      await graphqlServer.stop();
    }
    
    // Stop MCP server
    if (mcpServer) {
      console.log('   - Stopping MCP server...');
      await mcpServer.stop();
    }
    
    // Disconnect from database
    if (engine) {
      console.log('   - Disconnecting from database...');
      await engine.disconnect();
    }
    
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('⚠️  Error during cleanup:', error);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT signal');
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM signal');
  await cleanup();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  console.error('💥 Uncaught exception:', error);
  await cleanup();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
  await cleanup();
  process.exit(1);
});

// Export for use as a library
export { TimescaleQualityEngine } from './core/quality-engine.js';
export { QualityMCPServer } from './mcp/server.js';
export * from './types/index.js';

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(async (error) => {
    console.error('💥 Fatal error in main:', error);
    await cleanup();
    process.exit(1);
  });
}