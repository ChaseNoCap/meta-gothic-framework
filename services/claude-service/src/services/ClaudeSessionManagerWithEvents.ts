import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import PQueue from 'p-queue';
import { v4 as uuidv4 } from 'uuid';
import { RunStorage, RunStatus, AgentRun } from './RunStorage.js';
import { initializeCleanupJob } from './RunCleanupJob.js';
import { progressTracker, ProgressStage } from './ProgressTracker.js';
import { Emits, Traces, setEventBus, IEventBus } from '@chasenocap/event-system';
import type { ILogger } from '@chasenocap/logger';
import type { 
  ClaudeSession, 
  SessionStatus, 
  CommandOutput,
  OutputType 
} from '../types/generated.js';

interface SessionData {
  id: string;
  process?: ChildProcess;
  status: SessionStatus;
  createdAt: Date;
  lastActivity: Date;
  workingDirectory: string;
  history: any[];
  metadata: {
    projectContext?: string;
    model: string;
    tokenUsage: {
      inputTokens: number;
      outputTokens: number;
      estimatedCost: number;
    };
    flags: string[];
  };
}

export class ClaudeSessionManagerWithEvents extends EventEmitter {
  private sessions: Map<string, SessionData> = new Map();
  private queue: PQueue;
  private runStorage: RunStorage;
  private logger?: ILogger;
  private correlationId?: string;
  
  constructor(eventBus?: IEventBus, logger?: ILogger, correlationId?: string) {
    super();
    
    // Set event bus for decorators
    if (eventBus) {
      setEventBus(this, eventBus);
    }
    
    this.logger = logger;
    this.correlationId = correlationId;
    
    // Initialize run storage
    this.runStorage = new RunStorage('/Users/josh/Documents/meta-gothic-framework/logs/claude-runs');
    
    // Initialize cleanup job (runs every 24 hours)
    initializeCleanupJob(this.runStorage, 24);
    
    // Configure concurrent Claude process limits
    this.queue = new PQueue({ concurrency: 3 });
  }

  @Emits('claude.session.started', {
    payloadMapper: (workingDirectory: string, projectContext?: string) => ({
      workingDirectory,
      projectContext,
      timestamp: Date.now()
    })
  })
  @Traces({ threshold: 100 })
  async createSession(workingDirectory: string, projectContext?: string): Promise<ClaudeSession> {
    const sessionId = nanoid();
    const sessionLogger = this.logger?.child({ sessionId, operation: 'createSession' });
    
    sessionLogger?.info('Creating new Claude session', { workingDirectory, projectContext });
    
    const sessionData: SessionData = {
      id: sessionId,
      status: 'initializing',
      createdAt: new Date(),
      lastActivity: new Date(),
      workingDirectory,
      history: [],
      metadata: {
        projectContext,
        model: 'claude-3-5-sonnet-20241022',
        tokenUsage: {
          inputTokens: 0,
          outputTokens: 0,
          estimatedCost: 0
        },
        flags: []
      }
    };
    
    this.sessions.set(sessionId, sessionData);
    
    // Create the Claude process
    const args = ['--no-assistant-confirmation'];
    if (projectContext) {
      args.push('--context', projectContext);
    }
    
    sessionLogger?.debug('Spawning Claude process', { args });
    
    const claudeProcess = spawn('claude', args, {
      cwd: workingDirectory,
      env: { ...process.env }
    });
    
    sessionData.process = claudeProcess;
    sessionData.status = 'active';
    
    // Set up event handlers
    claudeProcess.stdout?.on('data', (data) => {
      this.handleOutput(sessionId, data.toString(), 'stdout');
    });
    
    claudeProcess.stderr?.on('data', (data) => {
      this.handleOutput(sessionId, data.toString(), 'stderr');
    });
    
    claudeProcess.on('exit', (code) => {
      sessionLogger?.info('Claude process exited', { code });
      this.handleSessionExit(sessionId, code);
    });
    
    claudeProcess.on('error', (error) => {
      sessionLogger?.error('Claude process error', error);
      this.handleSessionError(sessionId, error);
    });
    
    sessionLogger?.info('Claude session created successfully', { sessionId });
    
    return {
      id: sessionId,
      status: sessionData.status,
      createdAt: sessionData.createdAt.toISOString(),
      lastActivity: sessionData.lastActivity.toISOString(),
      workingDirectory: sessionData.workingDirectory,
      metadata: sessionData.metadata
    };
  }

