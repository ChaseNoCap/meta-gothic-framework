#!/usr/bin/env node

const { execSync } = require('child_process');

const ports = [3000, 3001, 3002, 3004];

console.log('🔍 Checking ports...\n');

let anyInUse = false;

ports.forEach(port => {
  try {
    const output = execSync(`lsof -ti:${port}`, { encoding: 'utf8' }).trim();
    if (output) {
      console.log(`❌ Port ${port} is in use by PID: ${output}`);
      anyInUse = true;
    } else {
      console.log(`✅ Port ${port} is free`);
    }
  } catch (e) {
    console.log(`✅ Port ${port} is free`);
  }
});

if (anyInUse) {
  console.log('\n⚠️  Some ports are in use. Run "npm run stop" to clear them.');
} else {
  console.log('\n✅ All ports are clear!');
}