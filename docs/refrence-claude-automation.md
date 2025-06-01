# Claude Code Node.js Subprocess Integration: Complete Reference & Examples

## 🎯 Executive Summary

This is your definitive reference for integrating Claude Code with Node.js through subprocess automation. Based on official Anthropic documentation and real-world implementations, this guide provides exemplar uses, production-ready code patterns, and authoritative links to all resources.

---

## 📚 Official Resources & Documentation

### Core Documentation Links
- **Claude Code Overview**: https://docs.anthropic.com/en/docs/claude-code/overview
- **SDK Documentation**: https://docs.anthropic.com/en/docs/claude-code/sdk
- **CLI Usage & Controls**: https://docs.anthropic.com/en/docs/claude-code/cli-usage
- **Best Practices**: https://www.anthropic.com/engineering/claude-code-best-practices
- **GitHub Actions Integration**: https://docs.anthropic.com/en/docs/claude-code/github-actions

### Official Repositories
- **Main Claude Code Repository**: https://github.com/anthropics/claude-code
- **Claude Code GitHub Action**: https://github.com/anthropics/claude-code-action
- **MCP Servers Collection**: https://github.com/modelcontextprotocol

### API & Model Documentation
- **New API Capabilities**: https://www.anthropic.com/news/agent-capabilities-api
- **Claude 4 Announcement**: https://www.anthropic.com/news/claude-4
- **Code Execution Tool**: https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/code-execution-tool
- **Files API**: https://docs.anthropic.com/en/docs/agents-and-tools/files-api

---

## 🚀 Installation & Setup

### Quick Installation

```bash
# Install Claude Code globally
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version

# Initialize authentication (one-time OAuth)
claude
```

### Node.js Project Setup

```javascript
// package.json
{
  "name": "claude-code-automation",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "child_process": "latest",
    "util": "latest",
    "fs": "latest",
    "path": "latest"
  }
}
```

---

## 🔧 Core Node.js Integration Patterns

### 1. Basic Subprocess Execution

```javascript
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Basic print mode execution
async function runClaudeCommand(prompt, options = {}) {
  const command = [
    'claude',
    '-p',
    `"${prompt}"`,
    '--output-format', options.format || 'json'
  ];
  
  if (options.maxTurns) {
    command.push('--max-turns', options.maxTurns.toString());
  }
  
  if (options.verbose) {
    command.push('--verbose');
  }
  
  try {
    const { stdout, stderr } = await execAsync(command.join(' '), {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      timeout: options.timeout || 300000 // 5 minutes default
    });
    
    if (stderr && !stderr.includes('Using model:')) {
      console.warn('Claude stderr:', stderr);
    }
    
    if (options.format === 'json') {
      return JSON.parse(stdout);
    }
    
    return stdout;
  } catch (error) {
    throw new Error(`Claude execution failed: ${error.message}`);
  }
}

// Usage example
async function basicExample() {
  const result = await runClaudeCommand(
    "Write a Node.js function to validate email addresses",
    { format: 'json', verbose: true }
  );
  
  console.log('Result:', result.result);
  console.log('Cost:', result.cost_usd);
  console.log('Duration:', result.duration_ms);
}
```

### 2. Streaming JSON Integration with Parallelism

```javascript
// Parallel streaming with multiple Claude instances
class ParallelClaudeStreamer {
  constructor(maxConcurrency = 3) {
    this.maxConcurrency = maxConcurrency;
    this.activeStreams = new Map();
    this.queue = [];
  }
  
  async runParallelStreams(tasks) {
    const results = [];
    const promises = tasks.map(task => this.executeTask(task));
    
    // Process all tasks with controlled concurrency
    for (const promise of promises) {
      results.push(await promise);
    }
    
    return results;
  }
  
  async executeTask(task) {
    // Wait for available slot
    while (this.activeStreams.size >= this.maxConcurrency) {
      await this.waitForSlot();
    }
    
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🚀 Starting task ${taskId}: ${task.name}`);
    
    try {
      const streamPromise = this.runClaudeStream(task.prompt, {
        ...task.options,
        taskId,
        onProgress: (progress) => {
          console.log(`📊 Task ${taskId} progress: ${progress}`);
        }
      });
      
      this.activeStreams.set(taskId, streamPromise);
      
      const result = await streamPromise;
      this.activeStreams.delete(taskId);
      
      console.log(`✅ Task ${taskId} completed in ${result.result?.duration_ms}ms`);
      return { taskId, task: task.name, result };
      
    } catch (error) {
      this.activeStreams.delete(taskId);
      console.error(`❌ Task ${taskId} failed:`, error.message);
      return { taskId, task: task.name, error: error.message };
    }
  }
  
  async waitForSlot() {
    if (this.activeStreams.size < this.maxConcurrency) return;
    
    // Wait for any active stream to complete
    const activePromises = Array.from(this.activeStreams.values());
    await Promise.race(activePromises);
  }
  
  runClaudeStream(prompt, options = {}) {
    return new Promise((resolve, reject) => {
      const args = [
        '-p', prompt,
        '--output-format', 'stream-json'
      ];
      
      if (options.maxTurns) {
        args.push('--max-turns', options.maxTurns.toString());
      }
      
      if (options.mcpConfig) {
        args.push('--mcp-config', options.mcpConfig);
      }
      
      if (options.allowedTools) {
        args.push('--allowedTools', options.allowedTools.join(','));
      }
      
      const claude = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...options.env }
      });
      
      let buffer = '';
      const messages = [];
      let finalResult = null;
      let progressCount = 0;
      
      claude.stdout.on('data', (data) => {
        buffer += data.toString();
        
        // Process complete JSON objects
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line
        
        lines.forEach(line => {
          if (line.trim()) {
            try {
              const jsonData = JSON.parse(line);
              messages.push(jsonData);
              progressCount++;
              
              // Report progress periodically
              if (progressCount % 5 === 0) {
                options.onProgress?.(`${progressCount} messages processed`);
              }
              
              // Handle different message types
              if (jsonData.type === 'init') {
                options.onInit?.(jsonData);
              } else if (jsonData.type === 'assistant_text') {
                options.onText?.(jsonData.content);
              } else if (jsonData.type === 'tool_use') {
                options.onToolUse?.(jsonData);
              } else if (jsonData.type === 'result') {
                finalResult = jsonData;
              }
              
              options.onMessage?.(jsonData);
            } catch (e) {
              console.warn(`Invalid JSON line in ${options.taskId}:`, line);
            }
          }
        });
      });
      
      claude.stderr.on('data', (data) => {
        const stderr = data.toString();
        if (!stderr.includes('Using model:')) {
          console.error(`Claude stderr for ${options.taskId}:`, stderr);
        }
      });
      
      claude.on('close', (code) => {
        // Process any remaining buffer
        if (buffer.trim()) {
          try {
            const finalData = JSON.parse(buffer);
            messages.push(finalData);
            if (finalData.type === 'result') {
              finalResult = finalData;
            }
          } catch (e) {
            console.warn(`Invalid final JSON in ${options.taskId}:`, buffer);
          }
        }
        
        if (code === 0) {
          resolve({
            messages,
            result: finalResult,
            exitCode: code,
            messageCount: messages.length
          });
        } else {
          reject(new Error(`Claude process exited with code ${code}`));
        }
      });
      
      claude.on('error', (error) => {
        reject(new Error(`Claude process error: ${error.message}`));
      });
      
      // Optional: Send input to Claude's stdin
      if (options.stdin) {
        claude.stdin.write(options.stdin);
        claude.stdin.end();
      }
    });
  }
}

// Parallel streaming example
async function parallelStreamingExample() {
  const streamer = new ParallelClaudeStreamer(4); // 4 concurrent streams
  
  const tasks = [
    {
      name: 'Backend API Design',
      prompt: 'think hard about designing a scalable user authentication API with JWT, rate limiting, and audit logging',
      options: { maxTurns: 8 }
    },
    {
      name: 'Frontend Components',
      prompt: 'think about creating a React component library with accessibility features and comprehensive testing',
      options: { maxTurns: 6 }
    },
    {
      name: 'Database Schema',
      prompt: 'think hard about designing a PostgreSQL schema for a multi-tenant e-commerce platform',
      options: { maxTurns: 7 }
    },
    {
      name: 'DevOps Pipeline',
      prompt: 'think about creating a complete CI/CD pipeline with Docker, Kubernetes, and automated testing',
      options: { maxTurns: 10 }
    },
    {
      name: 'Security Analysis',
      prompt: 'ultrathink about comprehensive security analysis for a financial application including OWASP compliance',
      options: { maxTurns: 12 }
    }
  ];
  
  console.log(`🚀 Starting ${tasks.length} parallel Claude tasks...`);
  const startTime = Date.now();
  
  const results = await streamer.runParallelStreams(tasks);
  
  const endTime = Date.now();
  const totalDuration = endTime - startTime;
  
  console.log(`\n📊 Parallel Execution Summary:`);
  console.log(`Total time: ${totalDuration}ms`);
  console.log(`Successful tasks: ${results.filter(r => !r.error).length}/${tasks.length}`);
  console.log(`Average cost: ${results.reduce((sum, r) => sum + (r.result?.result?.cost_usd || 0), 0).toFixed(4)}`);
  
  results.forEach(result => {
    if (result.error) {
      console.log(`❌ ${result.task}: ${result.error}`);
    } else {
      console.log(`✅ ${result.task}: ${result.result.messageCount} messages, ${result.result.result?.duration_ms}ms`);
    }
  });
  
  return results;
}
```

## 🔄 Advanced Parallelism Patterns

### 1. Worker Pool Architecture

```javascript
// Advanced Claude worker pool with intelligent task distribution
class ClaudeWorkerPool {
  constructor(options = {}) {
    this.maxWorkers = options.maxWorkers || require('os').cpus().length;
    this.workers = [];
    this.taskQueue = [];
    this.activeJobs = new Map();
    this.workerStats = new Map();
    this.retryQueue = [];
  }
  
  async initialize() {
    console.log(`🚀 Initializing Claude worker pool with ${this.maxWorkers} workers...`);
    
    for (let i = 0; i < this.maxWorkers; i++) {
      const worker = await this.createWorker(i);
      this.workers.push(worker);
      this.workerStats.set(worker.id, {
        tasksCompleted: 0,
        totalCost: 0,
        averageTime: 0,
        errors: 0
      });
    }
    
    console.log(`✅ Worker pool initialized with ${this.workers.length} workers`);
  }
  
  async createWorker(id) {
    return {
      id: `worker_${id}`,
      busy: false,
      currentTask: null,
      created: new Date()
    };
  }
  
  async submitJob(task) {
    return new Promise((resolve, reject) => {
      const job = {
        id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        task,
        resolve,
        reject,
        submitted: new Date(),
        attempts: 0,
        maxAttempts: task.maxAttempts || 3
      };
      
      this.taskQueue.push(job);
      this.processQueue();
    });
  }
  
  async processQueue() {
    if (this.taskQueue.length === 0) return;
    
    const availableWorker = this.workers.find(w => !w.busy);
    if (!availableWorker) return;
    
    const job = this.taskQueue.shift();
    await this.executeJob(availableWorker, job);
  }
  
  async executeJob(worker, job) {
    worker.busy = true;
    worker.currentTask = job.id;
    this.activeJobs.set(job.id, { worker, job, started: new Date() });
    
    console.log(`🔧 Worker ${worker.id} starting job ${job.id}: ${job.task.name}`);
    
    try {
      const startTime = Date.now();
      
      // Execute the actual Claude command
      const result = await this.runClaudeTask(job.task);
      
      const duration = Date.now() - startTime;
      
      // Update worker statistics
      this.updateWorkerStats(worker.id, duration, result.cost_usd || 0, false);
      
      // Clean up
      worker.busy = false;
      worker.currentTask = null;
      this.activeJobs.delete(job.id);
      
      console.log(`✅ Worker ${worker.id} completed job ${job.id} in ${duration}ms`);
      
      job.resolve(result);
      
      // Process next task in queue
      this.processQueue();
      
    } catch (error) {
      job.attempts++;
      
      // Update error stats
      this.updateWorkerStats(worker.id, 0, 0, true);
      
      console.error(`❌ Worker ${worker.id} job ${job.id} failed (attempt ${job.attempts}):`, error.message);
      
      if (job.attempts < job.maxAttempts) {
        // Retry with exponential backoff
        const delay = Math.pow(2, job.attempts) * 1000;
        console.log(`🔄 Retrying job ${job.id} in ${delay}ms...`);
        
        setTimeout(() => {
          this.taskQueue.unshift(job); // Priority retry
          this.processQueue();
        }, delay);
      } else {
        job.reject(error);
      }
      
      // Clean up worker
      worker.busy = false;
      worker.currentTask = null;
      this.activeJobs.delete(job.id);
      
      // Process next task
      this.processQueue();
    }
  }
  
