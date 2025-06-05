import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import PQueue from 'p-queue';
import { v4 as uuidv4 } from 'uuid';
import { RunStorage, RunStatus, AgentRun } from './RunStorage.js';
import { initializeCleanupJob } from './RunCleanupJob.js';
import { progressTracker, ProgressStage } from './ProgressTracker.js';
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

export class ClaudeSessionManager extends EventEmitter {
  private sessions: Map<string, SessionData> = new Map();
  private queue: PQueue;
  private runStorage: RunStorage;
  
  constructor() {
    super();
    
    // Initialize run storage
    this.runStorage = new RunStorage('/Users/josh/Documents/meta-gothic-framework/logs/claude-runs');
    
    // Initialize cleanup job (runs every 24 hours)
    initializeCleanupJob(this.runStorage, 24);
    
    // Configure concurrent Claude process limits
    this.queue = new PQueue({ 
      concurrency: 5, // Max 5 concurrent Claude processes
      interval: 1000, // Rate limiting window
      intervalCap: 3  // Max 3 new processes per second
    });
  }

  /**
   * Check if Claude CLI is available
   */
  async checkClaudeAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      const claude = spawn(process.env.CLAUDE_PATH || 'claude', ['--version']);
      
      claude.on('error', () => resolve(false));
      claude.on('exit', (code) => resolve(code === 0));
    });
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): ClaudeSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.status !== 'TERMINATED')
      .map(this.mapToClaudeSession);
  }

  /**
   * Get a specific session
   */
  getSession(id: string): ClaudeSession | null {
    const session = this.sessions.get(id);
    return session ? this.mapToClaudeSession(session) : null;
  }

  /**
   * Execute a command (can be called in parallel)
   */
  async executeCommand(
    prompt: string,
    options: {
      sessionId?: string;
      workingDirectory?: string;
      context?: any;
      commandOptions?: any;
    } = {}
  ): Promise<{ sessionId: string; output: Promise<string> }> {
    const sessionId = options.sessionId || nanoid();
    
    // Queue the execution for controlled parallelism
    const output = this.queue.add(async () => {
      return await this.executeClaudeCommand(sessionId, prompt, options);
    });

    return { sessionId, output: output as Promise<string> };
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
      input: {
        prompt: this.buildCommitMessagePrompt(input),
        diff: input.diff,
        recentCommits: input.recentCommits,
        model: 'claude-3-opus',
        temperature: 0.7,
      },
      retryCount: 0,
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
        progressTracker.updateRunProgress(run.id, ProgressStage.INITIALIZING, 'Starting Claude session');

        // Simulate context loading
        progressTracker.updateRunProgress(run.id, ProgressStage.LOADING_CONTEXT, 'Loading repository context');
        
        // Main processing
        progressTracker.updateRunProgress(run.id, ProgressStage.PROCESSING, 'Generating commit message');
        const startTime = Date.now();
        const output = await this.callClaudeDirectly(run.input.prompt);
        const duration = Date.now() - startTime;

        // Parsing response
        progressTracker.updateRunProgress(run.id, ProgressStage.PARSING_RESPONSE, 'Extracting commit message');
        const message = this.extractCommitMessage(output);
        const confidence = this.calculateConfidence(output);

        // Saving results
        progressTracker.updateRunProgress(run.id, ProgressStage.SAVING_RESULTS, 'Saving results');
        
        // Update run with success
        run.status = RunStatus.SUCCESS;
        run.completedAt = new Date();
        run.duration = duration;
        run.output = {
          message,
          confidence,
          rawResponse: output,
          tokensUsed: Math.floor(output.length / 4), // Rough estimate
          reasoning: undefined,
        };

        await this.runStorage.saveRun(run);
        
        // Mark as completed
        progressTracker.updateRunProgress(run.id, ProgressStage.COMPLETED, 'Completed successfully');

        return {
          message,
          confidence,
          runId: run.id,
        };
      } catch (error: any) {
        // Mark as failed
        progressTracker.markRunFailed(run.id, error.message);
        
        // Update run with failure
        run.status = RunStatus.FAILED;
        run.completedAt = new Date();
        run.duration = Date.now() - run.startedAt.getTime();
        run.error = {
          code: error.code || 'UNKNOWN',
          message: error.message,
          stackTrace: error.stack,
          recoverable: this.runStorage.isRecoverable(error),
        };

        await this.runStorage.saveRun(run);
        throw error;
      }
    });

    return result as { message: string; confidence: number; runId: string; };
  }

  /**
   * Generate multiple commit messages in parallel (internal optimization)
   */
  async generateBatchCommitMessages(
    repositories: Array<{
      name: string;
      diff: string;
      recentCommits: string[];
    }>
  ): Promise<Map<string, string>> {
    // Create promises for all repositories
    const promises = repositories.map(async (repo) => {
      const result = await this.generateCommitMessage({
        repository: repo.name,
        diff: repo.diff,
        recentCommits: repo.recentCommits
      });
      
      return { name: repo.name, message: result.message };
    });

    // Execute in parallel (limited by queue concurrency)
    const results = await Promise.all(promises);
    
    // Convert to map
    const messageMap = new Map<string, string>();
    results.forEach(r => messageMap.set(r.name, r.message));
    
    return messageMap;
  }

  /**
   * Stream command output via EventEmitter
   */
  subscribeToOutput(sessionId: string, callback: (output: CommandOutput) => void) {
    this.on(`output:${sessionId}`, callback);
    
    // Return unsubscribe function
    return () => {
      this.off(`output:${sessionId}`, callback);
    };
  }

  /**
   * Execute Claude command with streaming
   */
  private async executeClaudeCommand(
    sessionId: string,
    prompt: string,
    options: any
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const claudePath = process.env.CLAUDE_PATH || 'claude';
      const args = ['--print', '--output-format', 'json'];
      
      // Add any custom flags
      if (options.commandOptions?.customFlags) {
        args.push(...options.commandOptions.customFlags);
      }

      const claude = spawn(claudePath, args, {
        cwd: options.workingDirectory || process.cwd()
      });

      let output = '';
      let errorOutput = '';

      // Get existing session or create new one
      let session = this.sessions.get(sessionId);
      
      if (!session) {
        // Create new session
        session = {
          id: sessionId,
          process: claude,
          status: 'PROCESSING',
          createdAt: new Date(),
          lastActivity: new Date(),
          workingDirectory: options.workingDirectory || process.cwd(),
          history: [],
          metadata: {
            model: options.commandOptions?.model || 'claude-3-opus',
            tokenUsage: { inputTokens: 0, outputTokens: 0, estimatedCost: 0 },
            flags: args
          }
        };
        this.sessions.set(sessionId, session);
      } else {
        // Update existing session
        session.process = claude;
        session.status = 'PROCESSING';
        session.lastActivity = new Date();
      }
      
      // Add this command to history
      session.history.push({
        timestamp: new Date(),
        prompt: prompt,
        response: null, // Will be updated when complete
        executionTime: 0,
        success: false
      });

      // Build prompt with history for context
      let fullPrompt = prompt;
      
      if (session.history.length > 0) {
        // Include recent conversation history for context
        const recentHistory = session.history.slice(-5); // Last 5 exchanges
        const historyContext = recentHistory
          .filter(h => h.response) // Only include completed exchanges
          .map(h => `Human: ${h.prompt}\nAssistant: ${h.response}`)
          .join('\n\n');
        
        if (historyContext) {
          fullPrompt = `${historyContext}\n\nHuman: ${prompt}\nAssistant:`;
        }
      }
      
      // Send prompt with history
      claude.stdin.write(fullPrompt);
      claude.stdin.end();

      // Handle stdout
      claude.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        
        // Emit streaming output
        this.emit(`output:${sessionId}`, {
          sessionId,
          type: 'STDOUT' as OutputType,
          content: chunk,
          timestamp: new Date().toISOString(),
          isFinal: false,
          tokens: chunk.length / 4 // Rough estimate
        });
      });

      // Handle stderr
      claude.stderr.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        
        this.emit(`output:${sessionId}`, {
          sessionId,
          type: 'STDERR' as OutputType,
          content: chunk,
          timestamp: new Date().toISOString(),
          isFinal: false
        });
      });

      // Handle completion
      claude.on('close', (code) => {
        session.status = code === 0 ? 'IDLE' : 'ERROR';
        session.lastActivity = new Date();
        
        // Update the last history entry with the response
        const lastHistoryEntry = session.history[session.history.length - 1];
        if (lastHistoryEntry) {
          lastHistoryEntry.response = output;
          lastHistoryEntry.executionTime = Date.now() - lastHistoryEntry.timestamp.getTime();
          lastHistoryEntry.success = code === 0;
        }
        
        if (code !== 0) {
          reject(new Error(`Claude exited with code ${code}: ${errorOutput}`));
          return;
        }

        // Emit final output
        this.emit(`output:${sessionId}`, {
          sessionId,
          type: 'FINAL' as OutputType,
          content: output,
          timestamp: new Date().toISOString(),
          isFinal: true
        });

        resolve(output);
      });

      claude.on('error', (error) => {
        session.status = 'ERROR';
        reject(error);
      });
    });
  }

  /**
   * Direct Claude call without session management (for simple operations)
   */
  private async callClaudeDirectly(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const claudePath = process.env.CLAUDE_PATH || 'claude';
      const claude = spawn(claudePath, ['--print']);
      
      let output = '';
      let errorOutput = '';

      claude.stdin.write(prompt);
      claude.stdin.end();

      claude.stdout.on('data', (data) => {
        output += data.toString();
      });

      claude.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      claude.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Claude exited with code ${code}: ${errorOutput}`));
          return;
        }
        resolve(output);
      });

      claude.on('error', reject);
    });
  }

  /**
   * Build commit message prompt
   */
  private buildCommitMessagePrompt(input: {
    repository: string;
    diff: string;
    recentCommits: string[];
    context?: string;
  }): string {
    return `Generate a commit message for the repository "${input.repository}".

Recent commits for style reference:
${input.recentCommits.slice(0, 5).join('\n')}

Git diff:
${input.diff}

${input.context ? `Additional context: ${input.context}` : ''}

Generate a conventional commit message that:
1. Follows the pattern: type(scope): description
2. Includes a body if needed for complex changes
3. Matches the style of recent commits
4. Is concise but descriptive

Respond with ONLY the commit message, no explanations.`;
  }

  /**
   * Extract commit message from Claude output
   */
  private extractCommitMessage(output: string): string {
    // Remove any JSON wrapper if present
    try {
      const parsed = JSON.parse(output);
      if (parsed.message) return parsed.message;
    } catch {
      // Not JSON, continue with string processing
    }

    // Extract just the commit message
    const lines = output.trim().split('\n');
    const messageLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed && 
        !trimmed.startsWith('Based on') &&
        !trimmed.startsWith('Looking at') &&
        !trimmed.startsWith('I see') &&
        !trimmed.includes('commit message:');
    });

    return messageLines.join('\n').trim();
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(output: string): number {
    // Simple heuristic based on output characteristics
    if (output.includes('error') || output.includes('unclear')) return 0.5;
    if (output.length < 20) return 0.6;
    if (output.match(/^(feat|fix|chore|docs|style|refactor|test|perf)(\(.+?\))?:/)) return 0.9;
    return 0.75;
  }

  /**
   * Map internal session to GraphQL type
   */
  private mapToClaudeSession(session: SessionData): ClaudeSession {
    return {
      id: session.id,
      createdAt: session.createdAt.toISOString(),
      lastActivity: session.lastActivity.toISOString(),
      status: session.status,
      pid: session.process?.pid || null,
      workingDirectory: session.workingDirectory,
      metadata: session.metadata,
      history: session.history
    };
  }

  /**
   * Get RunStorage instance (for resolvers)
   */
  getRunStorage(): RunStorage {
    return this.runStorage;
  }

  /**
   * Clean up terminated sessions
   */
  async cleanup() {
    for (const [_id, session] of this.sessions) {
      if (session.process && !session.process.killed) {
        session.process.kill('SIGTERM');
      }
    }
    this.sessions.clear();
  }
}