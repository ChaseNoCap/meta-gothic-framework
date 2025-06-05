#!/usr/bin/env node

// Test script to verify file watching behavior
const fs = require('fs');
const path = require('path');

const testFile = path.join(__dirname, '../services/shared/test-watch.ts');

console.log('📝 Creating test file to trigger file watch...');
console.log(`  File: ${testFile}`);

// Create a test file
fs.writeFileSync(testFile, `// Test file created at ${new Date().toISOString()}\nexport const test = true;\n`);

console.log('✅ Test file created');
console.log('⏰ Waiting 3 seconds before modifying...');

setTimeout(() => {
  console.log('📝 Modifying test file...');
  fs.appendFileSync(testFile, `// Modified at ${new Date().toISOString()}\n`);
  console.log('✅ Test file modified');
  
  console.log('⏰ Waiting 3 seconds before deleting...');
  
  setTimeout(() => {
    console.log('🗑️  Deleting test file...');
    fs.unlinkSync(testFile);
    console.log('✅ Test file deleted');
    console.log('\n✨ Test complete! Check service logs for restart events.');
  }, 3000);
}, 3000);