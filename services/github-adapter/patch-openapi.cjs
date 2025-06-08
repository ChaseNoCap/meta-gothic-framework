#!/usr/bin/env node
const fs = require('fs');

// Read the OpenAPI spec
const spec = JSON.parse(fs.readFileSync('github-openapi.json', 'utf8'));

// Function to fix make_latest recursively
function fixMakeLatest(obj) {
  if (typeof obj !== 'object' || obj === null) return;
  
  for (const key in obj) {
    if (key === 'make_latest' && obj[key].enum && 
        (obj[key].enum.includes('true') || obj[key].enum.includes('false'))) {
      console.log(`Fixing make_latest enum at ${key}`);
      // Convert to string type with enum of string values
      obj[key] = {
        ...obj[key],
        type: 'string',
        enum: ['true', 'false', 'legacy']
      };
    } else {
      fixMakeLatest(obj[key]);
    }
  }
}

// Fix the problematic enums
fixMakeLatest(spec);

// Write the patched spec
fs.writeFileSync('github-openapi-patched.json', JSON.stringify(spec, null, 2));
console.log('Patched OpenAPI spec written to github-openapi-patched.json');