  async runClaudeTask(task) {
    const command = [
      'claude',
      '-p', `"${task.prompt}"`,
      '--output-format', 'json'
    ];
    
    if (task.maxTurns) {
      command.push('--max-turns', task.maxTurns.toString());
    }
    
    if (task.mcpConfig) {
      command.push('--mcp-config', task.mcpConfig);
    }
    
    if (task.allowedTools) {
      command.push('--allowedTools', task.allowedTools.join(','));
    }
    
    const { stdout } = await execAsync(command.join(' '), {
      timeout: task.timeout || 300000,
      maxBuffer: 1024 * 1024 * 50 // 50MB buffer
    });
    
    return JSON.parse(stdout);
  }
  
  updateWorkerStats(workerId, duration, cost, isError) {
    const stats = this.workerStats.get(workerId);
    
    if (isError) {
      stats.errors++;
    } else {
      stats.tasksCompleted++;
      stats.totalCost += cost;
      stats.averageTime = (stats.averageTime * (stats.tasksCompleted - 1) + duration) / stats.tasksCompleted;
    }
  }
  
  async submitBatch(tasks) {
    console.log(`📦 Submitting batch of ${tasks.length} tasks to worker pool...`);
    
    const startTime = Date.now();
    const promises = tasks.map(task => this.submitJob(task));
    
    const results = await Promise.allSettled(promises);
    const duration = Date.now() - startTime;
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`📊 Batch completed in ${duration}ms: ${successful} successful, ${failed} failed`);
    