  @Emits('claude.command.executed', {
    payloadMapper: (sessionId: string, command: string) => ({
      sessionId,
      command,
      timestamp: Date.now()
    })
  })
  @Traces({ threshold: 500, includeArgs: true })
  async executeCommand(sessionId: string, command: string): Promise<CommandOutput> {
    const session = this.sessions.get(sessionId);
    const commandLogger = this.logger?.child({ sessionId, operation: 'executeCommand' });
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    if (session.status !== 'active') {
      throw new Error(`Session ${sessionId} is not active`);
    }
    
    commandLogger?.info('Executing command', { command: command.substring(0, 100) });
    
    return new Promise((resolve, reject) => {
      const outputChunks: string[] = [];
      const startTime = Date.now();
      
      const outputHandler = (data: Buffer) => {
        const chunk = data.toString();
        outputChunks.push(chunk);
        this.emit(`output:${sessionId}`, {
          sessionId,
          data: chunk,
          type: 'stdout' as OutputType,
          timestamp: new Date().toISOString()
        });
      };
      
      const errorHandler = (data: Buffer) => {
        const chunk = data.toString();
        outputChunks.push(chunk);
        this.emit(`output:${sessionId}`, {
          sessionId,
          data: chunk,
          type: 'stderr' as OutputType,
          timestamp: new Date().toISOString()
        });
      };
      
      session.process!.stdout?.on('data', outputHandler);
      session.process!.stderr?.on('data', errorHandler);
      
      // Send command to Claude
      session.process!.stdin?.write(command + '\n');
      
      // Wait for response (with timeout)
      const timeout = setTimeout(() => {
        session.process!.stdout?.off('data', outputHandler);
        session.process!.stderr?.off('data', errorHandler);
        
        const duration = Date.now() - startTime;
        commandLogger?.warn('Command timed out', { duration });
        
        reject(new Error('Command execution timeout'));
      }, 60000); // 1 minute timeout
      
      // Detect completion (simplified - in real implementation would be more sophisticated)
      setTimeout(() => {
        clearTimeout(timeout);
        session.process!.stdout?.off('data', outputHandler);
        session.process!.stderr?.off('data', errorHandler);
        
        const output = outputChunks.join('');
        const duration = Date.now() - startTime;
        
        // Update token usage (simplified calculation)
        const estimatedTokens = Math.ceil(output.length / 4);
        session.metadata.tokenUsage.outputTokens += estimatedTokens;
        session.metadata.tokenUsage.inputTokens += Math.ceil(command.length / 4);
        session.metadata.tokenUsage.estimatedCost = 
          (session.metadata.tokenUsage.inputTokens * 0.003 + 
           session.metadata.tokenUsage.outputTokens * 0.015) / 1000;
        
        session.lastActivity = new Date();
        
        commandLogger?.info('Command executed successfully', {
          duration,
          outputLength: output.length,
          tokenUsage: session.metadata.tokenUsage
        });
        
        resolve({
          sessionId,
          output,
          timestamp: new Date().toISOString(),
          tokenUsage: {
            inputTokens: Math.ceil(command.length / 4),
            outputTokens: estimatedTokens,
            estimatedCost: estimatedTokens * 0.015 / 1000
          }
        });
      }, 3000); // Wait 3 seconds for response
    });
  }

  @Emits('claude.session.killed')
  @Traces({ threshold: 50 })
  async killSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    const sessionLogger = this.logger?.child({ sessionId, operation: 'killSession' });
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    sessionLogger?.info('Killing session');
    
