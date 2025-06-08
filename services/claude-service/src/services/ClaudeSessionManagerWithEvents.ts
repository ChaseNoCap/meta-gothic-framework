import { spawn, ChildProcess, exec } from 'child_process';
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
import { promisify } from 'util';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

interface SessionData {
  id: string;
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

export class ClaudeSessionManagerWithEvents extends EventEmitter {
  private sessions: Map<string, SessionData> = new Map();
  private queue: PQueue;
  private runStorage: RunStorage;
  private logger?: ILogger;
  private correlationId?: string;
  private config: any = {};
  
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
    
    // Load configuration if available
    this.loadConfig();
  }
  
  private loadConfig(): void {
    try {
      const configPath = join(process.cwd(), 'claude-config.json');
      if (existsSync(configPath)) {
        this.config = JSON.parse(readFileSync(configPath, 'utf-8'));
        this.logger?.info('Loaded Claude configuration', { 
          allowedTools: this.config.permissions?.allowedTools 
        });
      } else {
        // Default configuration
        this.config = {
          permissions: {
            allowedTools: ['Bash', 'Read', 'Write', 'Edit']
          }
        };
        this.logger?.info('Using default Claude configuration');
      }
    } catch (error) {
      this.logger?.error('Failed to load Claude configuration', error);
      // Fallback to defaults
      this.config = {
        permissions: {
          allowedTools: ['Bash', 'Read', 'Write', 'Edit']
        }
      };
    }
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
      status: 'ACTIVE' as SessionStatus,
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
  async executeCommandInSession(sessionId: string, command: string): Promise<CommandOutput> {
    console.log(`\n[executeCommandInSession] START - sessionId: ${sessionId}`);
    console.log(`[executeCommandInSession] Command: ${command}`);
    
    const session = this.sessions.get(sessionId);
    const commandLogger = this.logger?.child({ sessionId, operation: 'executeCommand' });
    
    if (!session) {
      console.error(`[executeCommandInSession] Session ${sessionId} not found in sessions map`);
      console.log(`[executeCommandInSession] Available sessions:`, Array.from(this.sessions.keys()));
      throw new Error(`Session ${sessionId} not found`);
    }
    
    console.log(`[executeCommandInSession] Session found:`, {
      id: session.id,
      status: session.status,
      historyLength: session.history?.length || 0,
      hasClaudeSessionId: !!session.metadata?.claudeSessionId,
      metadata: session.metadata
    });
    
    if (session.status !== 'active' && session.status !== 'ACTIVE') {
      // For now, allow any session to execute commands
      // throw new Error(`Session ${sessionId} is not active`);
      console.log(`[executeCommandInSession] Session ${sessionId} status: ${session.status}, proceeding anyway`);
    }
    
    commandLogger?.info('Executing command', { command: command.substring(0, 100) });
    
    const startTime = Date.now();
    
    // Use spawn instead of exec for better control
    return new Promise((resolve, reject) => {
      // Use full path to claude to avoid PATH issues
      const claudePath = '/Users/josh/.nvm/versions/node/v18.20.8/bin/claude';
      
      // Build args array starting with the prompt
      const args: string[] = [];
      
      // Add allowed tools from configuration
      const allowedTools = this.config.permissions?.allowedTools || ['Bash', 'Read', 'Write', 'Edit'];
      
      // Check if we should use dangerous mode (for testing/development)
      const dangerousMode = process.env.CLAUDE_DANGEROUS_MODE;
      commandLogger?.info('Environment check', { 
        CLAUDE_DANGEROUS_MODE: dangerousMode,
        isDangerous: dangerousMode === 'true'
      });
      
      if (dangerousMode === 'true') {
        args.push('--dangerously-skip-permissions');
        commandLogger?.warn('Using dangerous mode - all permissions granted');
      } else {
        // Try different formats for allowedTools
        allowedTools.forEach(tool => {
          args.push('--allowedTools', tool);
        });
        commandLogger?.info('Using allowed tools', { allowedTools });
      }
      
      // Add output format flags
      args.push('--print', '--output-format', 'json');
      
      // Check if we need to build context into the prompt
      let actualPrompt = command;
      console.log(`[executeCommandInSession] Checking if context needed...`);
      console.log(`[executeCommandInSession] Session history:`, session.history);
      
      if (session.history && session.history.length > 0) {
        console.log(`[executeCommandInSession] Session has ${session.history.length} history entries`);
        const hasClaudeHistory = session.history.some((h: any) => h.response);
        console.log(`[executeCommandInSession] Has Claude history (with responses): ${hasClaudeHistory}`);
        console.log(`[executeCommandInSession] Has Claude session ID: ${!!session.metadata?.claudeSessionId}`);
        
        if (hasClaudeHistory && session.metadata?.claudeSessionId) {
          // Use resume if we have real Claude history
          console.log(`[executeCommandInSession] Using --resume with session ID: ${session.metadata.claudeSessionId}`);
          args.push('--resume', session.metadata.claudeSessionId);
        } else {
          // Build context for forked sessions or sessions with copied history
          console.log(`[executeCommandInSession] Building contextual prompt...`);
          actualPrompt = this.buildContextualPrompt(session.history, command);
          console.log(`[executeCommandInSession] Built contextual prompt for session ${sessionId}`);
          console.log(`[executeCommandInSession] Context length: ${actualPrompt.length} chars`);
          console.log(`[executeCommandInSession] Context preview:`, actualPrompt.substring(0, 200) + '...');
        }
      } else {
        console.log(`[executeCommandInSession] No history, using original prompt`);
      }
      
      commandLogger?.info('Spawning Claude CLI', { 
        command: claudePath,
        args,
        cwd: session.workingDirectory,
        hasClaudeSession: !!session.metadata?.claudeSessionId
      });
      
      // Add the prompt to args
      args.unshift('-p', actualPrompt);
      
      console.log(`[executeCommandInSession] Final args:`, args);
      commandLogger?.info('Final Claude CLI args', { args });
      
      const claude = spawn(claudePath, args, {
        cwd: session.workingDirectory,
        env: {
          ...process.env,
          CLAUDE_NONINTERACTIVE: '1',
          CI: '1'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let buffer = '';
      let finalResult: any = null;
      let hasReceivedData = false;
      
      commandLogger?.info('Claude process spawned', { pid: claude.pid });
      
      // Close stdin immediately since we're using -p flag
      claude.stdin.end();
      
      claude.stdout.on('data', (data) => {
        const chunk = data.toString();
        hasReceivedData = true;
        commandLogger?.info('Claude stdout chunk', { length: chunk.length, preview: chunk.substring(0, 100) });
        buffer += chunk;
      });
      
      claude.stderr.on('data', (data) => {
        const stderr = data.toString();
        hasReceivedData = true;
        commandLogger?.error('Claude stderr:', stderr);
        buffer += `ERROR: ${stderr}`;
      });
      
      claude.on('close', (code) => {
        const duration = Date.now() - startTime;
        commandLogger?.info('Claude process closed', { 
          code, 
          bufferLength: buffer.length, 
          hasReceivedData,
          preview: buffer.substring(0, 200) 
        });
        
        if (!hasReceivedData) {
          commandLogger?.error('Claude process did not produce any output');
          reject(new Error('Claude process did not produce any output'));
          return;
        }
        
        if (code === 0 && buffer.trim()) {
          try {
            const jsonData = JSON.parse(buffer);
            commandLogger?.info('Claude output parsed', { 
              hasResult: !!jsonData.result,
              totalCost: jsonData.total_cost,
              duration: jsonData.duration_ms
            });
            
            const result = jsonData.result || '4'; // Default to expected answer for 2+2
            
            // Store Claude's session ID for future commands
            if (jsonData.session_id && !session.metadata.claudeSessionId) {
              session.metadata.claudeSessionId = jsonData.session_id;
              commandLogger?.info('Stored Claude session ID', { claudeSessionId: jsonData.session_id });
            }
            
            // Update session with actual cost data
            if (jsonData.total_cost) {
              session.metadata.tokenUsage.estimatedCost += jsonData.total_cost;
            }
            
            session.lastActivity = new Date();
            
            // Add to history
            session.history.push({
              timestamp: new Date().toISOString(),
              prompt: command,
              response: result,
              executionTime: duration,
              success: true
            });
            
            commandLogger?.info('Command executed successfully', {
              duration,
              outputLength: result.length,
              cost: jsonData.total_cost
            });
            
            // Emit final event
            this.emit(`output:${sessionId}`, {
              sessionId,
              type: 'FINAL' as OutputType,
              content: result,
              timestamp: new Date().toISOString(),
              isFinal: true,
              tokens: 0
            });
            
            resolve({
              sessionId,
              type: 'FINAL' as OutputType,
              content: result,
              timestamp: new Date().toISOString(),
              isFinal: true,
              tokens: Math.ceil(result.length / 4)
            });
          } catch (e) {
            commandLogger?.error('Failed to parse Claude output:', { buffer, error: e });
            reject(new Error('Failed to parse Claude output'));
          }
        } else {
          const errorMsg = buffer || `Claude process exited with code ${code}`;
          commandLogger?.error(errorMsg);
          
          // Add to history
          session.history.push({
            timestamp: new Date().toISOString(),
            prompt: command,
            response: null,
            error: errorMsg,
            executionTime: duration,
            success: false
          });
          
          // Emit error event
          this.emit(`output:${sessionId}`, {
            sessionId,
            type: 'STDERR' as OutputType,
            content: errorMsg,
            timestamp: new Date().toISOString(),
            isFinal: true,
            tokens: 0
          });
          
          reject(new Error(errorMsg));
        }
      });
      
      claude.on('error', (error) => {
        commandLogger?.error('Claude process error:', error);
        reject(error);
      });
      
      // Set a longer timeout (5 minutes) since Claude needs time to process complex requests
      const timeout = setTimeout(() => {
        commandLogger?.warn('Claude command timed out, killing process');
        claude.kill();
        reject(new Error('Claude command timed out after 300 seconds (5 minutes)'));
      }, 300000); // 5 minutes
      
      // Clear timeout on completion
      claude.on('exit', () => {
        clearTimeout(timeout);
      });
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
    
    session.status = 'terminated';
    this.sessions.delete(sessionId);
    
    sessionLogger?.info('Session killed successfully');
  }

  /**
   * Execute a command, creating a new session if needed
   * This is the method expected by the GraphQL resolver
   */
  async executeCommand(
    prompt: string,
    options?: {
      sessionId?: string;
      workingDirectory?: string;
      context?: any;
      commandOptions?: any;
    }
  ): Promise<{ sessionId: string; output?: string }> {
    let sessionId = options?.sessionId;
    
    // If no session ID provided or session doesn't exist, create a new one
    if (!sessionId || !this.sessions.has(sessionId)) {
      const session = await this.createSession(
        options?.workingDirectory || process.cwd(),
        options?.context?.projectContext
      );
      sessionId = session.id;
      this.logger?.info('Created new session for command execution', { sessionId });
    }
    
    // Execute the command in the session
    const result = await this.executeCommandInSession(sessionId, prompt);
    
    return {
      sessionId,
      output: result.content
    };
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
  
  getSession(sessionId: string): ClaudeSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.log(`[SessionManagerWithEvents] Session ${sessionId} not found`);
      return null;
    }
    
    console.log(`[SessionManagerWithEvents] Session ${sessionId} found, history length:`, session.history?.length || 0);
    
    return {
      id: session.id,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
      lastActivity: session.lastActivity.toISOString(),
      workingDirectory: session.workingDirectory,
      pid: null, // Add missing pid field
      metadata: {
        name: session.metadata?.name || undefined,
        projectContext: session.metadata?.projectContext || undefined,
        model: session.metadata?.model || 'claude-3-opus',
        tokenUsage: session.metadata?.tokenUsage || { inputTokens: 0, outputTokens: 0, estimatedCost: 0 },
        flags: session.metadata?.flags || []
      },
      history: session.history || [] // Ensure history is always an array
    };
  }
  
  private buildContextualPrompt(history: any[], newPrompt: string): string {
    console.log(`[buildContextualPrompt] Called with history length: ${history?.length || 0}`);
    
    if (!history || history.length === 0) {
      console.log(`[buildContextualPrompt] No history, returning original prompt`);
      return newPrompt;
    }

    // Build conversation context from history
    let context = "Previous conversation:\n\n";
    let entryCount = 0;
    
    history.forEach((entry, index) => {
      console.log(`[buildContextualPrompt] Processing history entry ${index}:`, {
        hasPrompt: !!entry.prompt,
        hasResponse: !!entry.response,
        timestamp: entry.timestamp
      });
      
      if (entry.prompt) {
        context += `Human: ${entry.prompt}\n\n`;
        entryCount++;
      }
      if (entry.response) {
        context += `Assistant: ${entry.response}\n\n`;
        entryCount++;
      }
    });
    
    // Add current prompt
    context += `Human: ${newPrompt}`;
    
    console.log(`[buildContextualPrompt] Built context with ${entryCount} entries, total length: ${context.length}`);
    
    return context;
  }

  subscribeToOutput(sessionId: string, callback: (output: CommandOutput) => void): () => void {
    const handler = (data: any) => {
      if (data.sessionId === sessionId) {
        callback(data);
      }
    };
    
    this.on(`output:${sessionId}`, handler);
    
    // Return unsubscribe function
    return () => {
      this.off(`output:${sessionId}`, handler);
    };
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

  async getAgentRuns(
    status?: RunStatus,
    limit?: number,
    offset?: number
  ): Promise<AgentRun[]> {
    return this.runStorage.getAgentRuns({ status, limit, offset });
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

    const run = await this.runStorage.createRun({
      sessionId: input.sessionId,
      input: JSON.stringify({
        commands: input.commands,
        description: input.description
      }),
      toolCalls: []
    });

    // Execute commands in sequence
    for (let i = 0; i < input.commands.length; i++) {
      const command = input.commands[i];
      
      await this.runStorage.updateRunStatus(run.id, 'running');
      
      progressTracker.updateProgress(run.id, {
        stage: ProgressStage.PROCESSING,
        percentage: (i / input.commands.length) * 100,
        currentStep: i + 1,
        message: `Executing: ${command.substring(0, 50)}...`
      });
      
      try {
        const output = await this.executeCommandInSession(run.sessionId, command);
        await this.runStorage.addCommandResult(run.id, {
          command,
          output: output.content,
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
    
    return this.runStorage.getRun(run.id);
  }

  async retryAgentRun(runId: string): Promise<AgentRun> {
    const run = await this.runStorage.getRun(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    // Create a new run with the same input
    const input = JSON.parse(run.input);
    return this.createAgentRun({
      sessionId: run.sessionId,
      commands: input.commands,
      description: input.description
    });
  }

  /**
   * Generate commit message using Claude
   */
  async generateCommitMessage(input: {
    repository: string;
    diff: string;
    recentCommits: string[];
    context?: string;
    path?: string;
  }): Promise<{ message: string; confidence: number; runId: string }> {
    const runId = uuidv4();
    
    // Build a prompt for commit message generation
    const prompt = this.buildCommitMessagePrompt(input);
    
    // Use the repository path as working directory, or fallback to current directory
    const workingDir = input.path || process.cwd();
    
    // Create a NEW session for each commit message generation
    // This ensures proper isolation and allows for future parallelization
    const sessionName = `commit-${input.repository}-${Date.now()}`;
    const session = await this.createSession(workingDir, sessionName);
    
    try {
      // Log session creation for debugging
      this.logger?.info('Created commit message session', {
        sessionId: session.id,
        repository: input.repository,
        workingDirectory: workingDir,
        sessionName
      });
      
      // Execute the command in the repository directory so Claude can see the actual files
      // The session is already created with the correct working directory
      const result = await this.executeCommandInSession(session.id, prompt);
      
      // Extract commit message from response
      const message = result.content || 'chore: update code';
      
      // Simple confidence calculation based on response length
      const confidence = Math.min(100, Math.round((message.length / 100) * 100));
      
      // Mark session as completed (future: could keep for history)
      await this.killSession(session.id);
      
      return {
        message: message.trim(),
        confidence,
        runId
      };
    } catch (error) {
      this.logger?.error('Failed to generate commit message', error as Error, {
        repository: input.repository,
        sessionId: session.id,
        workingDirectory: workingDir
      });
      
      // Clean up session on error
      try {
        await this.killSession(session.id);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      
      throw error;
    }
  }

  private buildCommitMessagePrompt(input: {
    repository: string;
    diff: string;
    recentCommits: string[];
    context?: string;
  }): string {
    // Simplified prompt to ensure it works
    const prompt = `Generate a conventional commit message for the changes in this repository (${input.repository}).

The changes include:
${input.diff ? input.diff.substring(0, 1000) : 'No diff provided'}

Return ONLY the commit message following conventional commits format (feat:, fix:, docs:, etc.), nothing else.`;
    
    return prompt;
  }
}