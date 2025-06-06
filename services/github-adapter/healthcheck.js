#!/usr/bin/env node
/**
 * Health check for GitHub Mesh service
 * Used by PM2 to verify service is ready
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3005,
  path: '/graphql?query={__schema{queryType{name}}}',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    console.log('✅ GitHub Mesh service is healthy');
    process.exit(0);
  } else {
    console.error(`❌ GitHub Mesh service returned status ${res.statusCode}`);
    process.exit(1);
  }
});

req.on('error', (err) => {
  console.error(`❌ GitHub Mesh service is not responding: ${err.message}`);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('❌ GitHub Mesh service health check timed out');
  req.destroy();
  process.exit(1);
});

req.end();