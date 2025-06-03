#!/usr/bin/env node

/**
 * GraphQL Performance Benchmarking Script
 * 
 * Usage:
 *   node benchmark-graphql.js <service-url> <query-type>
 * 
 * Examples:
 *   node benchmark-graphql.js http://localhost:3004/graphql simple
 *   node benchmark-graphql.js http://localhost:3000/graphql federated
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';

const queries = {
  simple: {
    name: 'Simple Query',
    query: `
      query SimpleGitStatus {
        gitStatus(path: ".") {
          branch
          isDirty
          ahead
          behind
        }
      }
    `
  },
  
  complex: {
    name: 'Complex Query',
    query: `
      query ComplexScan {
        scanAllRepositories {
          name
          path
          isDirty
          branch
          uncommittedCount
          type
        }
      }
    `
  },
  
  detailed: {
    name: 'Detailed Query',
    query: `
      query DetailedScan {
        scanAllDetailed {
          repositories {
            name
            path
            status {
              branch
              isDirty
              files {
                path
                status
                isStaged
              }
              ahead
              behind
              hasRemote
            }
          }
          statistics {
            totalRepositories
            dirtyRepositories
            totalUncommittedFiles
            totalAdditions
            totalDeletions
          }
          metadata {
            duration
            workspaceRoot
          }
        }
      }
    `
  }
};

async function makeRequest(url, query) {
  const start = process.hrtime.bigint();
  
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query });
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const req = protocol.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
        
        try {
          const response = JSON.parse(body);
          if (response.errors) {
            reject(new Error(`GraphQL Errors: ${JSON.stringify(response.errors)}`));
          } else {
            resolve({ duration, response });
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function warmup(url, query, count = 10) {
  console.log(`Warming up with ${count} requests...`);
  
  for (let i = 0; i < count; i++) {
    try {
      await makeRequest(url, query);
    } catch (e) {
      console.error(`Warmup request ${i + 1} failed:`, e.message);
    }
  }
}

async function benchmark(url, queryType, iterations = 100) {
  const queryConfig = queries[queryType];
  
  if (!queryConfig) {
    console.error(`Unknown query type: ${queryType}`);
    console.error(`Available types: ${Object.keys(queries).join(', ')}`);
    process.exit(1);
  }
  
  console.log(`\nBenchmarking ${queryConfig.name} against ${url}`);
  console.log(`Running ${iterations} iterations...\n`);
  
  // Warmup
  await warmup(url, queryConfig.query);
  
  // Benchmark
  const results = [];
  let errors = 0;
  
  const progressInterval = Math.max(1, Math.floor(iterations / 20));
  
  for (let i = 0; i < iterations; i++) {
    try {
      const { duration } = await makeRequest(url, queryConfig.query);
      results.push(duration);
      
      if ((i + 1) % progressInterval === 0) {
        process.stdout.write('.');
      }
    } catch (e) {
      errors++;
      process.stdout.write('x');
    }
    
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  console.log('\n');
  
  // Calculate statistics
  if (results.length === 0) {
    console.error('All requests failed!');
    process.exit(1);
  }
  
  results.sort((a, b) => a - b);
  
  const min = results[0];
  const max = results[results.length - 1];
  const median = results[Math.floor(results.length / 2)];
  const avg = results.reduce((sum, val) => sum + val, 0) / results.length;
  const p95 = results[Math.floor(results.length * 0.95)];
  const p99 = results[Math.floor(results.length * 0.99)];
  
  console.log('Results:');
  console.log('--------');
  console.log(`Successful requests: ${results.length}/${iterations}`);
  console.log(`Failed requests: ${errors}`);
  console.log(`\nLatency (ms):`);
  console.log(`  Min:    ${min.toFixed(2)}`);
  console.log(`  Median: ${median.toFixed(2)}`);
  console.log(`  Avg:    ${avg.toFixed(2)}`);
  console.log(`  p95:    ${p95.toFixed(2)}`);
  console.log(`  p99:    ${p99.toFixed(2)}`);
  console.log(`  Max:    ${max.toFixed(2)}`);
  
  // Performance assessment
  console.log('\nPerformance Assessment:');
  if (queryType === 'simple' && p99 < 50) {
    console.log('✅ Simple query performance: EXCELLENT');
  } else if (queryType === 'simple' && p99 < 100) {
    console.log('⚠️  Simple query performance: ACCEPTABLE');
  } else if (queryType === 'simple') {
    console.log('❌ Simple query performance: NEEDS IMPROVEMENT');
  }
  
  if (queryType === 'complex' && p99 < 200) {
    console.log('✅ Complex query performance: EXCELLENT');
  } else if (queryType === 'complex' && p99 < 500) {
    console.log('⚠️  Complex query performance: ACCEPTABLE');
  } else if (queryType === 'complex') {
    console.log('❌ Complex query performance: NEEDS IMPROVEMENT');
  }
  
  if (queryType === 'detailed' && p99 < 500) {
    console.log('✅ Detailed query performance: EXCELLENT');
  } else if (queryType === 'detailed' && p99 < 1000) {
    console.log('⚠️  Detailed query performance: ACCEPTABLE');
  } else if (queryType === 'detailed') {
    console.log('❌ Detailed query performance: NEEDS IMPROVEMENT');
  }
}

// Main
const [,, url, queryType] = process.argv;

if (!url || !queryType) {
  console.log('Usage: node benchmark-graphql.js <service-url> <query-type>');
  console.log('\nExample:');
  console.log('  node benchmark-graphql.js http://localhost:3004/graphql simple');
  console.log('\nAvailable query types:');
  Object.entries(queries).forEach(([key, config]) => {
    console.log(`  ${key} - ${config.name}`);
  });
  process.exit(1);
}

benchmark(url, queryType).catch(console.error);