import { TimescaleQualityEngine } from './core/quality-engine';
import type { QualityConfig } from './types/index';

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

async function main(): Promise<void> {
  console.log('🚀 Starting Quality Service...');
  
  try {
    // Initialize the quality engine
    const engine = new TimescaleQualityEngine(defaultConfig);
    await engine.connect();
    console.log('✅ Connected to TimescaleDB');

    // TODO: Start MCP Server
    // const mcpServer = new InteractiveQualityMCPServer(defaultConfig);
    // await mcpServer.start();
    // console.log(`✅ MCP Server started on port ${defaultConfig.mcp?.port}`);

    // TODO: Start Web Portal
    // const webPortal = await setupWebPortal(defaultConfig);
    // await webPortal.listen({ port: 3007, host: '0.0.0.0' });
    // console.log('✅ Web Portal started on http://localhost:3007');

    // For now, just demonstrate basic functionality
    console.log('\n📊 Quality Service is ready!');
    console.log('   - Database: Connected');
    console.log('   - MCP Server: Coming soon (port 3006)');
    console.log('   - Web Portal: Coming soon (port 3007)');
    
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

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down...');
      await engine.disconnect();
      // TODO: Close MCP server and web portal
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start Quality Service:', error);
    process.exit(1);
  }
}

// Export for use as a library
export { TimescaleQualityEngine } from './core/quality-engine';
export * from './types/index';

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}