    if (session.process && !session.process.killed) {
      session.process.kill('SIGTERM');
      
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (session.process && !session.process.killed) {
          sessionLogger?.warn('Force killing session');
          session.process.kill('SIGKILL');
        }
      }, 5000);
    }
    
    session.status = 'terminated';
    this.sessions.delete(sessionId);
    
    sessionLogger?.info('Session killed successfully');
  }

  @Emits('claude.agentRun.created', {
    payloadMapper: (input: any) => ({
      sessionId: input.sessionId,
      commands: input.commands.length,
      timestamp: Date.now()
    })
  })
  @Traces({ threshold: 1000 })
  async createAgentRun(input: {
    sessionId: string;
    commands: string[];
    description?: string;
  }): Promise<AgentRun> {
    const runLogger = this.logger?.child({ 
      sessionId: input.sessionId, 
      operation: 'createAgentRun' 
    });
    
    runLogger?.info('Creating agent run', { 
      commandCount: input.commands.length,
      description: input.description 
    });
    
    // Create run in storage
    const run = await this.runStorage.createRun({
      sessionId: input.sessionId,
      commands: input.commands,
      description: input.description,
      totalSteps: input.commands.length,
      metadata: {
        correlationId: this.correlationId
      }
    });
    
    // Execute commands sequentially
    this.queue.add(async () => {
      await this.executeAgentRun(run);
    });
    
    runLogger?.info('Agent run created', { runId: run.id });
    
    return run;
  }

  /**
   * Generate commit message (optimized for parallel execution)
   */
  async generateCommitMessage(input: {
    repository: string;
    diff: string;
    recentCommits: string[];
    context?: string;
  }): Promise<{ message: string; confidence: number; runId: string }> {
    // Create run record
    const run: AgentRun = {
      id: uuidv4(),
      repository: input.repository,
      status: RunStatus.QUEUED,
      startedAt: new Date(),
      metadata: {
        type: 'commit-message',
        input: {
          diff: input.diff,
          recentCommits: input.recentCommits,
          context: input.context,
        },
        correlationId: this.correlationId
      },
      totalSteps: 1,
      currentStep: 0,
      commands: [`Generate commit message for ${input.repository}`],
      description: `Generate commit message for repository ${input.repository}`,
    };

    await this.runStorage.saveRun(run);

    // Emit initial progress
    progressTracker.updateRunProgress(run.id, ProgressStage.QUEUED);

    // This can be called multiple times in parallel
    const result = await this.queue.add(async () => {
      try {
        // Update status to running
        run.status = RunStatus.RUNNING;
        await this.runStorage.saveRun(run);
        progressTracker.updateRunProgress(run.id, ProgressStage.INITIALIZING, 'Starting commit message generation');

        // Build prompt
        const prompt = this.buildCommitMessagePrompt(input);
        
        // Main processing
        progressTracker.updateRunProgress(run.id, ProgressStage.PROCESSING, 'Generating commit message');
        const startTime = Date.now();
        
        // For now, create a simple commit message based on the diff
        // In a real implementation, this would call Claude API
        const message = await this.generateCommitMessageFromDiff(input.diff, input.recentCommits);
        const duration = Date.now() - startTime;

        // Update run with result
        run.status = RunStatus.COMPLETED;
        run.completedAt = new Date();
        run.duration = duration;
        run.output = { message };
        await this.runStorage.saveRun(run);

        progressTracker.updateRunProgress(run.id, ProgressStage.COMPLETED, 'Commit message generated');

        return {
          message,
          confidence: 0.85, // Mock confidence for now
          runId: run.id
        };
      } catch (error: any) {
        run.status = RunStatus.FAILED;
        run.completedAt = new Date();
        run.error = error.message;
        await this.runStorage.saveRun(run);

        progressTracker.updateRunProgress(run.id, ProgressStage.FAILED, error.message);
        throw error;
      }
    });

    return result;
  }

  private buildCommitMessagePrompt(input: {
    repository: string;
    diff: string;
    recentCommits: string[];
    context?: string;
  }): string {
    return `Generate a DETAILED conventional commit message for the following changes in ${input.repository}.

REQUIREMENTS:
1. Analyze the diff thoroughly to understand what changed and WHY
2. Use conventional commit format: type(scope): description
3. The description should explain the business value, not just what changed
4. Include a detailed body with bullet points explaining:
   - What was added/removed/modified
   - Why these changes were made
   - The impact on the system
5. If there are breaking changes, add a BREAKING CHANGE section

EXAMPLES OF GOOD COMMIT MESSAGES:

feat(auth): implement OAuth2 authentication flow to enhance security

• Add OAuth2Provider service with Google and GitHub support
• Implement token refresh mechanism with automatic retry
• Create middleware for protecting API endpoints
• Add comprehensive test suite covering edge cases

This enables users to login with their existing accounts and improves
overall system security by eliminating password storage.

---

refactor(api): restructure service layer to improve maintainability

• Extract business logic from controllers into dedicated services
• Implement dependency injection for better testability
• Consolidate error handling into centralized middleware
• Remove 500+ lines of duplicated code across endpoints

Reduces technical debt and makes the codebase more maintainable for
future development. All existing APIs remain backward compatible.

---

fix(payments): resolve race condition in concurrent transactions

• Add distributed locking mechanism using Redis
• Implement retry logic with exponential backoff
• Fix transaction isolation level in database queries
• Add monitoring alerts for failed transactions

This prevents duplicate charges that were occurring when users
double-clicked the payment button. Improves payment reliability by 99.9%.

BREAKING CHANGE: PaymentService.process() now requires a lockKey parameter

---

NOW ANALYZE THIS DIFF:

Repository: ${input.repository}

Recent commits for style reference:
${input.recentCommits.slice(0, 5).map(c => `• ${c}`).join('\n')}

${input.context ? `Additional context: ${input.context}` : ''}

Git diff to analyze:
${input.diff}

Generate a commit message following the examples above. Be specific about what changed and why it matters.`;
  }

  private async generateCommitMessageFromDiff(diff: string, recentCommits: string[]): Promise<string> {
    // Claude-style commit message generation focusing on understanding the changes
    console.log('[DEBUG] generateCommitMessageFromDiff called with diff length:', diff.length);
    console.log('[DEBUG] First 200 chars of diff:', diff.substring(0, 200));
    
    // If diff is empty or too short, return a fallback message
    if (!diff || diff.length < 10) {
      console.log('[DEBUG] Diff is empty or too short, using fallback');
      return 'chore: update files';
    }
    
    // Check if this is a file list format (used when diff is too large)
    if (diff.startsWith('Files changed')) {
      console.log('[DEBUG] Detected file list format instead of full diff');
      return this.generateCommitMessageFromFileList(diff, recentCommits);
    }
    
    const lines = diff.split('\n');
    const fileChanges: Map<string, { additions: string[], deletions: string[], isNew: boolean, isDeleted: boolean }> = new Map();
    let currentFile = '';
    
    // Parse the diff to understand changes per file
    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        const match = line.match(/b\/(.+)$/);
        if (match) currentFile = match[1];
      } else if (line.startsWith('new file mode')) {
        if (currentFile) {
          fileChanges.set(currentFile, { additions: [], deletions: [], isNew: true, isDeleted: false });
        }
      } else if (line.startsWith('deleted file mode')) {
        if (currentFile) {
          fileChanges.set(currentFile, { additions: [], deletions: [], isNew: false, isDeleted: true });
        }
      } else if (line.startsWith('+++') || line.startsWith('---')) {
        if (currentFile && !fileChanges.has(currentFile)) {
          fileChanges.set(currentFile, { additions: [], deletions: [], isNew: false, isDeleted: false });
        }
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        const change = fileChanges.get(currentFile);
        if (change) change.additions.push(line.substring(1).trim());
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        const change = fileChanges.get(currentFile);
        if (change) change.deletions.push(line.substring(1).trim());
      }
    }
    
    console.log('[DEBUG] Parsed file changes:', fileChanges.size, 'files');
    
    // Deep analysis of what actually changed
    const analysis = {
      features: [] as string[],
      fixes: [] as string[],
      refactors: [] as string[],
      removals: [] as string[],
      configurations: [] as string[],
      dependencies: [] as string[],
      types: [] as string[],
      tests: [] as string[]
    };
    
    // Analyze each file's content to understand the changes
    for (const [filePath, changes] of fileChanges.entries()) {
      const fileName = filePath.split('/').pop() || '';
      const additions = changes.additions.join('\n');
      const deletions = changes.deletions.join('\n');
      
      // Analyze what was added/removed to understand the change
      if (changes.isNew) {
        if (filePath.includes('resolver') || additions.includes('resolver')) {
          analysis.features.push(`GraphQL resolver for ${this.extractFunctionality(additions)}`);
        } else if (filePath.includes('service') || additions.includes('Service')) {
          analysis.features.push(`${this.extractServiceName(additions)} service`);
        } else if (filePath.includes('component') || additions.includes('React.FC')) {
          analysis.features.push(`${this.extractComponentName(additions)} component`);
        } else if (additions.includes('interface') || additions.includes('type')) {
          analysis.types.push(`type definitions for ${this.extractTypeName(additions)}`);
        } else if (filePath.includes('test') || additions.includes('describe(')) {
          analysis.tests.push(`test coverage for ${this.extractTestSubject(additions)}`);
        }
      } else if (changes.isDeleted) {
        if (deletions.includes('export')) {
          analysis.removals.push(`deprecated ${this.extractRemovedFunctionality(fileName, deletions)}`);
        }
      } else {
        // Modified files - understand what changed
        if (additions.includes('fix') || additions.includes('Fixed') || 
            (additions.includes('!') && deletions.includes('?')) ||
            (additions.includes('catch') && !deletions.includes('catch'))) {
          analysis.fixes.push(this.extractFixDescription(additions, deletions));
        }
        
        if (additions.includes('async') && deletions.includes('then') ||
            additions.includes('=>') && deletions.includes('function')) {
          analysis.refactors.push('modernize asynchronous code patterns');
        }
        
        if (filePath.includes('package.json')) {
          analysis.dependencies.push(this.extractDependencyChanges(additions, deletions));
        }
        
        if (filePath.includes('config') || filePath.includes('settings')) {
          analysis.configurations.push(this.extractConfigChanges(additions, deletions));
        }
      }
    }
    
    // Determine the primary change type and build message
    let commitType = 'chore';
    let primaryChange = '';
    let details: string[] = [];
    
    if (analysis.features.length > 0) {
      commitType = 'feat';
      primaryChange = analysis.features[0];
      if (analysis.features.length > 1) {
        details = analysis.features.slice(1).map(f => `Also implements ${f}`);
      }
    } else if (analysis.fixes.length > 0) {
      commitType = 'fix';
      primaryChange = analysis.fixes[0];
      if (analysis.fixes.length > 1) {
        details = analysis.fixes.slice(1).map(f => `Additionally ${f}`);
      }
    } else if (analysis.refactors.length > 0) {
      commitType = 'refactor';
      primaryChange = analysis.refactors[0];
      details = analysis.refactors.slice(1);
    } else if (analysis.removals.length > 0) {
      commitType = 'chore';
      primaryChange = `remove ${analysis.removals.join(' and ')}`;
    } else if (analysis.tests.length > 0) {
      commitType = 'test';
      primaryChange = `add ${analysis.tests[0]}`;
    } else if (analysis.configurations.length > 0) {
      commitType = 'build';
      primaryChange = analysis.configurations[0];
    } else if (analysis.dependencies.length > 0) {
      commitType = 'build';
      primaryChange = analysis.dependencies[0];
    }
    
    // If no specific change was detected, analyze the files more generally
    if (!primaryChange) {
      console.log('[DEBUG] No primary change detected, analyzing files more generally');
      
      // Look at what kinds of files changed
      const changedFileTypes = new Set<string>();
      const modifiedFunctions: string[] = [];
      
      for (const [filePath, changes] of fileChanges.entries()) {
        const ext = filePath.split('.').pop() || '';
        changedFileTypes.add(ext);
        
        // Try to extract what was modified
        const allContent = [...changes.additions, ...changes.deletions].join('\n');
        const funcMatch = allContent.match(/(?:function|const|class|interface|type)\s+(\w+)/g);
        if (funcMatch) {
          funcMatch.forEach(match => {
            const name = match.replace(/^(function|const|class|interface|type)\s+/, '');
            if (name && !modifiedFunctions.includes(name)) {
              modifiedFunctions.push(name);
            }
          });
        }
      }
      
      if (modifiedFunctions.length > 0) {
        primaryChange = `update ${modifiedFunctions.slice(0, 3).join(', ')}${modifiedFunctions.length > 3 ? ' and others' : ''}`;
      } else if (fileChanges.size === 1) {
        const fileName = Array.from(fileChanges.keys())[0].split('/').pop()?.replace(/\.[^.]+$/, '') || 'file';
        primaryChange = `update ${fileName}`;
      } else {
        primaryChange = `update ${fileChanges.size} files across the codebase`;
      }
    }
    
    // Extract scope from file paths
    const directories = new Set<string>();
    for (const [filePath] of fileChanges) {
      const parts = filePath.split('/');
      if (parts.length > 1) {
        directories.add(parts[0]);
      }
    }
    
    let scope = '';
    if (directories.size === 1) {
      scope = Array.from(directories)[0];
    } else if (fileChanges.size === 1) {
      const fileName = Array.from(fileChanges.keys())[0].split('/').pop()?.replace(/\.[^.]+$/, '');
      if (fileName) scope = fileName;
    }
    
    // Build the commit message
    const typeWithScope = scope ? `${commitType}(${scope})` : commitType;
    let message = `${typeWithScope}: ${primaryChange}`;
    
    console.log('[DEBUG] Generated message:', message);
    
    // Add explanation of why this change matters
    if (analysis.types.length > 0) {
      details.push(`Introduces ${analysis.types.join(' and ')}`);
    }
    
    if (details.length > 0) {
      message += '\n\n' + details.join('. ') + '.';
    }
    
    // Add context about the impact
    const impact = this.analyzeImpact(analysis, fileChanges);
    if (impact) {
      message += `\n\n${impact}`;
    }
    
    // Check for breaking changes
    const hasBreakingChanges = diff.includes('BREAKING') || 
      analysis.removals.some(r => r.includes('export')) ||
      fileChanges.has('schema.graphql') ||
      fileChanges.has('package.json');
      
    if (hasBreakingChanges) {
      message += '\n\nBREAKING CHANGE: This change may require updates to dependent code';
    }
    
    return message;
  }
  
  private extractFunctionality(content: string): string {
    // Extract what functionality is being added
    const match = content.match(/export\s+(?:async\s+)?function\s+(\w+)|export\s+const\s+(\w+)|type\s+Mutation\s*=\s*{[^}]*(\w+):/);
    if (match) {
      const name = match[1] || match[2] || match[3];
      return name.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
    }
    return 'new functionality';
  }
  
  private extractServiceName(content: string): string {
    const match = content.match(/class\s+(\w*Service)|export\s+class\s+(\w+)|new\s+(\w*Service)/);
    if (match) {
      const name = match[1] || match[2] || match[3];
      return name.replace('Service', '').replace(/([A-Z])/g, ' $1').trim();
    }
    return 'new';
  }
  
  private extractComponentName(content: string): string {
    const match = content.match(/export\s+(?:const|function)\s+(\w+):|const\s+(\w+)\s*:\s*React\.FC|function\s+(\w+)\(/);
    if (match) {
      const name = match[1] || match[2] || match[3];
      return name.replace(/([A-Z])/g, ' $1').trim();
    }
    return 'UI';
  }
  
  private extractTypeName(content: string): string {
    const match = content.match(/(?:export\s+)?(?:interface|type)\s+(\w+)/);
    if (match) {
      return match[1].replace(/([A-Z])/g, ' $1').trim().toLowerCase();
    }
    return 'data structures';
  }
  
  private extractTestSubject(content: string): string {
    const match = content.match(/describe\(['"`]([^'"`]+)['"`]/);
    if (match) {
      return match[1].toLowerCase();
    }
    return 'new functionality';
  }
  
  private extractRemovedFunctionality(fileName: string, content: string): string {
    const match = content.match(/export\s+(?:async\s+)?function\s+(\w+)|export\s+const\s+(\w+)|export\s+class\s+(\w+)/);
    if (match) {
      const name = match[1] || match[2] || match[3];
      return name.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
    }
    return fileName.replace(/\.[^.]+$/, '');
  }
  
  private extractFixDescription(additions: string, deletions: string): string {
    // Analyze what was fixed
    if (additions.includes('null') && !deletions.includes('null')) {
      return 'add null safety checks';
    }
    if (additions.includes('try') && !deletions.includes('try')) {
      return 'improve error handling';
    }
    if (additions.includes('===') && deletions.includes('==')) {
      return 'fix type comparison issues';
    }
    if (additions.includes('await') && !deletions.includes('await')) {
      return 'resolve async operation handling';
    }
    return 'resolve edge case issues';
  }
  
  private extractDependencyChanges(additions: string, deletions: string): string {
    const added = additions.match(/"([^"]+)":\s*"[^"]+"/g) || [];
    const removed = deletions.match(/"([^"]+)":\s*"[^"]+"/g) || [];
    
    if (added.length > removed.length) {
      const newDep = added[0]?.match(/"([^"]+)"/)?.[1];
      return `add ${newDep} dependency`;
    } else if (removed.length > added.length) {
      const oldDep = removed[0]?.match(/"([^"]+)"/)?.[1];
      return `remove ${oldDep} dependency`;
    } else {
      return 'update dependencies';
    }
  }
  
  private extractConfigChanges(additions: string, deletions: string): string {
    if (additions.includes('env') || additions.includes('ENV')) {
      return 'update environment configuration';
    }
    if (additions.includes('port') || additions.includes('PORT')) {
      return 'modify service port configuration';
    }
    return 'update configuration settings';
  }
  
  private analyzeImpact(analysis: any, fileChanges: Map<string, any>): string {
    const impacts: string[] = [];
    
    if (analysis.features.length > 0) {
      impacts.push('This enhancement extends the system\'s capabilities');
    }
    if (analysis.fixes.length > 0) {
      impacts.push('Improves system stability and reliability');
    }
    if (analysis.refactors.length > 0) {
      impacts.push('Enhances code maintainability and developer experience');
    }
    if (analysis.removals.length > 0) {
      impacts.push('Reduces codebase complexity by removing unused code');
    }
    
    return impacts.join('. ') + (impacts.length > 0 ? '.' : '');
  }
  
  private generateCommitMessageFromFileList(fileList: string, recentCommits: string[]): string {
    // Parse the file list format: "Files changed (N):\nM path/to/file\nA path/to/other"
    console.log('[DEBUG] Generating commit message from file list');
    
    const lines = fileList.split('\n');
    const fileChanges: Array<{ status: string, path: string }> = [];
    
    // Skip the header line and parse file changes
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length > 2) {
        const status = line.substring(0, 1);
        const path = line.substring(2);
        fileChanges.push({ status, path });
      }
    }
    
    console.log('[DEBUG] Parsed', fileChanges.length, 'file changes from list');
    
    // Analyze files by their paths and names to understand the change
    const analysis = {
      newFiles: [] as string[],
      modifiedFiles: [] as string[],
      deletedFiles: [] as string[],
      fileTypes: new Set<string>(),
      directories: new Set<string>(),
      components: [] as string[],
      services: [] as string[],
      types: [] as string[],
      tests: [] as string[]
    };
    
    for (const { status, path } of fileChanges) {
      const fileName = path.split('/').pop() || '';
      const ext = fileName.split('.').pop() || '';
      const dir = path.split('/')[0];
      
      analysis.fileTypes.add(ext);
      if (dir !== path) analysis.directories.add(dir);
      
      // Categorize by status
      if (status === 'A' || status === '??') {
        analysis.newFiles.push(fileName);
        if (path.includes('component') || fileName.includes('Component')) {
          analysis.components.push(fileName.replace(/\.(tsx?|jsx?)$/, ''));
        } else if (path.includes('service') || fileName.includes('Service')) {
          analysis.services.push(fileName.replace(/\.(ts|js)$/, ''));
        } else if (path.includes('types') || fileName.includes('.d.ts')) {
          analysis.types.push(fileName.replace(/\.(d\.)?ts$/, ''));
        } else if (path.includes('test') || fileName.includes('.test.') || fileName.includes('.spec.')) {
          analysis.tests.push(fileName.replace(/\.(test|spec)\.(ts|js)$/, ''));
        }
      } else if (status === 'M' || status === 'MM') {
        analysis.modifiedFiles.push(fileName);
      } else if (status === 'D') {
        analysis.deletedFiles.push(fileName);
      }
    }
    
    // Build commit message based on analysis
    let commitType = 'chore';
    let primaryChange = '';
    let scope = '';
    
    // Determine scope
    if (analysis.directories.size === 1) {
      scope = Array.from(analysis.directories)[0];
    }
    
    // Determine type and primary change
    if (analysis.components.length > 0) {
      commitType = 'feat';
      primaryChange = `add ${analysis.components[0]}${analysis.components.length > 1 ? ' and other components' : ' component'}`;
    } else if (analysis.services.length > 0) {
      commitType = 'feat';
      primaryChange = `implement ${analysis.services[0]}${analysis.services.length > 1 ? ' and related services' : ''}`;
    } else if (analysis.tests.length > 0) {
      commitType = 'test';
      primaryChange = `add tests for ${analysis.tests[0]}${analysis.tests.length > 1 ? ' and others' : ''}`;
    } else if (analysis.deletedFiles.length > analysis.newFiles.length) {
      commitType = 'chore';
      primaryChange = `remove deprecated files`;
    } else if (analysis.modifiedFiles.length > 0 && analysis.newFiles.length === 0) {
      commitType = 'refactor';
      primaryChange = `update ${analysis.modifiedFiles.length === 1 ? analysis.modifiedFiles[0].replace(/\.[^.]+$/, '') : 'multiple components'}`;
    } else if (analysis.newFiles.length > 0) {
      commitType = 'feat';
      primaryChange = `add ${analysis.newFiles[0].replace(/\.[^.]+$/, '')}${analysis.newFiles.length > 1 ? ' and related files' : ''}`;
    } else {
      primaryChange = 'update project files';
    }
    
    const typeWithScope = scope ? `${commitType}(${scope})` : commitType;
    let message = `${typeWithScope}: ${primaryChange}`;
    
    // Add context if we have more details
    const details: string[] = [];
    if (analysis.types.length > 0) {
      details.push(`Includes type definitions for ${analysis.types.join(', ')}`);
    }
    if (analysis.newFiles.length > 1 || analysis.modifiedFiles.length > 1) {
      const summary = [];
      if (analysis.newFiles.length > 0) summary.push(`${analysis.newFiles.length} new files`);
      if (analysis.modifiedFiles.length > 0) summary.push(`${analysis.modifiedFiles.length} modifications`);
      if (analysis.deletedFiles.length > 0) summary.push(`${analysis.deletedFiles.length} deletions`);
      details.push(`Changes include ${summary.join(', ')}`);
    }
    
    if (details.length > 0) {
      message += '\n\n' + details.join('. ') + '.';
    }
    
    console.log('[DEBUG] Generated message from file list:', message);
    return message;
  }

  private async executeAgentRun(run: AgentRun): Promise<void> {
    const runLogger = this.logger?.child({ 
      runId: run.id,
      sessionId: run.sessionId,
      operation: 'executeAgentRun' 
    });
    
    try {
      await this.runStorage.updateRunStatus(run.id, 'running');
      progressTracker.startRun(run.id, run.totalSteps);
      
      for (let i = 0; i < run.commands.length; i++) {
        const command = run.commands[i];
        
        progressTracker.updateProgress(run.id, {
          stage: ProgressStage.EXECUTING_COMMAND,
          currentStep: i + 1,
          message: `Executing: ${command.substring(0, 50)}...`
        });
        
        try {
          const output = await this.executeCommand(run.sessionId, command);
          await this.runStorage.addCommandResult(run.id, {
            command,
            output: output.output,
            success: true,
            executedAt: new Date()
          });
        } catch (error) {
          runLogger?.error('Command failed', error as Error, { command });
          await this.runStorage.addCommandResult(run.id, {
            command,
            output: (error as Error).message,
            success: false,
            error: (error as Error).message,
            executedAt: new Date()
          });
          throw error;
        }
      }
      
      await this.runStorage.updateRunStatus(run.id, 'completed');
      progressTracker.completeRun(run.id);
      
      runLogger?.info('Agent run completed successfully');
    } catch (error) {
      runLogger?.error('Agent run failed', error as Error);
      await this.runStorage.updateRunStatus(run.id, 'failed', (error as Error).message);
      progressTracker.failRun(run.id, (error as Error).message);
      throw error;
    }
  }

  private handleOutput(sessionId: string, data: string, type: 'stdout' | 'stderr'): void {
    this.emit(`output:${sessionId}`, {
      sessionId,
      data,
      type,
      timestamp: new Date().toISOString()
    });
  }

  @Emits('claude.session.completed', {
    payloadMapper: (sessionId: string, code: number | null) => ({
      sessionId,
      exitCode: code || 0,
      timestamp: Date.now()
    })
  })
  private handleSessionExit(sessionId: string, code: number | null): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'completed';
      this.logger?.info('Session exited', { sessionId, code });
    }
  }

  @Emits('claude.session.failed', {
    payloadMapper: (sessionId: string, error: Error) => ({
      sessionId,
      error: error.message,
      timestamp: Date.now()
    })
  })
  private handleSessionError(sessionId: string, error: Error): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'error';
      this.logger?.error('Session error', error, { sessionId });
    }
  }

  async checkClaudeAvailability(): Promise<boolean> {
    try {
      const { execSync } = await import('child_process');
      execSync('which claude', { encoding: 'utf8' });
      return true;
    } catch {
      return false;
    }
  }

  getActiveSessions(): ClaudeSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.status === 'active')
      .map(s => ({
        id: s.id,
        status: s.status,
        createdAt: s.createdAt.toISOString(),
        lastActivity: s.lastActivity.toISOString(),
        workingDirectory: s.workingDirectory,
        metadata: s.metadata
      }));
  }

  async getSession(sessionId: string): Promise<ClaudeSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    return {
      id: session.id,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
      lastActivity: session.lastActivity.toISOString(),
      workingDirectory: session.workingDirectory,
      metadata: session.metadata
    };
  }
}