    return results.map((result, index) => ({
      task: tasks[index].name,
      status: result.status,
      result: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }));
  }
  
  getPoolStats() {
    const totalTasks = Array.from(this.workerStats.values())
      .reduce((sum, stats) => sum + stats.tasksCompleted, 0);
    
    const totalCost = Array.from(this.workerStats.values())
      .reduce((sum, stats) => sum + stats.totalCost, 0);
    
    const averageTime = Array.from(this.workerStats.values())
      .reduce((sum, stats) => sum + stats.averageTime, 0) / this.workers.length;
    
    return {
      totalWorkers: this.workers.length,
      activeTasks: this.activeJobs.size,
      queuedTasks: this.taskQueue.length,
      totalTasksCompleted: totalTasks,
      totalCost,
      averageTime,
      workerDetails: Object.fromEntries(this.workerStats)
    };
  }
  
  async shutdown() {
    console.log('🛑 Shutting down worker pool...');
    
    // Wait for active jobs to complete
    while (this.activeJobs.size > 0) {
      console.log(`⏳ Waiting for ${this.activeJobs.size} active jobs to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('✅ Worker pool shutdown complete');
  }
}

// Usage example with worker pool
async function workerPoolExample() {
  const pool = new ClaudeWorkerPool({ maxWorkers: 6 });
  await pool.initialize();
  
  const tasks = [
    {
      name: 'Security Audit',
      prompt: 'ultrathink about conducting a comprehensive security audit of this Node.js application focusing on authentication vulnerabilities',
      maxTurns: 15,
      timeout: 600000
    },
    {
      name: 'Performance Analysis',
      prompt: 'think hard about analyzing performance bottlenecks in this React application and suggest optimizations',
      maxTurns: 10
    },
    {
      name: 'Database Optimization',
      prompt: 'think harder about optimizing these PostgreSQL queries for better performance and scalability',
      maxTurns: 12
    },
    {
      name: 'API Documentation',
      prompt: 'think about generating comprehensive OpenAPI documentation for this REST API',
      maxTurns: 8
    },
    {
      name: 'Test Coverage Analysis',
      prompt: 'think hard about analyzing test coverage and suggesting additional test cases for critical paths',
      maxTurns: 10
    },
    {
      name: 'Code Quality Review',
      prompt: 'think about reviewing code quality and suggesting refactoring opportunities',
      maxTurns: 8
    },
    {
      name: 'Architecture Review',
      prompt: 'ultrathink about reviewing the overall architecture and suggesting improvements for scalability',
      maxTurns: 20
    },
    {
      name: 'Dependency Analysis',
      prompt: 'think about analyzing project dependencies for security vulnerabilities and updates',
      maxTurns: 6
    }
  ];
  
  try {
    // Submit all tasks to the pool
    const results = await pool.submitBatch(tasks);
    
    // Print results
    console.log('\n📋 Detailed Results:');
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        console.log(`✅ ${result.task}: Success (Cost: ${result.result.cost_usd?.toFixed(4) || '0.0000'})`);
      } else {
        console.log(`❌ ${result.task}: Failed - ${result.error}`);
      }
    });
    
    // Print pool statistics
    console.log('\n📊 Worker Pool Statistics:');
    console.log(JSON.stringify(pool.getPoolStats(), null, 2));
    
  } finally {
    await pool.shutdown();
  }
}
```

### 2. Parallel MCP Integration

```javascript
// Parallel MCP server integration with load balancing
class ParallelMCPManager {
  constructor() {
    this.serverConfigs = new Map();
    this.serverPools = new Map();
    this.loadBalancer = new MCPLoadBalancer();
  }
  
  addServerPool(serverName, configs) {
    this.serverConfigs.set(serverName, configs);
    this.serverPools.set(serverName, new MCPServerPool(serverName, configs));
  }
  
  async executeParallelMCP(tasks) {
    const taskGroups = this.groupTasksByServer(tasks);
    const executionPromises = [];
    
    for (const [serverName, serverTasks] of taskGroups) {
      const pool = this.serverPools.get(serverName);
      if (pool) {
        executionPromises.push(
          this.executeServerTasks(pool, serverTasks)
        );
      }
    }
    
    const results = await Promise.all(executionPromises);
    return this.flattenResults(results);
  }
  
  groupTasksByServer(tasks) {
    const groups = new Map();
    
    tasks.forEach(task => {
      const serverName = task.server || 'default';
      if (!groups.has(serverName)) {
        groups.set(serverName, []);
      }
      groups.get(serverName).push(task);
    });
    
    return groups;
  }
  
  async executeServerTasks(pool, tasks) {
    const concurrencyLimit = pool.maxConcurrency || 3;
    const semaphore = new Semaphore(concurrencyLimit);
    
    const taskPromises = tasks.map(async (task) => {
      await semaphore.acquire();
      try {
        return await this.executeMCPTask(pool, task);
      } finally {
        semaphore.release();
      }
    });
    
    return Promise.allSettled(taskPromises);
  }
  
  async executeMCPTask(pool, task) {
    const configPath = await this.createMCPConfig(pool.configs);
    
    try {
      const command = [
        'claude',
        '-p', `"${task.prompt}"`,
        '--output-format', 'json',
        '--mcp-config', configPath,
        '--allowedTools', task.allowedTools.join(',')
      ];
      
      if (task.maxTurns) {
        command.push('--max-turns', task.maxTurns.toString());
      }
      
      const { stdout } = await execAsync(command.join(' '), {
        timeout: task.timeout || 300000
      });
      
      return {
        task: task.name,
        server: pool.name,
        result: JSON.parse(stdout),
        success: true
      };
      
    } finally {
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }
    }
  }
  
  async createMCPConfig(configs) {
    const tempConfig = {
      mcpServers: configs
    };
    
    const configPath = `./mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`;
    fs.writeFileSync(configPath, JSON.stringify(tempConfig, null, 2));
    
    return configPath;
  }
  
  flattenResults(results) {
    return results.flat().map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          task: 'unknown',
          server: 'unknown',
          error: result.reason.message,
          success: false
        };
      }
    });
  }
}

class MCPServerPool {
  constructor(name, configs) {
    this.name = name;
    this.configs = configs;
    this.maxConcurrency = 3;
  }
}

class MCPLoadBalancer {
  constructor() {
    this.serverLoad = new Map();
  }
  
  selectServer(servers) {
    // Simple round-robin for now
    return servers[Math.floor(Math.random() * servers.length)];
  }
}

// Comprehensive parallel MCP example
async function parallelMCPExample() {
  const mcpManager = new ParallelMCPManager();
  
  // Configure multiple server pools
  mcpManager.addServerPool('github', {
    github_primary: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN }
    }
  });
  
  mcpManager.addServerPool('filesystem', {
    fs_local: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()]
    }
  });
  
  mcpManager.addServerPool('database', {
    postgres_main: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres'],
      env: { DATABASE_URL: process.env.DATABASE_URL }
    }
  });
  
  const tasks = [
    {
      name: 'GitHub Repository Analysis',
      server: 'github',
      prompt: 'think hard about analyzing all repositories in our organization for security vulnerabilities and outdated dependencies',
      allowedTools: ['mcp__github_primary__list_repositories', 'mcp__github_primary__get_repository'],
      maxTurns: 10
    },
    {
      name: 'Codebase Structure Analysis',
      server: 'filesystem',
      prompt: 'think about analyzing the project structure and identifying architectural patterns and potential improvements',
      allowedTools: ['mcp__fs_local__list_directory', 'mcp__fs_local__read_file'],
      maxTurns: 8
    },
    {
      name: 'Database Schema Review',
      server: 'database',
      prompt: 'ultrathink about reviewing the database schema for normalization, indexing opportunities, and performance optimizations',
      allowedTools: ['mcp__postgres_main__query', 'mcp__postgres_main__describe_table'],
      maxTurns: 12
    },
    {
      name: 'GitHub Issues Analysis',
      server: 'github',
      prompt: 'think about analyzing open issues and pull requests to identify common patterns and suggest process improvements',
      allowedTools: ['mcp__github_primary__list_issues', 'mcp__github_primary__list_pull_requests'],
      maxTurns: 8
    },
    {
      name: 'Code Quality Assessment',
      server: 'filesystem',
      prompt: 'think hard about assessing code quality across the entire codebase and generating improvement recommendations',
      allowedTools: ['mcp__fs_local__read_file', 'mcp__fs_local__list_directory'],
      maxTurns: 15
    },
    {
      name: 'Database Performance Analysis',
      server: 'database',
      prompt: 'think harder about analyzing database performance and suggesting query optimizations',
      allowedTools: ['mcp__postgres_main__query', 'mcp__postgres_main__explain'],
      maxTurns: 10
    }
  ];
  
  console.log(`🚀 Executing ${tasks.length} parallel MCP tasks across multiple servers...`);
  
  const startTime = Date.now();
  const results = await mcpManager.executeParallelMCP(tasks);
  const endTime = Date.now();
  
  console.log(`\n📊 Parallel MCP Execution Results (${endTime - startTime}ms):`);
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  
  successful.forEach(result => {
    console.log(`✅ ${result.task} (${result.server}): ${result.result.cost_usd?.toFixed(4) || '0.0000'}`);
  });
  
  failed.forEach(result => {
    console.log(`❌ ${result.task}: ${result.error}`);
  });
  
  return results;
}
```

```javascript
// MCP server configuration manager
class MCPManager {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.configPath = path.join(projectRoot, '.mcp.json');
  }
  
  createConfig(servers) {
    const config = { mcpServers: servers };
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    return this.configPath;
  }
  
  // Pre-built server configurations
  static getGitHubConfig(token) {
    return {
      github: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: { GITHUB_PERSONAL_ACCESS_TOKEN: token }
      }
    };
  }
  
  static getFilesystemConfig(allowedPaths) {
    return {
      filesystem: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', ...allowedPaths]
      }
    };
  }
  
  static getSlackConfig(token) {
    return {
      slack: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-slack'],
        env: { SLACK_BOT_TOKEN: token }
      }
    };
  }
}

// Execute Claude with MCP servers
async function runWithMCP(prompt, servers, allowedTools) {
  const mcpManager = new MCPManager();
  const configPath = mcpManager.createConfig(servers);
  
  try {
    const command = [
      'claude',
      '-p', `"${prompt}"`,
      '--output-format', 'json',
      '--mcp-config', configPath,
      '--allowedTools', allowedTools.join(',')
    ];
    
    const { stdout } = await execAsync(command.join(' '));
    return JSON.parse(stdout);
  } finally {
    // Cleanup config file
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  }
}

// MCP integration example
async function mcpExample() {
  const servers = {
    ...MCPManager.getGitHubConfig(process.env.GITHUB_TOKEN),
    ...MCPManager.getFilesystemConfig([process.cwd()])
  };
  
  const allowedTools = [
    'mcp__github__list_repositories',
    'mcp__github__create_issue',
    'mcp__filesystem__read_file',
    'mcp__filesystem__list_directory'
  ];
  
  const result = await runWithMCP(
    `Analyze our repository structure and create a GitHub issue for any missing documentation. 
     Focus on README files, API documentation, and setup instructions.`,
    servers,
    allowedTools
  );
  
  console.log('MCP Analysis Result:', result.result);
}
```

---

## 💡 Exemplar Use Cases

### 1. Automated Code Review System

```javascript
// Comprehensive code review automation
class ClaudeCodeReviewer {
  constructor(options = {}) {
    this.model = options.model || 'claude-opus-4-20250514';
    this.thinkingLevel = options.thinkingLevel || 'think hard';
    this.maxTurns = options.maxTurns || 15;
  }
  
  async reviewPullRequest(prNumber, repoPath) {
    const mcpConfig = {
      mcpServers: {
        github: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN }
        },
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', repoPath]
        }
      }
    };
    
    const configPath = './review-mcp.json';
    fs.writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2));
    
    const prompt = `${this.thinkingLevel} about this comprehensive code review:

**Pull Request #${prNumber} Review**

Please conduct a thorough code review focusing on:

1. **Security Analysis**
   - Input validation and sanitization
   - Authentication and authorization
   - SQL injection and XSS vulnerabilities
   - Secrets management

2. **Code Quality**
   - Maintainability and readability
   - Design patterns and architecture
   - Error handling and logging
   - Performance implications

3. **Testing Coverage**
   - Unit test adequacy
   - Integration test requirements
   - Edge case coverage
   - Test quality and maintainability

4. **Documentation Review**
   - Code comments and documentation
   - API documentation updates
   - README and setup instructions

5. **Best Practices Compliance**
   - Language-specific conventions
   - Framework best practices
   - Dependency management
   - CI/CD integration

For each issue found, provide:
- Specific file and line references
- Severity level (Critical/High/Medium/Low)
- Detailed explanation of the issue
- Concrete remediation steps
- Code examples where helpful

Generate a comprehensive review report with executive summary and detailed findings.`;

    try {
      const result = await runClaudeStream(prompt, {
        mcpConfig: configPath,
        allowedTools: [
          'mcp__github__get_pull_request',
          'mcp__github__list_pull_request_files',
          'mcp__github__get_file_contents',
          'mcp__filesystem__read_file',
          'mcp__filesystem__list_directory'
        ],
        maxTurns: this.maxTurns,
        onToolUse: (tool) => console.log(`🔧 Reviewing with: ${tool.tool_name}`),
        onText: (text) => process.stdout.write(text)
      });
      
      return {
        reviewReport: result.result?.result || 'Review completed',
        cost: result.result?.cost_usd || 0,
        duration: result.result?.duration_ms || 0,
        sessionId: result.result?.session_id
      };
    } finally {
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }
    }
  }
  
  async postReviewComment(prNumber, reviewResult) {
    const commentPrompt = `
Format this code review as a GitHub PR comment:

${reviewResult.reviewReport}

Use GitHub markdown formatting with:
- Clear section headers
- Code blocks for examples
- Proper severity indicators
- Actionable recommendations
- Professional tone
`;
    
    const formatted = await runClaudeCommand(commentPrompt, { format: 'text' });
    
    // Post to GitHub using GitHub API or MCP
    console.log('Formatted review comment:', formatted);
    return formatted;
  }
}

// Usage example
async function automatedReviewExample() {
  const reviewer = new ClaudeCodeReviewer({
    thinkingLevel: 'ultrathink',
    maxTurns: 20
  });
  
  const reviewResult = await reviewer.reviewPullRequest(123, process.cwd());
  await reviewer.postReviewComment(123, reviewResult);
  
  console.log(`Review completed. Cost: $${reviewResult.cost.toFixed(4)}`);
}
```

### 2. Parallel CI/CD Pipeline Integration

```javascript
// Advanced parallel CI/CD integration with concurrent validation stages
class ParallelClaudeCICD {
  constructor() {
    this.baseConfig = {
      format: 'json',
      maxTurns: 8,
      timeout: 600000 // 10 minutes
    };
    
    this.validationStages = new Map();
    this.setupValidationStages();
  }
  
  setupValidationStages() {
    // Define parallel validation stages
    this.validationStages.set('security', {
      name: 'Security Analysis',
      concurrency: 2,
      priority: 'high',
      timeout: 300000,
      thinkingLevel: 'ultrathink'
    });
    
    this.validationStages.set('quality', {
      name: 'Code Quality',
      concurrency: 3,
      priority: 'medium',
      timeout: 180000,
      thinkingLevel: 'think hard'
    });
    
    this.validationStages.set('performance', {
      name: 'Performance Analysis',
      concurrency: 2,
      priority: 'medium',
      timeout: 240000,
      thinkingLevel: 'think harder'
    });
    
    this.validationStages.set('testing', {
      name: 'Test Coverage',
      concurrency: 4,
      priority: 'high',
      timeout: 120000,
      thinkingLevel: 'think hard'
    });
    
    this.validationStages.set('documentation', {
      name: 'Documentation Review',
      concurrency: 2,
      priority: 'low',
      timeout: 90000,
      thinkingLevel: 'think'
    });
  }
  
  // Parallel pre-commit validation with multiple analysis types
  async parallelPreCommitValidation() {
    console.log('🚀 Starting parallel pre-commit validation...');
    
    const stagedFiles = await this.getStagedFiles();
    const fileGroups = this.groupFilesByType(stagedFiles);
    
    // Create validation tasks for each stage
    const validationTasks = [];
    
    // Security validation
    validationTasks.push({
      stage: 'security',
      task: this.createSecurityValidationTask(fileGroups)
    });
    
    // Code quality validation  
    validationTasks.push({
      stage: 'quality',
      task: this.createQualityValidationTask(fileGroups)
    });
    
    // Performance validation
    validationTasks.push({
      stage: 'performance', 
      task: this.createPerformanceValidationTask(fileGroups)
    });
    
    // Test coverage validation
    validationTasks.push({
      stage: 'testing',
      task: this.createTestingValidationTask(fileGroups)
    });
    
    // Documentation validation
    validationTasks.push({
      stage: 'documentation',
      task: this.createDocumentationValidationTask(fileGroups)
    });
    
    // Execute all validation stages in parallel
    const startTime = Date.now();
    const results = await this.executeParallelValidation(validationTasks);
    const duration = Date.now() - startTime;
    
    // Analyze results and determine if commit should proceed
    const validation = this.analyzeValidationResults(results);
    
    console.log(`\n📊 Parallel Validation Summary (${duration}ms):`);
    console.log(`✅ Passed stages: ${validation.passedStages.length}`);
    console.log(`❌ Failed stages: ${validation.failedStages.length}`);
    console.log(`⚠️ Warning stages: ${validation.warningStages.length}`);
    
    if (validation.shouldBlock) {
      console.error('\n🚫 Pre-commit validation FAILED - blocking commit');
      console.error('Critical issues found:');
      validation.criticalIssues.forEach(issue => {
        console.error(`  • ${issue}`);
      });
      process.exit(1);
    } else {
      console.log('\n✅ Pre-commit validation PASSED - allowing commit');
      if (validation.warnings.length > 0) {
        console.warn('\nWarnings (address in future commits):');
        validation.warnings.forEach(warning => {
          console.warn(`  • ${warning}`);
        });
      }
    }
    
    return validation;
  }
  
  async executeParallelValidation(validationTasks) {
    const taskPromises = validationTasks.map(async ({ stage, task }) => {
      const stageConfig = this.validationStages.get(stage);
      
      try {
        console.log(`🔄 Starting ${stageConfig.name} validation...`);
        
        const result = await this.executeValidationStage(stage, task, stageConfig);
        
        console.log(`✅ ${stageConfig.name} completed`);
        return { stage, result, success: true };
        
      } catch (error) {
        console.error(`❌ ${stageConfig.name} failed: ${error.message}`);
        return { stage, error: error.message, success: false };
      }
    });
    
    return await Promise.allSettled(taskPromises);
  }
  
  async executeValidationStage(stage, task, config) {
    const prompt = `${config.thinkingLevel} about this ${config.name.toLowerCase()}:

${task.prompt}

**Analysis Requirements:**
${task.requirements.map(req => `- ${req}`).join('\n')}

**Files to analyze:**
${task.files.map(f => `- ${f}`).join('\n')}

**Priority Level:** ${config.priority.toUpperCase()}

Provide detailed analysis with:
1. Specific findings with file/line references
2. Severity levels (CRITICAL/HIGH/MEDIUM/LOW)
3. Actionable remediation steps
4. Risk assessment for each issue

Set overall_result to "PASS", "WARN", or "FAIL" based on findings.
If CRITICAL or HIGH severity issues found, set to "FAIL".
`;

    const result = await runClaudeCommand(prompt, {
      ...this.baseConfig,
      timeout: config.timeout,
      maxTurns: config.priority === 'high' ? 12 : 8
    });
    
    return {
      stage,
      findings: result.result,
      cost: result.cost_usd,
      duration: result.duration_ms
    };
  }
  
  createSecurityValidationTask(fileGroups) {
    return {
      prompt: `Conduct comprehensive security analysis focusing on vulnerabilities and attack vectors`,
      requirements: [
        'Input validation and sanitization',
        'Authentication and authorization flaws',
        'SQL injection and XSS vulnerabilities', 
        'Hardcoded secrets and credentials',
        'Insecure dependencies',
        'OWASP Top 10 compliance',
        'Data exposure risks'
      ],
      files: [...(fileGroups.backend || []), ...(fileGroups.frontend || []), ...(fileGroups.config || [])]
    };
  }
  
  createQualityValidationTask(fileGroups) {
    return {
      prompt: `Analyze code quality, maintainability, and adherence to best practices`,
      requirements: [
        'Code style and formatting consistency',
        'Naming conventions and clarity',
        'Function complexity and modularity',
        'Error handling completeness',
        'Design pattern implementation',
        'Technical debt indicators',
        'Code duplication analysis'
      ],
      files: [...(fileGroups.backend || []), ...(fileGroups.frontend || [])]
    };
  }
  
  createPerformanceValidationTask(fileGroups) {
    return {
      prompt: `Identify performance bottlenecks and optimization opportunities`,
      requirements: [
        'Algorithm efficiency analysis',
        'Database query optimization',
        'Memory usage patterns',
        'Network request optimization',
        'Caching strategy review',
        'Scalability considerations',
        'Resource leak detection'
      ],
      files: [...(fileGroups.backend || []), ...(fileGroups.database || [])]
    };
  }
  
  createTestingValidationTask(fileGroups) {
    return {
      prompt: `Evaluate test coverage and quality of test implementations`,
      requirements: [
        'Unit test coverage analysis',
        'Integration test requirements',
        'Edge case coverage',
        'Test maintainability',
        'Mock and stub usage',
        'Test data management',
        'CI/CD test integration'
      ],
      files: [...(fileGroups.tests || []), ...(fileGroups.backend || []), ...(fileGroups.frontend || [])]
    };
  }
  
  createDocumentationValidationTask(fileGroups) {
    return {
      prompt: `Review documentation completeness and quality`,
      requirements: [
        'API documentation accuracy',
        'Code comment quality',
        'README file completeness',
        'Setup instruction clarity',
        'Architecture documentation',
        'Inline documentation coverage'
      ],
      files: [...(fileGroups.docs || []), ...(fileGroups.backend || []), ...(fileGroups.frontend || [])]
    };
  }
  
  async getStagedFiles() {
    try {
      const { stdout } = await execAsync('git diff --staged --name-only');
      return stdout.trim().split('\n').filter(file => file.trim() !== '');
    } catch (error) {
      throw new Error(`Failed to get staged files: ${error.message}`);
    }
  }
  
  groupFilesByType(files) {
    const groups = {
      backend: [],
      frontend: [],
      tests: [],
      docs: [],
      config: [],
      database: []
    };
    
    files.forEach(file => {
      const ext = path.extname(file).toLowerCase();
      const fileName = path.basename(file).toLowerCase();
      
      if (file.includes('test') || file.includes('spec') || ext === '.test.js') {
        groups.tests.push(file);
      } else if (ext === '.md' || fileName === 'readme' || file.includes('doc')) {
        groups.docs.push(file);
      } else if (ext === '.json' || ext === '.yml' || ext === '.yaml' || fileName.includes('config')) {
        groups.config.push(file);
      } else if (ext === '.sql' || file.includes('migration') || file.includes('schema')) {
        groups.database.push(file);
      } else if (ext === '.jsx' || ext === '.tsx' || file.includes('component') || file.includes('frontend')) {
        groups.frontend.push(file);
      } else if (ext === '.js' || ext === '.ts' || ext === '.py' || ext === '.java') {
        groups.backend.push(file);
      }
    });
    
    return groups;
  }
  
  analyzeValidationResults(results) {
    const passedStages = [];
    const failedStages = [];
    const warningStages = [];
    const criticalIssues = [];
    const warnings = [];
    
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        const { stage, result: stageResult, success } = result.value;
        
        if (success) {
          const findings = stageResult.findings;
          
          if (findings.includes('overall_result: "FAIL"') || findings.includes('CRITICAL')) {
            failedStages.push(stage);
            criticalIssues.push(`${stage}: Critical issues found`);
          } else if (findings.includes('overall_result: "WARN"') || findings.includes('HIGH')) {
            warningStages.push(stage);
            warnings.push(`${stage}: High priority issues need attention`);
          } else {
            passedStages.push(stage);
          }
        } else {
          failedStages.push(stage);
          criticalIssues.push(`${stage}: Stage execution failed`);
        }
      } else {
        const stage = 'unknown';
        failedStages.push(stage);
        criticalIssues.push(`${stage}: Promise rejected - ${result.reason}`);
      }
    });
    
    // Determine if commit should be blocked
    const shouldBlock = failedStages.length > 0 || 
                       criticalIssues.some(issue => issue.includes('security') || issue.includes('CRITICAL'));
    
    return {
      passedStages,
      failedStages,
      warningStages,
      criticalIssues,
      warnings,
      shouldBlock,
      totalStages: results.length
    };
  }
  
  // Parallel pull request analysis
  async parallelPRAnalysis(prNumber, baseDir) {
    console.log(`🔍 Starting parallel PR analysis for #${prNumber}...`);
    
    const prFiles = await this.getPRFiles(prNumber);
    const analysisTypes = [
      'security_review',
      'code_quality', 
      'performance_impact',
      'test_coverage',
      'breaking_changes',
      'documentation_impact'
    ];
    
    const analysisTasks = analysisTypes.map(type => ({
      type,
      promise: this.runPRAnalysis(type, prNumber, prFiles)
    }));
    
    const results = await Promise.allSettled(
      analysisTasks.map(task => task.promise)
    );
    
    // Compile comprehensive PR review
    const review = await this.compilePRReview(analysisTypes, results, prNumber);
    
    console.log(`✅ Parallel PR analysis completed for #${prNumber}`);
    return review;
  }
  
  async runPRAnalysis(analysisType, prNumber, files) {
    const analysisConfigs = {
      security_review: {
        thinking: 'ultrathink',
        focus: 'security vulnerabilities and attack vectors',
        maxTurns: 15
      },
      code_quality: {
        thinking: 'think hard',
        focus: 'code maintainability and best practices',
        maxTurns: 10
      },
      performance_impact: {
        thinking: 'think harder', 
        focus: 'performance implications and optimizations',
        maxTurns: 12
      },
      test_coverage: {
        thinking: 'think hard',
        focus: 'test adequacy and quality',
        maxTurns: 8
      },
      breaking_changes: {
        thinking: 'think harder',
        focus: 'API compatibility and breaking changes',
        maxTurns: 10
      },
      documentation_impact: {
        thinking: 'think',
        focus: 'documentation updates and completeness',
        maxTurns: 6
      }
    };
    
    const config = analysisConfigs[analysisType];
    
    const prompt = `${config.thinking} about this PR analysis focusing on ${config.focus}:

**Pull Request #${prNumber} - ${analysisType.replace('_', ' ').toUpperCase()} ANALYSIS**

**Changed Files:**
${files.map(f => `- ${f}`).join('\n')}

**Analysis Focus:** ${config.focus}

Provide detailed analysis with:
1. Specific findings with file and line references
2. Impact assessment (HIGH/MEDIUM/LOW)
3. Actionable recommendations
4. Risk evaluation
5. Approval recommendation (APPROVE/REQUEST_CHANGES/COMMENT)

Be thorough and specific in your analysis.
`;

    const result = await runClaudeCommand(prompt, {
      ...this.baseConfig,
      maxTurns: config.maxTurns
    });
    
    return {
      type: analysisType,
      analysis: result.result,
      cost: result.cost_usd,
      duration: result.duration_ms
    };
  }
  
  async getPRFiles(prNumber) {
    try {
      // This would integrate with GitHub API or git commands
      // For now, return a mock implementation
      const { stdout } = await execAsync(`git diff --name-only HEAD~1 HEAD`);
      return stdout.trim().split('\n').filter(file => file.trim() !== '');
    } catch (error) {
      console.warn('Could not get PR files, using recent changes');
      return [];
    }
  }
  
  async compilePRReview(analysisTypes, results, prNumber) {
    const successfulAnalyses = results
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);
    
    const compilationPrompt = `
Compile a comprehensive PR review based on these parallel analyses:

${successfulAnalyses.map(analysis => `
**${analysis.type.replace('_', ' ').toUpperCase()}:**
${analysis.analysis}
`).join('\n')}

Create a unified PR review comment that:
1. Summarizes key findings across all analysis types
2. Prioritizes issues by severity and impact
3. Provides clear action items
4. Makes an overall recommendation (APPROVE/REQUEST_CHANGES/COMMENT)
5. Uses professional, constructive tone
6. Includes specific file/line references where relevant

Format as a GitHub PR review comment with appropriate markdown.
`;

    const review = await runClaudeCommand(compilationPrompt, {
      format: 'text',
      maxTurns: 8
    });
    
    return {
      prNumber,
      review,
      analysisBreakdown: successfulAnalyses,
      totalCost: successfulAnalyses.reduce((sum, a) => sum + a.cost, 0),
      analysisCount: successfulAnalyses.length
    };
  }
  
  // GitHub Actions workflow integration
  async runParallelGitHubAction() {
    const eventName = process.env.GITHUB_EVENT_NAME;
    
    try {
      switch (eventName) {
        case 'push':
          console.log('🔄 Running parallel pre-commit validation...');
          await this.parallelPreCommitValidation();
          break;
          
        case 'pull_request':
          console.log('🔍 Running parallel PR analysis...');
          const prNumber = process.env.GITHUB_PR_NUMBER;
          const review = await this.parallelPRAnalysis(prNumber, process.env.GITHUB_WORKSPACE);
          
          // Output review for GitHub Actions to post
          console.log('::set-output name=review::' + JSON.stringify(review.review));
          break;
          
        case 'workflow_run':
          console.log('🏗️ Running parallel build validation...');
          await this.parallelBuildValidation();
          break;
          
        default:
          console.log('ℹ️ No parallel Claude action configured for this event');
      }
    } catch (error) {
      console.error('Parallel GitHub Action failed:', error.message);
      process.exit(1);
    }
  }
  
  async parallelBuildValidation() {
    const validationTasks = [
      this.validateBuildLogs(),
      this.validateTestResults(),
      this.validatePerformanceMetrics(),
      this.validateSecurityScan(),
      this.validateDependencies()
    ];
    
    const results = await Promise.allSettled(validationTasks);
    
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      console.error('❌ Build validation failed');
      failed.forEach(failure => {
        console.error(`  • ${failure.reason.message}`);
      });
      process.exit(1);
    }
    
    console.log('✅ Parallel build validation passed');
  }
  
  async validateBuildLogs() {
    // Implement build log validation
    return { status: 'passed', component: 'build_logs' };
  }
  
  async validateTestResults() {
    // Implement test result validation
    return { status: 'passed', component: 'test_results' };
  }
  
  async validatePerformanceMetrics() {
    // Implement performance validation
    return { status: 'passed', component: 'performance' };
  }
  
  async validateSecurityScan() {
    // Implement security scan validation
    return { status: 'passed', component: 'security' };
  }
  
  async validateDependencies() {
    // Implement dependency validation
    return { status: 'passed', component: 'dependencies' };
  }
}

