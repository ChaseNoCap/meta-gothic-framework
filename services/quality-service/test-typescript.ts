import { TimescaleQualityEngine } from './src/core/quality-engine';
import type { QualityConfig } from './src/types/index';

const config: QualityConfig = {
  database: {
    connectionString: 'postgresql://josh@localhost:5432/quality_service',
    poolSize: 10,
    statementTimeout: 30000,
    queryTimeout: 30000
  },
  analysis: {
    excludePatterns: ['node_modules/**', 'dist/**'],
    tsconfigPath: './tsconfig.json'
  },
  scoring: {
    errorWeight: 3,
    warningWeight: 1,
    infoWeight: 0.1,
    maxScore: 10
  }
};

async function testTypeScript(): Promise<void> {
  console.log('🧪 Testing TypeScript analyzer...\n');
  
  const engine = new TimescaleQualityEngine(config);
  
  try {
    await engine.connect();
    console.log('✅ Connected to database\n');
    
    // Test the TypeScript file
    const testFile = './test-files/sample.ts';
    console.log(`📝 Analyzing ${testFile}...`);
    
    const result = await engine.processFile(testFile, {
      sessionType: 'HEADLESS',
      triggeredBy: 'typescript-test'
    });
    
    console.log(`\n📈 Analysis Results:
   - Session ID: ${result.session.id}
   - Quality Score: ${result.metrics?.qualityScore?.toFixed(2) || 'N/A'}/10.00
   - Total Violations: ${result.violations.length}
   `);
    
    // Show violations by tool
    const violationsByTool = result.violations.reduce((acc, v) => {
      acc[v.toolType] = (acc[v.toolType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('📋 Violations by tool:');
    Object.entries(violationsByTool).forEach(([tool, count]) => {
      console.log(`   - ${tool}: ${count}`);
    });
    
    // Show TypeScript violations
    const tsViolations = result.violations.filter(v => v.toolType === 'typescript');
    
    if (tsViolations.length > 0) {
      console.log('\n🔷 TypeScript violations:');
      tsViolations.forEach((v, i) => {
        console.log(`   ${i + 1}. [${v.severity}] ${v.rule}: ${v.message} (line ${v.lineNumber})`);
      });
    }
    
    // Show some ESLint violations for comparison
    const eslintViolations = result.violations.filter(v => v.toolType === 'eslint');
    if (eslintViolations.length > 0) {
      console.log('\n🔍 First 5 ESLint violations:');
      eslintViolations.slice(0, 5).forEach((v, i) => {
        console.log(`   ${i + 1}. [${v.severity}] ${v.rule}: ${v.message} (line ${v.lineNumber})`);
      });
    }
    
    await engine.completeSession(result.session.id, 'completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await engine.disconnect();
    console.log('\n✅ Test completed');
  }
}

testTypeScript().catch(console.error);