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

  async getActiveSessions(): Promise<ClaudeSession[]> {
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