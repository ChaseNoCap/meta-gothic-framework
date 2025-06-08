import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { ClaudeSessionManagerWithEvents } from './ClaudeSessionManagerWithEvents.js';
import type { ILogger } from '@chasenocap/logger';

interface PreWarmedSession {
  sessionId: string;
  claudeSessionId?: string;
  createdAt: Date;
  status: 'warming' | 'ready' | 'claimed';
}

interface PreWarmSettings {
  poolSize: number;
  maxSessionAge: number;
  cleanupInterval: number;
  warmupCommand: string;
  warmupTimeout: number;
}

export class PreWarmSessionManager extends EventEmitter {
  private preWarmedSessions: Map<string, PreWarmedSession> = new Map();
  private sessionManager: ClaudeSessionManagerWithEvents;
  private logger?: ILogger;
  private isWarming = false;
  private settings: PreWarmSettings;
  private cleanupTimer?: NodeJS.Timer;
  
  constructor(
    sessionManager: ClaudeSessionManagerWithEvents, 
    settings?: Partial<PreWarmSettings>,
    logger?: ILogger
  ) {
    super();
    this.sessionManager = sessionManager;
    this.logger = logger;
    this.settings = {
      poolSize: settings?.poolSize || 1,
      maxSessionAge: settings?.maxSessionAge || 300000, // 5 minutes
      cleanupInterval: settings?.cleanupInterval || 60000, // 1 minute
      warmupCommand: settings?.warmupCommand || "Hello! Please respond with 'Session ready' to confirm initialization.",
      warmupTimeout: settings?.warmupTimeout || 30000 // 30 seconds
    };
  }

  /**
   * Initialize pre-warming on service startup
   */
  async initialize() {
    this.logger?.info('Initializing pre-warm session manager', { 
      poolSize: this.settings.poolSize,
      maxSessionAge: this.settings.maxSessionAge,
      cleanupInterval: this.settings.cleanupInterval
    });
    
    // Create initial pool of sessions
    const promises = [];
    for (let i = 0; i < this.settings.poolSize; i++) {
      promises.push(this.createPreWarmedSession());
    }
    await Promise.allSettled(promises);
  }