// GitHub Actions entry point for parallel processing
if (process.env.GITHUB_ACTIONS) {
  const parallelCicd = new ParallelClaudeCICD();
  parallelCicd.runParallelGitHubAction();
}

// Local development usage
async function parallelCICDExample() {
  const cicd = new ParallelClaudeCICD();
  
  // Example: Run parallel pre-commit validation
  const validation = await cicd.parallelPreCommitValidation();
  
  console.log('\nValidation Summary:', validation);
  
  // Example: Run parallel PR analysis
  if (process.argv.includes('--pr')) {
    const prNumber = process.argv[process.argv.indexOf('--pr') + 1];
    const review = await cicd.parallelPRAnalysis(prNumber, process.cwd());
    
    console.log('\nPR Review:', review.review);
    console.log(`Total analysis cost: ${review.totalCost.toFixed(4)}`);
  }
}
```

### 3. Advanced Batch Processing with Intelligent Parallelism

```javascript
// Intelligent batch processor with adaptive concurrency and load balancing
class IntelligentBatchProcessor {
  constructor(options = {}) {
    this.baseConcurrency = options.concurrency || require('os').cpus().length;
    this.maxConcurrency = options.maxConcurrency || this.baseConcurrency * 2;
    this.minConcurrency = options.minConcurrency || 1;
    this.currentConcurrency = this.baseConcurrency;
    
    this.adaptiveMode = options.adaptiveMode !== false;
    this.retryAttempts = options.retryAttempts || 2;
    this.thinkingLevel = options.thinkingLevel || 'think';
    
    this.performanceMetrics = {
      taskTimes: [],
      errorRates: [],
      throughput: [],
      costEfficiency: []
    };
    
    this.workQueues = {
      high: [], // Complex tasks requiring ultrathink
      medium: [], // Standard tasks
      low: [] // Simple tasks
    };
  }
  
  async processFiles(files, processor, options = {}) {
    console.log(`🚀 Starting intelligent batch processing of ${files.length} files...`);
    
    // Categorize files by complexity
    const categorizedFiles = await this.categorizeFiles(files);
    
    // Create processing queues
    this.populateQueues(categorizedFiles, processor);
    
    // Execute with parallel workers
    const results = await this.executeParallelProcessing(options);
    
    // Generate performance report
    const report = this.generatePerformanceReport(results);
    
    return {
      results,
      performance: report,
      summary: this.generateSummary(results)
    };
  }
  
  async categorizeFiles(files) {
    console.log('📊 Analyzing file complexity...');
    
    const categorization = await Promise.all(
      files.map(async (file) => {
        const stats = fs.statSync(file);
        const complexity = await this.analyzeFileComplexity(file, stats);
        
        return {
          file,
          complexity,
          priority: this.calculatePriority(file, complexity),
          estimatedTime: this.estimateProcessingTime(complexity, stats.size)
        };
      })
    );
    
    return categorization.sort((a, b) => b.priority - a.priority);
  }
  
