import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import PQueue from 'p-queue';
import { v4 as uuidv4 } from 'uuid';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
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
    claudeSessionId?: string;
  };
}

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load Claude configuration
const configPath = join(__dirname, '../../claude-config.json');
let claudeConfig: any = {};
try {
  claudeConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
} catch (error) {
  console.warn('[ClaudeSessionManager] Could not load claude-config.json, using defaults');
}

export class ClaudeSessionManager extends EventEmitter {
  sessions: Map<string, SessionData> = new Map();
  templates: Map<string, any> = new Map();
  shares: Map<string, any> = new Map();
  private queue: PQueue;
  private runStorage: RunStorage;
  private config: any;
  
  constructor() {
    super();
    this.config = claudeConfig;
    
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
      .map(session => this.mapToClaudeSession(session));
  }

  /**
   * Get a specific session
   */
  getSession(id: string): ClaudeSession | null {
    const session = this.sessions.get(id);
    if (!session) {
      console.log(`[SessionManager] Session ${id} not found in map`);
      return null;
    }
    
    console.log(`[SessionManager] Session ${id} found, history:`, session.history);
    
    try {
      return this.mapToClaudeSession(session);
    } catch (error) {
      console.error(`[SessionManager] Error mapping session ${id}:`, error);
      throw error;
    }
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
        // Pass the repository path as working directory
        const repoPath = `/Users/josh/Documents/${input.repository}`;
        const output = await this.callClaudeDirectly(run.input.prompt, repoPath);
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
      const args = [];
      
      // Check if we should use dangerous mode from config
      if (this.config.dangerousMode === true) {
        args.push('--dangerously-skip-permissions');
        console.log('[ClaudeSessionManager] Using dangerous mode for command execution');
      }
      
      args.push('--print', '--output-format', 'json');
      
      // Check if we have an existing session to resume
      const existingSession = this.sessions.get(sessionId);
      if (existingSession && existingSession.history.length > 0) {
        // Only use --resume if this session has been used with Claude CLI before
        // Check if the last history entry has a response (indicating Claude has seen it)
        const hasClaudeHistory = existingSession.history.some(h => h.response);
        if (hasClaudeHistory && existingSession.metadata.claudeSessionId) {
          // Use Claude's session ID for resume
          args.push('--resume', existingSession.metadata.claudeSessionId);
        } else {
          // For forked sessions or sessions with only copied history,
          // we need to build context into the prompt
          const contextPrompt = this.buildContextualPrompt(existingSession.history, prompt);
          prompt = contextPrompt;
        }
      }
      
      // Add any custom flags
      if (options.commandOptions?.customFlags) {
        args.push(...options.commandOptions.customFlags);
      }
      
      // Add the prompt with -p flag at the end
      args.push('-p', prompt);

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
            name: undefined,
            projectContext: options.context?.projectContext,
            model: options.commandOptions?.model || 'claude-3-opus',
            tokenUsage: { inputTokens: 0, outputTokens: 0, estimatedCost: 0 },
            flags: args || []
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

      // Close stdin immediately since we're using -p flag
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
          console.error('[ClaudeSessionManager] Claude execution failed:', {
            code,
            errorOutput,
            args,
            sessionId,
            prompt: prompt.substring(0, 100) + '...'
          });
          reject(new Error(`Claude exited with code ${code}: ${errorOutput}`));
          return;
        }

        // Try to parse Claude's session ID from the output
        let parsedResult = output;
        try {
          const jsonData = JSON.parse(output);
          if (jsonData.session_id) {
            // Always update the Claude session ID from the response
            session.metadata.claudeSessionId = jsonData.session_id;
            console.log(`[ClaudeSessionManager] Updated Claude session ID: ${jsonData.session_id}`);
          }
          // Extract just the result for the UI
          if (jsonData.result) {
            parsedResult = jsonData.result;
          }
        } catch (e) {
          // Output might not be JSON, that's okay
        }