  /**
   * Create a new pre-warmed session
   */
  private async createPreWarmedSession() {
    if (this.isWarming) {
      this.logger?.debug('Already warming a session, skipping');
      return;
    }

    this.isWarming = true;
    const sessionId = uuidv4();
    
    this.logger?.info(`Starting pre-warm for session: ${sessionId}`);
    
    const session: PreWarmedSession = {
      sessionId,
      createdAt: new Date(),
      status: 'warming'
    };
    
    this.preWarmedSessions.set(sessionId, session);
    
    // Emit SSE event that warming has started
    this.emit('prewarm:status', {
      status: 'warming',
      sessionId,
      timestamp: new Date().toISOString()
    });

    try {
      this.logger?.info(`Creating pre-warmed session: ${sessionId}`);
      
      // Execute a minimal command to initialize the session
      this.logger?.debug(`Executing pre-warm command for session: ${sessionId}`);
      const result = await this.sessionManager.executeCommand(
        this.settings.warmupCommand,
        { 
          sessionId,
          workingDirectory: process.cwd()
        }
      );
      this.logger?.debug(`Pre-warm command executed for session: ${sessionId}`);

      // Parse the Claude session ID from the result with timeout
      try {
        this.logger?.debug(`Waiting for pre-warm output for session: ${sessionId}`);
        const output = await Promise.race([
          result.output,
          new Promise<string>((_, reject) => 
            setTimeout(() => reject(new Error('Pre-warm timeout')), this.settings.warmupTimeout)
          )
        ]);
        this.logger?.debug(`Pre-warm output received for session: ${sessionId}`, { output });
        
        const jsonData = JSON.parse(output);
        if (jsonData.session_id) {
          session.claudeSessionId = jsonData.session_id;
          this.logger?.info(`Pre-warm session Claude ID stored: ${jsonData.session_id}`);
        }
      } catch (e) {
        this.logger?.warn('Failed to parse Claude session ID from pre-warm response', { error: e });
      }

      session.status = 'ready';
      
      // Emit SSE event that session is ready
      this.emit('prewarm:status', {
        status: 'ready',
        sessionId,
        timestamp: new Date().toISOString()
      });
      
      this.logger?.info(`✅ Pre-warmed session ready: ${sessionId}`);
    } catch (error) {
      this.logger?.error(`Failed to create pre-warmed session: ${error}`);
      this.preWarmedSessions.delete(sessionId);
      
      // Emit SSE event that warming failed
      this.emit('prewarm:status', {
        status: 'failed',
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Get current pre-warm status
   */
  getStatus(): { available: boolean; sessionId?: string; status: string } {
    const readySession = Array.from(this.preWarmedSessions.values())
      .find(s => s.status === 'ready');
    
    if (readySession) {
      return {
        available: true,
        sessionId: readySession.sessionId,
        status: 'ready'
      };
    }

    const warmingSession = Array.from(this.preWarmedSessions.values())
      .find(s => s.status === 'warming');
    
    if (warmingSession) {
      return {
        available: false,
        sessionId: warmingSession.sessionId,
        status: 'warming'
      };
    }

    return {
      available: false,
      status: 'none'
    };
  }

  /**
   * Claim a pre-warmed session for use
   */
  async claimSession(): Promise<string | null> {
    const readySession = Array.from(this.preWarmedSessions.values())
      .find(s => s.status === 'ready');
    
    if (!readySession) {
      this.logger?.debug('No pre-warmed session available');
      return null;
    }

    readySession.status = 'claimed';
    
    // Emit SSE event that session was claimed
    this.emit('prewarm:status', {
      status: 'claimed',
      sessionId: readySession.sessionId,
      timestamp: new Date().toISOString()
    });

    this.logger?.info(`🎯 Pre-warmed session claimed: ${readySession.sessionId}`);
    
    // Remove from pre-warmed pool after a short delay
    setTimeout(() => {
      this.preWarmedSessions.delete(readySession.sessionId);
      this.logger?.debug(`Removed claimed session from pool: ${readySession.sessionId}`);
    }, 1000);

    // Immediately start warming new sessions to maintain pool size
    setImmediate(() => {
      const readySessions = Array.from(this.preWarmedSessions.values())
        .filter(s => s.status === 'ready').length;
      const warmingSessions = Array.from(this.preWarmedSessions.values())
        .filter(s => s.status === 'warming').length;
      
      const currentPoolSize = readySessions + warmingSessions;
      
      if (currentPoolSize < this.settings.poolSize) {
        this.logger?.info(`🔥 Starting new pre-warm session after claim to maintain pool size`);
        this.createPreWarmedSession();
      }
    });

    return readySession.sessionId;
  }

  /**
   * Clean up old pre-warmed sessions
   */
  private cleanupOldSessions() {
    const now = Date.now();

    for (const [sessionId, session] of this.preWarmedSessions.entries()) {
      if (session.status === 'ready' && 
          now - session.createdAt.getTime() > this.settings.maxSessionAge) {
        this.logger?.info(`Cleaning up old pre-warmed session: ${sessionId}`);
        this.preWarmedSessions.delete(sessionId);
        
        // Terminate the session in the session manager
        this.sessionManager.killSession(sessionId);
      }
    }
  }

  /**
   * Start periodic cleanup
   */
  startCleanupInterval() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldSessions();
      
      // Ensure we maintain the configured pool size
      const readySessions = Array.from(this.preWarmedSessions.values())
        .filter(s => s.status === 'ready').length;
      const warmingSessions = Array.from(this.preWarmedSessions.values())
        .filter(s => s.status === 'warming').length;
      
      const currentPoolSize = readySessions + warmingSessions;
      
      if (currentPoolSize < this.settings.poolSize) {
        const sessionsToCreate = this.settings.poolSize - currentPoolSize;
        this.logger?.info(`Replenishing pre-warm pool: creating ${sessionsToCreate} sessions`);
        
        for (let i = 0; i < sessionsToCreate; i++) {
          this.createPreWarmedSession();
        }
      }
    }, this.settings.cleanupInterval);
  }
  
  /**
   * Stop the cleanup interval
   */
  stopCleanupInterval() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }
  
  /**
   * Get metrics about the pre-warm pool
   */
  getMetrics() {
    const sessions = Array.from(this.preWarmedSessions.values());
    const ready = sessions.filter(s => s.status === 'ready').length;
    const warming = sessions.filter(s => s.status === 'warming').length;
    const claimed = sessions.filter(s => s.status === 'claimed').length;
    
    return {
      configured: {
        poolSize: this.settings.poolSize,
        maxSessionAge: this.settings.maxSessionAge,
        cleanupInterval: this.settings.cleanupInterval,
        warmupTimeout: this.settings.warmupTimeout
      },
      current: {
        total: sessions.length,
        ready,
        warming,
        claimed,
        isWarming: this.isWarming
      },
      sessions: sessions.map(s => ({
        sessionId: s.sessionId,
        claudeSessionId: s.claudeSessionId,
        status: s.status,
        age: Date.now() - s.createdAt.getTime(),
        createdAt: s.createdAt.toISOString()
      }))
    };
  }
}