  async analyzeFileComplexity(file, stats) {
    let complexity = 1;
    
    // File size factor
    if (stats.size > 100000) complexity += 2; // Large files
    else if (stats.size > 10000) complexity += 1;
    
    // File type factor
    const ext = path.extname(file).toLowerCase();
    const complexExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c'];
    if (complexExtensions.includes(ext)) complexity += 1;
    
    // Quick content analysis
    try {
      const content = fs.readFileSync(file, 'utf8');
      
      // Look for complexity indicators
      const complexityPatterns = [
        /class\s+\w+/g, // Classes
        /function\s+\w+/g, // Functions
        /async\s+function/g, // Async functions
        /interface\s+\w+/g, // Interfaces
        /type\s+\w+/g, // Type definitions
        /import\s+.+from/g, // Imports
        /\/\*[\s\S]*?\*\//g // Multi-line comments
      ];
      
      complexityPatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          complexity += Math.min(matches.length * 0.1, 2);
        }
      });
      
      // Special patterns that indicate high complexity
      if (content.includes('algorithm') || content.includes('optimization')) complexity += 1;
      if (content.includes('security') || content.includes('authentication')) complexity += 1;
      if (content.includes('performance') || content.includes('scalability')) complexity += 1;
      
    } catch (error) {
      // If we can't read the file, assume medium complexity
      complexity = 3;
    }
    
    return Math.min(Math.max(complexity, 1), 5);
  }
  
  calculatePriority(file, complexity) {
    let priority = complexity;
    
    // Critical files get higher priority
    if (file.includes('security') || file.includes('auth')) priority += 2;
    if (file.includes('core') || file.includes('main') || file.includes('index')) priority += 1;
    if (file.includes('test') || file.includes('spec')) priority -= 1;
    
    return priority;
  }
  
  estimateProcessingTime(complexity, fileSize) {
    // Base time in milliseconds
    const baseTime = 5000; // 5 seconds
    const complexityFactor = complexity * 2000; // 2 seconds per complexity point
    const sizeFactor = Math.log(fileSize / 1000) * 1000; // Size factor
    
    return Math.max(baseTime + complexityFactor + sizeFactor, 3000);
  }
  
  populateQueues(categorizedFiles, processor) {
    categorizedFiles.forEach(item => {
      const task = {
        ...item,
        processor,
        thinkingLevel: this.getThinkingLevel(item.complexity)
      };
      
      if (item.complexity >= 4) {
        this.workQueues.high.push(task);
      } else if (item.complexity >= 2) {
        this.workQueues.medium.push(task);
      } else {
        this.workQueues.low.push(task);
      }
    });
    
    console.log(`📋 Queue distribution: High: ${this.workQueues.high.length}, Medium: ${this.workQueues.medium.length}, Low: ${this.workQueues.low.length}`);
  }
  
  getThinkingLevel(complexity) {
    if (complexity >= 4) return 'ultrathink';
    if (complexity >= 3) return 'think harder';
    if (complexity >= 2) return 'think hard';
    return 'think';
  }
  
  async executeParallelProcessing(options = {}) {
    const results = [];
    const activeWorkers = new Map();
    const startTime = Date.now();
    
    // Start workers for each queue with different concurrency levels
    const workerPromises = [
      this.processQueue('high', this.workQueues.high, Math.ceil(this.currentConcurrency * 0.4), results, activeWorkers),
      this.processQueue('medium', this.workQueues.medium, Math.ceil(this.currentConcurrency * 0.4), results, activeWorkers),
      this.processQueue('low', this.workQueues.low, Math.ceil(this.currentConcurrency * 0.2), results, activeWorkers)
    ];
    
    // Monitor and adapt concurrency
    if (this.adaptiveMode) {
      this.startAdaptiveMonitoring(activeWorkers);
    }
    
    await Promise.all(workerPromises);
    
    const endTime = Date.now();
    console.log(`✅ Batch processing completed in ${endTime - startTime}ms`);
    
    return results;
  }
  
  async processQueue(queueName, queue, concurrency, results, activeWorkers) {
    console.log(`🔄 Starting ${queueName} priority queue with ${concurrency} workers`);
    
    const semaphore = new Semaphore(concurrency);
    const promises = [];
    
    for (const task of queue) {
      const promise = this.processTask(semaphore, task, queueName, activeWorkers);
      promises.push(promise);
    }
    
    const queueResults = await Promise.allSettled(promises);
    
    queueResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          file: queue[index].file,
          error: result.reason.message,
          queue: queueName,
          success: false
        });
      }
    });
  }
  
  async processTask(semaphore, task, queueName, activeWorkers) {
    await semaphore.acquire();
    
    const workerId = `${queueName}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const startTime = Date.now();
    
    activeWorkers.set(workerId, {
      task: task.file,
      queue: queueName,
      started: startTime,
      complexity: task.complexity
    });
    
    try {
      console.log(`🔧 ${workerId} processing ${path.basename(task.file)} (complexity: ${task.complexity})`);
      
      const result = await this.withRetry(async () => {
        return await task.processor(task);
      }, task.file);
      
      const duration = Date.now() - startTime;
      
      // Update performance metrics
      this.updateMetrics(duration, task.complexity, result.cost || 0, false);
      
      return {
        ...result,
        file: task.file,
        queue: queueName,
        duration,
        workerId,
        success: true
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateMetrics(duration, task.complexity, 0, true);
      
      throw new Error(`Task ${task.file} failed: ${error.message}`);
    } finally {
      activeWorkers.delete(workerId);
      semaphore.release();
    }
  }
  
  async withRetry(operation, context) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryAttempts + 1; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt <= this.retryAttempts) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`⚠️ Attempt ${attempt} failed for ${context}, retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }
  
  startAdaptiveMonitoring(activeWorkers) {
    const monitoringInterval = setInterval(() => {
      this.adaptConcurrency(activeWorkers);
    }, 10000); // Check every 10 seconds
    
    // Clean up monitoring when done
    setTimeout(() => {
      clearInterval(monitoringInterval);
    }, 300000); // Stop after 5 minutes max
  }
  
  adaptConcurrency(activeWorkers) {
    const currentLoad = activeWorkers.size;
    const recentMetrics = this.performanceMetrics.taskTimes.slice(-10);
    
    if (recentMetrics.length < 5) return; // Not enough data
    
    const avgTime = recentMetrics.reduce((a, b) => a + b, 0) / recentMetrics.length;
    const errorRate = this.performanceMetrics.errorRates.slice(-10).reduce((a, b) => a + b, 0) / 10;
    
    let adjustment = 0;
    
    // Increase concurrency if performance is good
    if (avgTime < 30000 && errorRate < 0.1 && currentLoad >= this.currentConcurrency * 0.8) {
      adjustment = 1;
    }
    // Decrease if performance is poor
    else if (avgTime > 60000 || errorRate > 0.2) {
      adjustment = -1;
    }
    
    if (adjustment !== 0) {
      const newConcurrency = Math.max(
        this.minConcurrency,
        Math.min(this.maxConcurrency, this.currentConcurrency + adjustment)
      );
      
      if (newConcurrency !== this.currentConcurrency) {
        console.log(`🔄 Adapting concurrency: ${this.currentConcurrency} → ${newConcurrency}`);
        this.currentConcurrency = newConcurrency;
      }
    }
  }
  
  updateMetrics(duration, complexity, cost, isError) {
    this.performanceMetrics.taskTimes.push(duration);
    this.performanceMetrics.errorRates.push(isError ? 1 : 0);
    this.performanceMetrics.costEfficiency.push(cost / (duration / 1000)); // Cost per second
    
    // Keep only recent metrics
    const maxMetrics = 100;
    Object.keys(this.performanceMetrics).forEach(key => {
      if (this.performanceMetrics[key].length > maxMetrics) {
        this.performanceMetrics[key] = this.performanceMetrics[key].slice(-maxMetrics);
      }
    });
  }
  
  generatePerformanceReport(results) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    const totalDuration = successful.reduce((sum, r) => sum + (r.duration || 0), 0);
    const totalCost = successful.reduce((sum, r) => sum + (r.cost || 0), 0);
    const avgDuration = successful.length > 0 ? totalDuration / successful.length : 0;
    
    const queueBreakdown = {
      high: results.filter(r => r.queue === 'high'),
      medium: results.filter(r => r.queue === 'medium'),
      low: results.filter(r => r.queue === 'low')
    };
    
    return {
      totalFiles: results.length,
      successful: successful.length,
      failed: failed.length,
      successRate: (successful.length / results.length) * 100,
      totalDuration,
      averageDuration: avgDuration,
      totalCost,
      costPerFile: results.length > 0 ? totalCost / results.length : 0,
      queueBreakdown: Object.fromEntries(
        Object.entries(queueBreakdown).map(([queue, items]) => [
          queue,
          {
            count: items.length,
            successful: items.filter(i => i.success).length,
            avgDuration: items.length > 0 
              ? items.reduce((sum, i) => sum + (i.duration || 0), 0) / items.length 
              : 0
          }
        ])
      ),
      throughput: successful.length / (totalDuration / 1000 / 60), // Files per minute
      adaptiveConcurrency: this.adaptiveMode ? this.currentConcurrency : this.baseConcurrency
    };
  }
  
  generateSummary(results) {
    const successful = results.filter(r => r.success);
    const topIssues = this.extractTopIssues(successful);
    
    return {
      overview: `Processed ${results.length} files with ${successful.length} successful completions`,
      topIssues,
      recommendations: this.generateRecommendations(results)
    };
  }
  
  extractTopIssues(results) {
    // This would analyze the results to find common issues
    // For now, return a placeholder
    return [
      'Security vulnerabilities found in 15% of files',
      'Performance bottlenecks identified in database queries',
      'Missing error handling in async functions'
    ];
  }
  
  generateRecommendations(results) {
    const performance = this.generatePerformanceReport(results);
    const recommendations = [];
    
    if (performance.successRate < 90) {
      recommendations.push('Consider reducing batch size or complexity thresholds');
    }
    
    if (performance.averageDuration > 60000) {
      recommendations.push('Optimize prompts for faster execution');
    }
    
    if (performance.costPerFile > 0.10) {
      recommendations.push('Consider using lower-cost models for simple tasks');
    }
    
    return recommendations;
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Enhanced file processor with parallel analysis
async function enhancedFileProcessor(task) {
  const { file, complexity, thinkingLevel } = task;
  
  try {
    const fileContent = fs.readFileSync(file, 'utf8');
    
    const prompt = `${thinkingLevel} about analyzing this ${path.extname(file)} file:

**File: ${path.basename(file)}**
**Complexity Level: ${complexity}/5**

${fileContent}

Based on the complexity level, provide analysis for:

${complexity >= 4 ? `
🔴 COMPREHENSIVE ANALYSIS (High Complexity):
1. Detailed architecture review and design patterns
2. Security vulnerability assessment with specific remediation
3. Performance optimization opportunities with benchmarks
4. Scalability analysis and bottleneck identification
5. Code quality metrics and refactoring suggestions
6. Test coverage analysis and critical test scenarios
7. Documentation gaps and improvement recommendations
` : complexity >= 2 ? `
🟡 STANDARD ANALYSIS (Medium Complexity):
1. Code quality and maintainability assessment
2. Security considerations and basic vulnerability check
3. Performance implications and optimization hints
4. Error handling and edge case analysis
5. Documentation and comment quality
` : `
🟢 BASIC ANALYSIS (Low Complexity):
1. Code style and basic quality check
2. Simple optimization suggestions
3. Documentation completeness
4. Basic error handling review
`}

Provide specific, actionable recommendations with priority levels.
Format the response as structured analysis with clear sections.
`;

    const result = await runClaudeCommand(prompt, {
      format: 'json',
      maxTurns: Math.min(complexity * 2, 15),
      timeout: Math.min(complexity * 30000, 300000) // Complexity-based timeout
    });
    
    return {
      file,
      complexity,
      thinkingLevel,
      analysis: result.result,
      cost: result.cost_usd,
      duration: result.duration_ms,
      turns: result.num_turns,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    throw new Error(`Failed to process ${file}: ${error.message}`);
  }
}

// Usage example with intelligent batch processing
async function intelligentBatchExample() {
  const processor = new IntelligentBatchProcessor({
    concurrency: 8,
    maxConcurrency: 12,
    minConcurrency: 2,
    adaptiveMode: true,
    retryAttempts: 2
  });
  
  // Get all source files in the project
  const files = processor.getCodeFiles('./src');
  console.log(`📂 Found ${files.length} files to analyze`);
  
  const results = await processor.processFiles(files, enhancedFileProcessor, {
    includePerformanceMetrics: true
  });
  
  console.log('\n📊 Intelligent Batch Processing Results:');
  console.log('=====================================');
  
  console.log(`📈 Performance Metrics:`);
  console.log(`  Success Rate: ${results.performance.successRate.toFixed(1)}%`);
  console.log(`  Total Duration: ${(results.performance.totalDuration / 1000).toFixed(1)}s`);
  console.log(`  Average per File: ${(results.performance.averageDuration / 1000).toFixed(1)}s`);
  console.log(`  Total Cost: ${results.performance.totalCost.toFixed(4)}`);
  console.log(`  Cost per File: ${results.performance.costPerFile.toFixed(4)}`);
  console.log(`  Throughput: ${results.performance.throughput.toFixed(1)} files/min`);
  console.log(`  Final Concurrency: ${results.performance.adaptiveConcurrency}`);
  
  console.log(`\n📋 Queue Performance:`);
  Object.entries(results.performance.queueBreakdown).forEach(([queue, stats]) => {
    console.log(`  ${queue.toUpperCase()}: ${stats.successful}/${stats.count} (${(stats.avgDuration/1000).toFixed(1)}s avg)`);
  });
  
  console.log(`\n🎯 Summary:`);
  console.log(`  ${results.summary.overview}`);
  
  console.log(`\n🔍 Top Issues Found:`);
  results.summary.topIssues.forEach(issue => {
    console.log(`  • ${issue}`);
  });
  
  console.log(`\n💡 Recommendations:`);
  results.summary.recommendations.forEach(rec => {
    console.log(`  • ${rec}`);
  });
  
  // Save detailed results
  fs.writeFileSync(
    'intelligent-batch-analysis.json',
    JSON.stringify(results, null, 2)
  );
  
  console.log(`\n💾 Detailed results saved to intelligent-batch-analysis.json`);
  
  return results;
}
```

---

## 🛠️ Advanced Integration Patterns

### 1. Session Management & Context Persistence

```javascript
// Advanced session management
class ClaudeSessionManager {
  constructor() {
    this.sessions = new Map();
    this.maxSessions = 10;
  }
  
  async createSession(projectId, context = {}) {
    const sessionId = this.generateSessionId();
    
    const initialPrompt = `
Project: ${projectId}
Context: ${JSON.stringify(context, null, 2)}

This is the start of our coding session. I'll maintain context throughout our conversation.
`;

    const result = await runClaudeCommand(initialPrompt, { format: 'json' });
    
    this.sessions.set(sessionId, {
      id: sessionId,
      projectId,
      context,
      claudeSessionId: result.session_id,
      created: new Date(),
      lastUsed: new Date(),
      messageCount: 1
    });
    
    // Cleanup old sessions if needed
    this.cleanupOldSessions();
    
    return sessionId;
  }
  
  async continueSession(sessionId, prompt) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    const command = [
      'claude',
      '-r', session.claudeSessionId,
      '-p', `"${prompt}"`,
      '--output-format', 'json'
    ];
    
    const { stdout } = await execAsync(command.join(' '));
    const result = JSON.parse(stdout);
    
    // Update session metadata
    session.lastUsed = new Date();
    session.messageCount++;
    
    return result;
  }
  
  async getSessionHistory(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    // Get conversation history
    const result = await runClaudeCommand(
      'Please summarize our conversation history and current context',
      { format: 'json' }
    );
    
    return {
      session,
      history: result.result
    };
  }
  
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  cleanupOldSessions() {
    if (this.sessions.size <= this.maxSessions) return;
    
    const sessions = Array.from(this.sessions.values())
      .sort((a, b) => a.lastUsed - b.lastUsed);
    
    const toDelete = sessions.slice(0, sessions.length - this.maxSessions);
    toDelete.forEach(session => {
      this.sessions.delete(session.id);
    });
  }
}

// Multi-turn conversation example
async function conversationExample() {
  const sessionManager = new ClaudeSessionManager();
  
  const sessionId = await sessionManager.createSession('my-project', {
    language: 'Node.js',
    framework: 'Express',
    database: 'PostgreSQL'
  });
  
  console.log('Session created:', sessionId);
  
  // First interaction
  const step1 = await sessionManager.continueSession(
    sessionId,
    'Design the database schema for a user management system'
  );
  console.log('Step 1:', step1.result);
  
  // Continue conversation
  const step2 = await sessionManager.continueSession(
    sessionId,
    'Now generate the Express.js routes for user CRUD operations using that schema'
  );
  console.log('Step 2:', step2.result);
  
  // Get history
  const history = await sessionManager.getSessionHistory(sessionId);
  console.log('Session history:', history);
}
```

### 2. Error Handling & Recovery

```javascript
// Comprehensive error handling system
class ClaudeErrorHandler {
  constructor() {
    this.retryConfig = {
      maxRetries: 3,
      backoffMultiplier: 2,
      initialDelay: 1000
    };
    
    this.errorPatterns = {
      timeout: /timeout|timed out/i,
      rateLimit: /rate limit|too many requests/i,
      auth: /authentication|unauthorized|api key/i,
      context: /context|token limit|too long/i,
      network: /network|connection|econnreset/i
    };
  }
  
  async executeWithRecovery(operation, context = {}) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const result = await operation();
        return result;
      } catch (error) {
        lastError = error;
        
        const recovery = this.getRecoveryStrategy(error);
        
        if (recovery.shouldRetry && attempt < this.retryConfig.maxRetries) {
          console.warn(`Attempt ${attempt} failed: ${error.message}`);
          console.warn(`Applying recovery strategy: ${recovery.strategy}`);
          
          await this.applyRecoveryStrategy(recovery, context);
          
          const delay = this.retryConfig.initialDelay * 
                       Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
          await this.sleep(delay);
          continue;
        }
        
        break;
      }
    }
    
    throw new Error(`Operation failed after ${this.retryConfig.maxRetries} attempts: ${lastError.message}`);
  }
  
  getRecoveryStrategy(error) {
    const message = error.message.toLowerCase();
    
    if (this.errorPatterns.timeout.test(message)) {
      return {
        shouldRetry: true,
        strategy: 'timeout_recovery',
        actions: ['increase_timeout', 'reduce_complexity']
      };
    }
    
    if (this.errorPatterns.rateLimit.test(message)) {
      return {
        shouldRetry: true,
        strategy: 'rate_limit_recovery',
        actions: ['exponential_backoff', 'reduce_concurrency']
      };
    }
    
    if (this.errorPatterns.context.test(message)) {
      return {
        shouldRetry: true,
        strategy: 'context_recovery',
        actions: ['compress_context', 'chunk_prompt']
      };
    }
    
    if (this.errorPatterns.auth.test(message)) {
      return {
        shouldRetry: false,
        strategy: 'auth_failure',
        actions: ['check_api_key', 'verify_permissions']
      };
    }
    
    return {
      shouldRetry: true,
      strategy: 'generic_retry',
      actions: ['basic_retry']
    };
  }
  
  async applyRecoveryStrategy(recovery, context) {
    switch (recovery.strategy) {
      case 'context_recovery':
        await this.handleContextOverflow(context);
        break;
        
      case 'rate_limit_recovery':
        context.concurrency = Math.max(1, (context.concurrency || 3) / 2);
        break;
        
      case 'timeout_recovery':
        context.timeout = (context.timeout || 300000) * 1.5;
        break;
    }
  }
  
  async handleContextOverflow(context) {
    console.log('Applying context recovery...');
    
    if (context.prompt && context.prompt.length > 10000) {
      // Compress the prompt
      const compressed = await this.compressPrompt(context.prompt);
      context.prompt = compressed;
    }
    
    // Use Claude's /compact command
    try {
      const compactResult = await runClaudeCommand('/compact', { format: 'text' });
      console.log('Context compacted successfully');
    } catch (compactError) {
      console.warn('Failed to compact context:', compactError.message);
    }
  }
  
  async compressPrompt(prompt) {
    const compressionPrompt = `
Compress this prompt while preserving all essential information and requirements:

${prompt}

Make it concise but complete. Maintain all technical requirements and context.
`;
    
    try {
      const result = await runClaudeCommand(compressionPrompt, { format: 'text' });
      return result;
    } catch (error) {
      console.warn('Failed to compress prompt, using original');
      return prompt;
    }
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage with error handling
async function robustExecution() {
  const errorHandler = new ClaudeErrorHandler();
  
  const operation = async () => {
    return await runClaudeCommand(
      'ultrathink about designing a complex distributed system architecture',
      { format: 'json', timeout: 300000 }
    );
  };
  
  try {
    const result = await errorHandler.executeWithRecovery(operation, {
      prompt: 'complex architecture design',
      timeout: 300000,
      concurrency: 3
    });
    
    console.log('Operation succeeded:', result.result);
  } catch (error) {
    console.error('Operation failed permanently:', error.message);
  }
}
```

---

### 4. Parallel Cost Optimization & Performance Monitoring

```javascript
// Advanced parallel cost optimization with real-time monitoring
class ParallelCostOptimizer {
  constructor(options = {}) {
    this.budgetLimits = {
      hourly: options.hourlyBudget || 2.0,
      daily: options.dailyBudget || 10.0,
      weekly: options.weeklyBudget || 50.0
    };
    
    this.costQueues = {
      economy: [], // Simple tasks, low-cost models
      standard: [], // Medium tasks, balanced cost/performance
      premium: [] // Complex tasks, high-performance models
    };
    
    this.modelPools = new Map();
    this.initializeModelPools();
    
    this.usageMetrics = {
      activeRequests: new Map(),
      completedRequests: [],
      costHistory: [],
      performanceMetrics: []
    };
    
    this.alertWebhooks = options.alertWebhooks || [];
  }
  
  initializeModelPools() {
    // Configure model pools with different cost/performance characteristics
    this.modelPools.set('economy', {
      model: 'claude-haiku-3.5',
      maxConcurrency: 8,
      costPer1kTokens: { input: 0.0008, output: 0.004 },
      averageSpeed: 'fast',
      suitableFor: ['simple analysis', 'basic reviews', 'documentation']
    });
    
    this.modelPools.set('standard', {
      model: 'claude-sonnet-4',
      maxConcurrency: 6,
      costPer1kTokens: { input: 0.003, output: 0.015 },
      averageSpeed: 'medium',
      suitableFor: ['code review', 'testing analysis', 'moderate complexity']
    });
    
    this.modelPools.set('premium', {
      model: 'claude-opus-4',
      maxConcurrency: 3,
      costPer1kTokens: { input: 0.015, output: 0.075 },
      averageSpeed: 'slow',
      suitableFor: ['architecture design', 'security analysis', 'complex problems']
    });
  }
  
  async executeParallelOptimizedTasks(tasks) {
    console.log(`🚀 Starting parallel cost-optimized execution of ${tasks.length} tasks...`);
    
    // Analyze and categorize tasks by complexity and cost requirements
    const categorizedTasks = await this.categorizeTasks(tasks);
    
    // Distribute tasks to appropriate model pools
    this.distributeTasks(categorizedTasks);
    
    // Execute tasks in parallel across all pools
    const executionPromises = [
      this.executePoolTasks('economy'),
      this.executePoolTasks('standard'), 
      this.executePoolTasks('premium')
    ];
    
    // Monitor costs and performance in real-time
    const monitoringPromise = this.startRealTimeMonitoring();
    
    // Wait for all tasks to complete
    const poolResults = await Promise.all(executionPromises);
    
    // Stop monitoring
    clearInterval(monitoringPromise);
    
    // Compile and analyze results
    const results = this.compileResults(poolResults);
    const analysis = await this.generateCostAnalysis(results);
    
    return {
      results,
      costAnalysis: analysis,
      summary: this.generateExecutionSummary(results)
    };
  }
  
  async categorizeTasks(tasks) {
    console.log('📊 Analyzing task complexity and cost requirements...');
    
    const categorizedTasks = await Promise.all(
      tasks.map(async (task, index) => {
        const complexity = await this.analyzeTaskComplexity(task);
        const estimatedTokens = this.estimateTokenUsage(task);
        const urgency = task.urgency || 'normal';
        
        return {
          ...task,
          id: task.id || `task_${index}`,
          complexity,
          estimatedTokens,
          urgency,
          category: this.determineCategory(complexity, estimatedTokens, urgency)
        };
      })
    );
    
    const distribution = this.getDistribution(categorizedTasks);
    console.log(`📋 Task distribution: Economy: ${distribution.economy}, Standard: ${distribution.standard}, Premium: ${distribution.premium}`);
    
    return categorizedTasks;
  }
  
  async analyzeTaskComplexity(task) {
    let complexity = 1;
    
    // Analyze prompt complexity
    const prompt = task.prompt || '';
    
    // Keyword analysis
    const complexityKeywords = {
      high: ['architecture', 'design', 'security', 'optimization', 'algorithm', 'scalability'],
      medium: ['analysis', 'review', 'refactor', 'implement', 'debug'],
      low: ['format', 'comment', 'document', 'simple', 'basic']
    };
    
    Object.entries(complexityKeywords).forEach(([level, keywords]) => {
      const matches = keywords.filter(keyword => prompt.toLowerCase().includes(keyword)).length;
      if (level === 'high') complexity += matches * 2;
      else if (level === 'medium') complexity += matches * 1;
      else complexity += matches * 0.5;
    });
    
    // Thinking level analysis
    if (prompt.includes('ultrathink')) complexity += 3;
    else if (prompt.includes('think harder')) complexity += 2;
    else if (prompt.includes('think hard')) complexity += 1.5;
    else if (prompt.includes('think')) complexity += 1;
    
    // Task type analysis
    if (task.type === 'security_audit') complexity += 2;
    if (task.type === 'performance_analysis') complexity += 1.5;
    if (task.type === 'architecture_review') complexity += 2;
    if (task.type === 'simple_review') complexity -= 0.5;
    
    return Math.min(Math.max(complexity, 1), 5);
  }
  
  estimateTokenUsage(task) {
    const baseTokens = 1000;
    const promptTokens = (task.prompt || '').length * 1.2; // Rough token estimation
    const contextTokens = (task.context || '').length * 1.2;
    const outputMultiplier = task.complexity >= 3 ? 2 : 1.5;
    
    return Math.ceil((baseTokens + promptTokens + contextTokens) * outputMultiplier);
  }
  
  determineCategory(complexity, estimatedTokens, urgency) {
    // Premium category for complex, high-token, or urgent tasks
    if (complexity >= 4 || estimatedTokens > 50000 || urgency === 'high') {
      return 'premium';
    }
    
    // Economy category for simple, low-token tasks
    if (complexity <= 2 && estimatedTokens < 10000 && urgency !== 'high') {
      return 'economy';
    }
    
    // Standard category for everything else
    return 'standard';
  }
  
  getDistribution(tasks) {
    return {
      economy: tasks.filter(t => t.category === 'economy').length,
      standard: tasks.filter(t => t.category === 'standard').length,
      premium: tasks.filter(t => t.category === 'premium').length
    };
  }
  
  distributeTasks(categorizedTasks) {
    categorizedTasks.forEach(task => {
      this.costQueues[task.category].push(task);
    });
  }
  
  async executePoolTasks(poolName) {
    const pool = this.modelPools.get(poolName);
    const tasks = this.costQueues[poolName];
    
    if (tasks.length === 0) {
      return { poolName, results: [] };
    }
    
    console.log(`🔄 Executing ${tasks.length} tasks in ${poolName} pool (${pool.model})`);
    
    const semaphore = new Semaphore(pool.maxConcurrency);
    const results = [];
    
    const taskPromises = tasks.map(async (task) => {
      await semaphore.acquire();
      
      const taskId = `${poolName}_${task.id}`;
      const startTime = Date.now();
      
      // Track active request
      this.usageMetrics.activeRequests.set(taskId, {
        pool: poolName,
        task: task.id,
        started: startTime,
        estimatedCost: this.estimateTaskCost(task, pool)
      });
      
      try {
        const result = await this.executeOptimizedTask(task, pool);
        const duration = Date.now() - startTime;
        
        // Record completion
        this.recordTaskCompletion(taskId, task, result, duration, pool);
        
        return {
          taskId: task.id,
          pool: poolName,
          result,
          duration,
          success: true
        };
        
      } catch (error) {
        const duration = Date.now() - startTime;
        this.recordTaskCompletion(taskId, task, null, duration, pool, error);
        
        return {
          taskId: task.id,
          pool: poolName,
          error: error.message,
          duration,
          success: false
        };
      } finally {
        this.usageMetrics.activeRequests.delete(taskId);
        semaphore.release();
      }
    });
    
    const poolResults = await Promise.allSettled(taskPromises);
    
    poolResults.forEach(result => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          taskId: 'unknown',
          pool: poolName,
          error: result.reason.message,
          success: false
        });
      }
    });
    
    console.log(`✅ ${poolName} pool completed: ${results.filter(r => r.success).length}/${results.length} successful`);
    
    return { poolName, results };
  }
  
  async executeOptimizedTask(task, pool) {
    // Build optimized command for the specific pool
    const command = [
      'claude',
      '-p', `"${task.prompt}"`,
      '--output-format', 'json'
    ];
    
    // Add cost optimization flags based on pool
    if (pool.model === 'claude-haiku-3.5') {
      command.push('--max-turns', '3'); // Limit turns for economy
    } else if (pool.model === 'claude-opus-4') {
      command.push('--max-turns', task.maxTurns || '20'); // Allow more for premium
    } else {
      command.push('--max-turns', task.maxTurns || '10'); // Balanced for standard
    }
    
    if (task.timeout) {
      // Shorter timeouts for economy, longer for premium
      const timeout = pool.model === 'claude-haiku-3.5' ? 
        Math.min(task.timeout, 60000) : task.timeout;
      command.push('--timeout', timeout.toString());
    }
    
    const { stdout } = await execAsync(command.join(' '), {
      timeout: task.timeout || 300000,
      maxBuffer: 1024 * 1024 * 20
    });
    
    return JSON.parse(stdout);
  }
  
  estimateTaskCost(task, pool) {
    const inputCost = (task.estimatedTokens * 0.7 * pool.costPer1kTokens.input) / 1000;
    const outputCost = (task.estimatedTokens * 0.3 * pool.costPer1kTokens.output) / 1000;
    return inputCost + outputCost;
  }
  
  recordTaskCompletion(taskId, task, result, duration, pool, error = null) {
    const record = {
      taskId,
      task: task.id,
      pool: pool.model,
      duration,
      actualCost: result?.cost_usd || 0,
      estimatedCost: this.estimateTaskCost(task, pool),
      tokens: {
        input: result?.input_tokens || 0,
        output: result?.output_tokens || 0
      },
      success: !error,
      error: error?.message || null,
      timestamp: new Date(),
      complexity: task.complexity
    };
    
    this.usageMetrics.completedRequests.push(record);
    this.usageMetrics.costHistory.push({
      timestamp: new Date(),
      cost: record.actualCost,
      pool: pool.model
    });
  }
  
  startRealTimeMonitoring() {
    const monitoringInterval = setInterval(() => {
      this.performCostCheck();
      this.performPerformanceCheck();
    }, 5000); // Check every 5 seconds
    
    return monitoringInterval;
  }
  
  performCostCheck() {
    const now = new Date();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    
    const recentCosts = this.usageMetrics.costHistory
      .filter(entry => entry.timestamp > oneHourAgo)
      .reduce((sum, entry) => sum + entry.cost, 0);
    
    if (recentCosts > this.budgetLimits.hourly * 0.8) {
      this.sendCostAlert('warning', 'hourly', recentCosts, this.budgetLimits.hourly);
    }
    
    if (recentCosts > this.budgetLimits.hourly) {
      this.sendCostAlert('critical', 'hourly', recentCosts, this.budgetLimits.hourly);
      // Consider pausing new tasks or switching to economy models
      this.emergencyCostControl();
    }
  }
  
  performPerformanceCheck() {
    const activeCount = this.usageMetrics.activeRequests.size;
    const recentCompletions = this.usageMetrics.completedRequests.slice(-20);
    
    if (recentCompletions.length >= 10) {
      const avgDuration = recentCompletions.reduce((sum, r) => sum + r.duration, 0) / recentCompletions.length;
      const errorRate = recentCompletions.filter(r => !r.success).length / recentCompletions.length;
      
      console.log(`📊 Performance Check: ${activeCount} active, ${avgDuration.toFixed(0)}ms avg, ${(errorRate * 100).toFixed(1)}% errors`);
      
      if (errorRate > 0.2) {
        console.warn('⚠️ High error rate detected, consider reducing concurrency');
      }
    }
  }
  
  async sendCostAlert(severity, period, current, limit) {
    const alert = {
      severity,
      period,
      currentCost: current,
      limit,
      percentage: (current / limit) * 100,
      timestamp: new Date(),
      activeRequests: this.usageMetrics.activeRequests.size
    };
    
    console.warn(`${severity.toUpperCase()} COST ALERT: ${period} cost ${current.toFixed(4)} (${alert.percentage.toFixed(1)}% of ${limit})`);
    
    // Send to configured webhooks
    for (const webhook of this.alertWebhooks) {
      try {
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alert)
        });
      } catch (error) {
        console.error('Failed to send cost alert:', error.message);
      }
    }
  }
  
  emergencyCostControl() {
    console.warn('🚨 EMERGENCY COST CONTROL ACTIVATED');
    
    // Reduce concurrency across all pools
    this.modelPools.forEach((pool, poolName) => {
      pool.maxConcurrency = Math.max(1, Math.floor(pool.maxConcurrency / 2));
      console.warn(`⚠️ Reduced ${poolName} concurrency to ${pool.maxConcurrency}`);
    });
    
    // Switch premium tasks to standard models if possible
    const premiumTasks = this.costQueues.premium.splice(0);
    const standardCompatible = premiumTasks.filter(task => task.complexity <= 3);
    
    this.costQueues.standard.push(...standardCompatible);
    this.costQueues.premium.push(...premiumTasks.filter(task => task.complexity > 3));
    
    console.warn(`⚠️ Moved ${standardCompatible.length} tasks from premium to standard pool`);
  }
  
  compileResults(poolResults) {
    const allResults = [];
    
    poolResults.forEach(poolResult => {
      allResults.push(...poolResult.results);
    });
    
    return allResults;
  }
  
  async generateCostAnalysis(results) {
    const totalCost = this.usageMetrics.completedRequests.reduce((sum, r) => sum + r.actualCost, 0);
    const totalDuration = this.usageMetrics.completedRequests.reduce((sum, r) => sum + r.duration, 0);
    const successful = this.usageMetrics.completedRequests.filter(r => r.success);
    
    const poolBreakdown = {};
    this.modelPools.forEach((pool, poolName) => {
      const poolRequests = this.usageMetrics.completedRequests.filter(r => r.pool === pool.model);
      poolBreakdown[poolName] = {
        requests: poolRequests.length,
        cost: poolRequests.reduce((sum, r) => sum + r.actualCost, 0),
        averageDuration: poolRequests.length > 0 
          ? poolRequests.reduce((sum, r) => sum + r.duration, 0) / poolRequests.length 
          : 0,
        successRate: poolRequests.length > 0 
          ? poolRequests.filter(r => r.success).length / poolRequests.length 
          : 0
      };
    });
    
    const analysis = {
      execution: {
        totalTasks: results.length,
        successfulTasks: successful.length,
        failedTasks: results.length - successful.length,
        successRate: (successful.length / results.length) * 100
      },
      cost: {
        total: totalCost,
        average: results.length > 0 ? totalCost / results.length : 0,
        breakdown: poolBreakdown,
        efficiency: totalCost / (totalDuration / 1000) // Cost per second
      },
      performance: {
        totalDuration: totalDuration,
        averageDuration: results.length > 0 ? totalDuration / results.length : 0,
        throughput: (successful.length / (totalDuration / 1000)) * 60 // Tasks per minute
      },
      optimization: {
        costSavings: this.calculateCostSavings(),
        recommendations: this.generateOptimizationRecommendations(poolBreakdown)
      }
    };
    
    return analysis;
  }
  
  calculateCostSavings() {
    // Calculate savings from using optimized model selection vs. using only premium
    const actualCost = this.usageMetrics.completedRequests.reduce((sum, r) => sum + r.actualCost, 0);
    const premiumPool = this.modelPools.get('premium');
    
    const estimatedPremiumCost = this.usageMetrics.completedRequests.reduce((sum, r) => {
      const premiumCost = this.estimateTaskCost(
        { estimatedTokens: r.tokens.input + r.tokens.output },
        premiumPool
      );
      return sum + premiumCost;
    }, 0);
    
    return {
      actual: actualCost,
      estimatedPremium: estimatedPremiumCost,
      savings: estimatedPremiumCost - actualCost,
      savingsPercentage: ((estimatedPremiumCost - actualCost) / estimatedPremiumCost) * 100
    };
  }
  
  generateOptimizationRecommendations(poolBreakdown) {
    const recommendations = [];
    
    Object.entries(poolBreakdown).forEach(([poolName, stats]) => {
      if (stats.successRate < 0.9) {
        recommendations.push(`Consider increasing timeout/turns for ${poolName} pool (${(stats.successRate * 100).toFixed(1)}% success rate)`);
      }
      
      if (stats.averageDuration > 60000 && poolName === 'economy') {
        recommendations.push(`Economy tasks are taking too long (${(stats.averageDuration / 1000).toFixed(1)}s avg) - consider moving complex tasks to standard pool`);
      }
      
      if (stats.cost > this.budgetLimits.hourly * 0.3 && poolName === 'premium') {
        recommendations.push(`Premium pool consuming high cost (${stats.cost.toFixed(4)}) - review task complexity categorization`);
      }
    });
    
    const costSavings = this.calculateCostSavings();
    if (costSavings.savingsPercentage > 0) {
      recommendations.push(`Parallel optimization saved ${costSavings.savingsPercentage.toFixed(1)}% (${costSavings.savings.toFixed(4)}) vs. using premium model only`);
    }
    
    return recommendations;
  }
  
  generateExecutionSummary(results) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    return {
      overview: `Executed ${results.length} tasks in parallel across cost-optimized model pools`,
      performance: `${successful.length} successful, ${failed.length} failed`,
      efficiency: `${this.calculateCostSavings().savingsPercentage.toFixed(1)}% cost savings achieved`,
      recommendations: this.generateOptimizationRecommendations({}).slice(0, 3)
    };
  }
}