        // Emit final output - send just the result, not the full JSON
        this.emit(`output:${sessionId}`, {
          sessionId,
          type: 'FINAL' as OutputType,
          content: parsedResult,
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
  private async callClaudeDirectly(prompt: string, workingDirectory?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const claudePath = process.env.CLAUDE_PATH || 'claude';
      
      // Build args with dangerous mode if enabled
      const args = [];
      if (this.config.dangerousMode === true) {
        args.push('--dangerously-skip-permissions');
        console.log('[ClaudeSessionManager] Using dangerous mode - all permissions granted');
      }
      args.push('--print', '--output-format', 'json');
      // Add prompt as argument with -p flag
      args.push('-p', prompt);
      
      const claude = spawn(claudePath, args, {
        cwd: workingDirectory || process.cwd()
      });
      
      let output = '';
      let errorOutput = '';

      // Close stdin immediately since we're using -p flag
      claude.stdin.end();

      claude.stdout.on('data', (data) => {
        output += data.toString();
      });

      claude.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      claude.on('close', (code) => {
        if (code !== 0) {
          console.error('[ClaudeSessionManager] Claude command failed:', {
            code,
            errorOutput,
            args,
            prompt: prompt.substring(0, 100) + '...'
          });
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
    // When in dangerous mode, we can let Claude analyze the repository directly
    if (this.config.dangerousMode === true) {
      return `You are in the repository "${input.repository}". 

Use git commands to:
1. Run 'git status' to see what files have changed
2. Run 'git diff' to analyze the changes
3. Look at recent commits with 'git log --oneline -5' for style reference

Then generate a conventional commit message that:
- Follows the pattern: type(scope): description
- Includes a body if needed for complex changes
- Matches the style of recent commits
- Is concise but descriptive

${input.context ? `Additional context: ${input.context}` : ''}

Respond with ONLY the commit message, no explanations.`;
    }
    
    // Fallback to limited diff approach for non-dangerous mode
    const MAX_DIFF_LENGTH = 30000;
    let truncatedDiff = input.diff;
    let diffTruncated = false;
    
    if (input.diff.length > MAX_DIFF_LENGTH) {
      truncatedDiff = input.diff.substring(0, MAX_DIFF_LENGTH);
      diffTruncated = true;
      const lastNewline = truncatedDiff.lastIndexOf('\n');
      if (lastNewline > MAX_DIFF_LENGTH * 0.8) {
        truncatedDiff = truncatedDiff.substring(0, lastNewline);
      }
    }
    
    return `Generate a commit message for the repository "${input.repository}".

Recent commits for style reference:
${input.recentCommits.slice(0, 3).map(commit => {
  // Truncate long commits
  const lines = commit.split('\n');
  return lines[0].substring(0, 100) + (lines[0].length > 100 ? '...' : '');
}).join('\n')}

Git diff${diffTruncated ? ' (truncated due to size)' : ''}:
${truncatedDiff}

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
    try {
      // Parse the JSON output from Claude
      const parsed = JSON.parse(output);
      
      // Claude returns the result in the 'result' field
      if (parsed.result) {
        // The result might contain the commit message directly
        return parsed.result.trim();
      }
      
      // Sometimes it might be in 'message' field
      if (parsed.message) {
        return parsed.message.trim();
      }
      
      // If we can't find it in expected fields, log for debugging
      console.warn('[ClaudeSessionManager] Unexpected JSON structure:', parsed);
      return output;
    } catch (e) {
      // If not JSON, return as-is (shouldn't happen with --output-format json)
      console.warn('[ClaudeSessionManager] Failed to parse Claude output as JSON:', e);
      return output.trim();
    }
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
    if (!session) {
      console.error('[mapToClaudeSession] Received null/undefined session');
      throw new Error('Cannot map null session');
    }
    
    const history = session.history || [];
    console.log(`[mapToClaudeSession] Mapping session ${session.id}, history length: ${history.length}`);
    
    return {
      id: session.id,
      createdAt: session.createdAt.toISOString(),
      lastActivity: session.lastActivity.toISOString(),
      status: session.status,
      pid: session.process?.pid || null,
      workingDirectory: session.workingDirectory,
      metadata: {
        name: session.metadata?.name || undefined,
        projectContext: session.metadata?.projectContext || undefined,
        model: session.metadata?.model || 'claude-3-opus',
        tokenUsage: session.metadata?.tokenUsage || { inputTokens: 0, outputTokens: 0, estimatedCost: 0 },
        flags: session.metadata?.flags || []
      },
      history: history
    };
  }

  /**
   * Get RunStorage instance (for resolvers)
   */
  getRunStorage(): RunStorage {
    return this.runStorage;
  }

  /**
   * Build a contextual prompt that includes conversation history
   */
  private buildContextualPrompt(history: any[], newPrompt: string): string {
    if (!history || history.length === 0) {
      return newPrompt;
    }

    // Build conversation context from history
    let context = "Previous conversation:\n\n";
    
    history.forEach((entry, index) => {
      if (entry.prompt) {
        context += `Human: ${entry.prompt}\n\n`;
      }
      if (entry.response) {
        context += `Assistant: ${entry.response}\n\n`;
      }
    });
    
    // Add current prompt
    context += `Human: ${newPrompt}`;
    
    return context;
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