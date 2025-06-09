import { TimescaleQualityEngine } from './src/core/quality-engine';
import { QualityFileWatcher } from './src/services/file-watcher';
import type { QualityConfig } from './src/types/index';
import { writeFile } from 'fs/promises';
import path from 'path';

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

async function testFileWatcher(): Promise<void> {
  console.log('🧪 Testing File Watcher...\n');
  
  const engine = new TimescaleQualityEngine(config);
  
  try {
    await engine.connect();
    console.log('✅ Connected to database\n');
    
    // Create file watcher
    const watcher = new QualityFileWatcher(engine, {
      paths: ['./test-files'],
      excludePatterns: ['**/*.log', '**/.DS_Store'],
      debounceDelay: 500,
      fileExtensions: ['.js', '.ts', '.jsx', '.tsx']
    });
    
    // Set up event listeners
    watcher.on('ready', (stats) => {
      console.log('📡 Watcher ready:', stats);
    });
    
    watcher.on('file:add', (event) => {
      console.log(`➕ File added: ${event.filePath}`);
    });
    
    watcher.on('file:change', (event) => {
      console.log(`📝 File changed: ${event.filePath}`);
    });
    
    watcher.on('file:delete', (event) => {
      console.log(`🗑️ File deleted: ${event.filePath}`);
    });
    
    watcher.on('file:processed', (result) => {
      console.log(`✅ Processed ${result.filePath}:
   - Event: ${result.eventType}
   - Quality Score: ${result.qualityScore?.toFixed(2) || 'N/A'}/10.00
   - Violations: ${result.violationCount}
   - Session: ${result.sessionId}`);
    });
    
    watcher.on('error', (error) => {
      console.error('❌ Watcher error:', error);
    });
    
    // Start watching
    await watcher.start();
    
    // Wait a bit for initial scan
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n📊 Current stats:', watcher.getStats());
    
    // Test file changes
    console.log('\n🔄 Testing file changes...');
    
    // Modify an existing file
    const testFile = path.join('./test-files', 'watch-test.js');
    await writeFile(testFile, `
// Test file for watcher
const message = "Initial version";
console.log(message);

function testFunction() {
  return message;
}

export { testFunction };
`);
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Make a change
    console.log('\n📝 Making a change...');
    await writeFile(testFile, `
// Test file for watcher - updated
const message = 'Updated version';
console.log(message);

function testFunction() {
  // Added comment
  return message.toUpperCase();
}

const unusedVar = 42; // This will trigger a warning

export { testFunction };
`);
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Create a new file
    console.log('\n➕ Creating a new file...');
    const newFile = path.join('./test-files', 'new-test.ts');
    await writeFile(newFile, `
interface TestInterface {
  name: string;
  value: number;
}

const testData: TestInterface = {
  name: "Test",
  value: "not a number" // Type error
};

export { testData };
`);
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log('\n📊 Final stats:', watcher.getStats());
    
    // Stop watching
    console.log('\n🛑 Stopping watcher...');
    await watcher.stop();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await engine.disconnect();
    console.log('\n✅ Test completed');
  }
}

testFileWatcher().catch(console.error);