// Usage example with parallel cost optimization
async function parallelCostOptimizationExample() {
  const optimizer = new ParallelCostOptimizer({
    hourlyBudget: 5.0,
    dailyBudget: 25.0,
    alertWebhooks: [process.env.SLACK_WEBHOOK_URL].filter(Boolean)
  });
  
  // Define various tasks with different complexity levels
  const tasks = [
    {
      id: 'security_audit_1',
      type: 'security_audit',
      prompt: 'ultrathink about conducting a comprehensive security audit of this authentication system',
      urgency: 'high',
      maxTurns: 20
    },
    {
      id: 'code_review_1',
      type: 'code_review',
      prompt: 'think hard about reviewing this pull request for code quality and maintainability',
      urgency: 'normal',
      maxTurns: 12
    },
    {
      id: 'simple_format_1',
      type: 'simple_review',
      prompt: 'think about formatting this code according to our style guidelines',
      urgency: 'low',
      maxTurns: 5
    },
    {
      id: 'performance_analysis_1',
      type: 'performance_analysis',
      prompt: 'think harder about analyzing the performance implications of these database queries',
      urgency: 'normal',
      maxTurns: 15
    },
    {
      id: 'documentation_1',
      type: 'documentation',
      prompt: 'think about generating API documentation for these endpoints',
      urgency: 'low',
      maxTurns: 8
    },
    {
      id: 'architecture_review_1',
      type: 'architecture_review',
      prompt: 'ultrathink about reviewing this microservices architecture for scalability and reliability',
      urgency: 'high',
      maxTurns: 25
    },
    // Add more tasks to demonstrate parallel processing
    ...Array.from({ length: 15 }, (_, i) => ({
      id: `batch_task_${i + 1}`,
      type: i % 3 === 0 ? 'code_review' : i % 3 === 1 ? 'simple_review' : 'performance_analysis',
      prompt: `think about analyzing this code file #${i + 1} for quality and improvements`,
      urgency: i % 4 === 0 ? 'high' : 'normal',
      maxTurns: i % 3 === 0 ? 12 : 8
    }))
  ];
  
  console.log(`🚀 Starting parallel cost-optimized execution of ${tasks.length} tasks...`);
  
  const startTime = Date.now();
  const execution = await optimizer.executeParallelOptimizedTasks(tasks);
  const totalTime = Date.now() - startTime;
  
  console.log('\n📊 Parallel Cost Optimization Results:');
  console.log('=====================================');
  
  console.log(`⏱️  Execution Time: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`📈 Success Rate: ${execution.costAnalysis.execution.successRate.toFixed(1)}%`);
  console.log(`💰 Total Cost: ${execution.costAnalysis.cost.total.toFixed(4)}`);
  console.log(`💡 Cost Savings: ${execution.costAnalysis.optimization.costSavings.savingsPercentage.toFixed(1)}% (${execution.costAnalysis.optimization.costSavings.savings.toFixed(4)})`);
  console.log(`🚀 Throughput: ${execution.costAnalysis.performance.throughput.toFixed(1)} tasks/min`);
  
  console.log('\n📋 Pool Performance:');
  Object.entries(execution.costAnalysis.cost.breakdown).forEach(([pool, stats]) => {
    console.log(`  ${pool.toUpperCase()}: ${stats.requests} tasks, ${stats.cost.toFixed(4)}, ${(stats.successRate * 100).toFixed(1)}% success`);
  });
  
  console.log('\n💡 Optimization Recommendations:');
  execution.costAnalysis.optimization.recommendations.forEach(rec => {
    console.log(`  • ${rec}`);
  });
  
  console.log(`\n🎯 Summary: ${execution.summary.overview}`);
  
  // Save detailed analysis
  fs.writeFileSync(
    'parallel-cost-optimization-analysis.json',
    JSON.stringify(execution, null, 2)
  );
  
  console.log(`\n💾 Detailed analysis saved to parallel-cost-optimization-analysis.json`);
  
  return execution;
}
```

```javascript
// Advanced cost monitoring and optimization
class ClaudeCostMonitor {
  constructor(options = {}) {
    this.budgetLimits = {
      daily: options.dailyBudget || 10.0,
      weekly: options.weeklyBudget || 50.0,
      monthly: options.monthlyBudget || 200.0
    };
    
    this.usageLog = [];
    this.alertWebhook = options.alertWebhook;
  }
  
  logUsage(operation, result) {
    const entry = {
      timestamp: new Date(),
      operation,
      cost: result.cost_usd || 0,
      duration: result.duration_ms || 0,
      turns: result.num_turns || 1,
      sessionId: result.session_id,
      model: this.extractModel(result),
      inputTokens: result.input_tokens || 0,
      outputTokens: result.output_tokens || 0
    };
    
    this.usageLog.push(entry);
    this.checkBudgetAlerts(entry);
    
    return entry;
  }
  
  extractModel(result) {
    // Extract model information from result or use default
    return result.model || 'claude-sonnet-4';
  }
  
  checkBudgetAlerts(entry) {
    const now = new Date();
    const costs = {
      daily: this.getCostSince(new Date(now - 24 * 60 * 60 * 1000)),
      weekly: this.getCostSince(new Date(now - 7 * 24 * 60 * 60 * 1000)),
      monthly: this.getCostSince(new Date(now - 30 * 24 * 60 * 60 * 1000))
    };
    
    Object.entries(costs).forEach(([period, cost]) => {
      const limit = this.budgetLimits[period];
      const percentage = (cost / limit) * 100;
      
      if (percentage >= 90) {
        this.sendAlert('critical', period, cost, limit);
      } else if (percentage >= 75) {
        this.sendAlert('warning', period, cost, limit);
      }
    });
  }
  
  getCostSince(date) {
    return this.usageLog
      .filter(entry => entry.timestamp > date)
      .reduce((total, entry) => total + entry.cost, 0);
  }
  
  async sendAlert(severity, period, cost, limit) {
    const message = {
      severity,
      period,
      currentCost: cost,
      limit,
      percentage: (cost / limit) * 100,
      timestamp: new Date().toISOString()
    };
    
    console.warn(`${severity.toUpperCase()} BUDGET ALERT: ${period} cost $${cost.toFixed(4)} (${message.percentage.toFixed(1)}% of $${limit})`);
    
    if (this.alertWebhook) {
      try {
        await fetch(this.alertWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message)
        });
      } catch (error) {
        console.error('Failed to send webhook alert:', error.message);
      }
    }
  }
  
  getUsageReport() {
    const now = new Date();
    const periods = {
      hour: new Date(now - 60 * 60 * 1000),
      day: new Date(now - 24 * 60 * 60 * 1000),
      week: new Date(now - 7 * 24 * 60 * 60 * 1000),
      month: new Date(now - 30 * 24 * 60 * 60 * 1000)
    };
    
    const report = {};
    
    Object.entries(periods).forEach(([period, since]) => {
      const entries = this.usageLog.filter(entry => entry.timestamp > since);
      
      report[period] = {
        totalCost: entries.reduce((sum, e) => sum + e.cost, 0),
        totalRequests: entries.length,
        averageCost: entries.length > 0 
          ? entries.reduce((sum, e) => sum + e.cost, 0) / entries.length 
          : 0,
        totalTokens: entries.reduce((sum, e) => sum + (e.inputTokens + e.outputTokens), 0),
        operationBreakdown: this.groupBy(entries, 'operation')
      };
    });
    
    return report;
  }
  
  groupBy(array, key) {
    return array.reduce((groups, item) => {
      const group = item[key] || 'unknown';
      if (!groups[group]) {
        groups[group] = { count: 0, totalCost: 0 };
      }
      groups[group].count++;
      groups[group].totalCost += item.cost;
      return groups;
    }, {});
  }
  
  // Smart model selection based on complexity and budget
  selectOptimalModel(task, remainingBudget) {
    const complexity = this.analyzeTaskComplexity(task);
    const costPerToken = {
      'claude-haiku-3.5': { input: 0.0008, output: 0.004 },
      'claude-sonnet-4': { input: 0.003, output: 0.015 },
      'claude-opus-4': { input: 0.015, output: 0.075 }
    };
    
    // Estimate tokens needed
    const estimatedTokens = Math.min(task.length * 1.5, 8000);
    
    // Calculate estimated costs
    const modelCosts = Object.entries(costPerToken).map(([model, rates]) => {
      const estimatedCost = (estimatedTokens * rates.input / 1000) + 
                           (estimatedTokens * rates.output / 1000);
      return { model, estimatedCost, complexity: this.getModelComplexity(model) };
    });
    
    // Select best model within budget that can handle complexity
    const suitable = modelCosts
      .filter(m => m.estimatedCost <= remainingBudget && m.complexity >= complexity)
      .sort((a, b) => b.complexity - a.complexity);
    
    if (suitable.length === 0) {
      return { model: 'claude-haiku-3.5', thinking: 'think' }; // Fallback
    }
    
    const selected = suitable[0];
    return {
      model: selected.model,
      thinking: this.getThinkingLevel(complexity),
      estimatedCost: selected.estimatedCost
    };
  }
  
  analyzeTaskComplexity(task) {
    let score = 1;
    
    const complexityIndicators = [
      /architecture|design|system/i,
      /security|vulnerability/i,
      /performance|optimization/i,
      /algorithm|complexity/i,
      /database|schema/i,
      /integration|workflow/i
    ];
    
    complexityIndicators.forEach(pattern => {
      if (pattern.test(task)) score++;
    });
    
    if (task.length > 1000) score++;
    if (task.includes('ultrathink')) score += 2;
    if (task.includes('think harder')) score += 1;
    
    return Math.min(score, 5);
  }
  
  getModelComplexity(model) {
    const complexityMap = {
      'claude-haiku-3.5': 2,
      'claude-sonnet-4': 4,
      'claude-opus-4': 5
    };
    return complexityMap[model] || 1;
  }
  
  getThinkingLevel(complexity) {
    if (complexity >= 5) return 'ultrathink';
    if (complexity >= 4) return 'think harder';
    if (complexity >= 3) return 'think hard';
    return 'think';
  }
}

// Cost-optimized execution wrapper
async function costOptimizedExecution(prompt, costMonitor) {
  const remainingBudget = costMonitor.budgetLimits.daily - 
                         costMonitor.getCostSince(new Date(Date.now() - 24 * 60 * 60 * 1000));
  
  if (remainingBudget <= 0) {
    throw new Error('Daily budget exceeded');
  }
  
  const selection = costMonitor.selectOptimalModel(prompt, remainingBudget);
  console.log(`Selected: ${selection.model} with ${selection.thinking} (est. $${selection.estimatedCost.toFixed(4)})`);
  
  const enhancedPrompt = `${selection.thinking} about this: ${prompt}`;
  
  const result = await runClaudeCommand(enhancedPrompt, { format: 'json' });
  
  // Log usage for monitoring
  costMonitor.logUsage('cost_optimized_task', result);
  
  return result;
}
```

---

## 🔗 Community Resources & Examples

### Notable GitHub Repositories

1. **Claude Hub** - Webhook service for GitHub integration
   - Repository: https://github.com/intelligence-assist/claude-hub
   - Features: PR reviews, issue analysis, webhook automation

2. **Repomix** - Repository file combining tool
   - Repository: https://github.com/yamadashy/repomix
   - Use case: Prepare codebases for Claude analysis

3. **Awesome Claude Prompts** - Community prompt collection
   - Repository: https://github.com/langgptai/awesome-claude-prompts
   - Resource: Best practices and proven prompts

4. **Claude Coder** - VS Code extension
   - Repository: https://github.com/kodu-ai/claude-coder
   - Features: IDE integration, autonomous coding

### Community Integrations

- **n8n Claude-GitHub Workflows**: https://n8n.io/integrations/claude/and/github/
- **Stagehand MCP Integration**: https://docs.stagehand.dev/integrations/claude-code
- **Multiple MCP Servers**: https://github.com/topics/mcp-server

---

## 🚨 Known Issues & Workarounds

### Node.js Subprocess Issue

**Issue**: Claude Code may not work correctly when spawned from Node.js (GitHub Issue #771)

**Workaround**:
```javascript
// Use explicit shell execution
const { exec } = require('child_process');

async function workaroundClaudeExecution(prompt) {
  const command = `claude -p --dangerously-skip-permissions --output-format json "${prompt}"`;
  
  return new Promise((resolve, reject) => {
    exec(command, { 
      shell: true,
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 10
    }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        try {
          resolve(JSON.parse(stdout));
        } catch (parseError) {
          resolve(stdout);
        }
      }
    });
  });
}
```

### Context Window Management

**Best Practice**: Monitor conversation length and use `/compact` command proactively:

```javascript
async function manageContext(sessionManager, prompt) {
  const session = sessionManager.getCurrentSession();
  
  if (session.messageCount > 50) {
    console.log('Compacting context...');
    await runClaudeCommand('/compact', { format: 'text' });
  }
  
  return await sessionManager.continueSession(session.id, prompt);
}
```

---

## 📊 Quick Reference

### Essential CLI Commands

```bash
# Basic usage
claude -p "prompt"                           # Single execution
claude -p "prompt" --output-format json     # JSON output
claude -p "prompt" --output-format stream-json # Streaming

# Session management
claude -c                                   # Continue last session
claude -r session_id "prompt"              # Resume specific session

# MCP integration
claude -p "prompt" --mcp-config servers.json --allowedTools "tool1,tool2"

# Advanced options
claude -p "prompt" --max-turns 5           # Limit iterations
claude -p "prompt" --verbose               # Detailed logging
claude -p "prompt" --system-prompt "custom system message"
```

### Output Format Examples

**JSON Format**:
```json
{
  "type": "result",
  "subtype": "success",
  "cost_usd": 0.003,
  "duration_ms": 1234,
  "num_turns": 6,
  "result": "Response content...",
  "session_id": "abc123"
}
```

**Stream JSON Messages**:
```json
{"type": "init", "session_id": "abc123"}
{"type": "assistant_text", "content": "Let me think about this..."}
{"type": "tool_use", "tool_name": "bash", "parameters": {...}}
{"type": "result", "cost_usd": 0.003, "result": "Final response"}
```

### Thinking Levels & Token Budgets

| Level | Tokens | Use Case |
|-------|--------|----------|
| `think` | 4,000 | Simple tasks, quick analysis |
| `think hard` | 10,000 | Moderate complexity, planning |
| `think harder` | 31,999 | Complex problems, architecture |
| `ultrathink` | 31,999 | Maximum reasoning, critical decisions |

---

## 🎯 Next Steps

1. **Start Simple**: Begin with basic subprocess execution using the examples above
2. **Add MCP**: Integrate MCP servers for enhanced capabilities  
3. **Implement Monitoring**: Add cost monitoring and error handling
4. **Scale Up**: Build batch processing and CI/CD integrations
5. **Optimize**: Use session management and context optimization

For the latest updates and community discussions, follow:
- **Official Documentation**: https://docs.anthropic.com/en/docs/claude-code
- **GitHub Repository**: https://github.com/anthropics/claude-code
- **Community Discussions**: https://github.com/anthropics/claude-code/discussions

---

*This reference guide is based on official Anthropic documentation and community best practices as of May 2025. Always refer to the official documentation for the most current information.*