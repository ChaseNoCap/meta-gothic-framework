import { TimescaleQualityEngine } from '../core/quality-engine.js';
import { logger } from '../utils/logger.js';
import type { Config } from '../types/index.js';

interface MCPSession {
  id: string;
  qualitySessionId: string;
  claudeSessionId?: string | undefined;
  activeFiles: Set<string>;
  lastActivity: Date;
  metadata: Record<string, any>;
}

export class MCPSessionManager {
  private sessions: Map<string, MCPSession> = new Map();
  private engine: TimescaleQualityEngine;
  private config: Config;
  private cleanupInterval: NodeJS.Timeout;

  constructor(engine: TimescaleQualityEngine, config: Config) {
    this.engine = engine;
    this.config = config;

    // Cleanup inactive sessions every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, 60000);
  }

  async createSession(sessionId: string, claudeSessionId?: string): Promise<MCPSession> {
    // Create quality session in database
    const qualitySession = await this.engine.createSession('INTERACTIVE', {
      claudeSessionId,
      source: 'mcp',
    });

    const mcpSession: MCPSession = {
      id: sessionId,
      qualitySessionId: qualitySession.id,
      claudeSessionId,
      activeFiles: new Set(),
      lastActivity: new Date(),
      metadata: {},
    };

    this.sessions.set(sessionId, mcpSession);

    logger.info('MCP session created', {
      sessionId,
      qualitySessionId: qualitySession.id,
      claudeSessionId,
    });

    return mcpSession;
  }

  async getOrCreateSession(sessionId: string, claudeSessionId?: string): Promise<MCPSession> {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      session = await this.createSession(sessionId, claudeSessionId);
    } else {
      // Update last activity
      session.lastActivity = new Date();
      
      // Update Claude session ID if provided and different
      if (claudeSessionId && claudeSessionId !== session.claudeSessionId) {
        session.claudeSessionId = claudeSessionId;
        
        // Update in database
        await this.engine.updateSessionMetadata(session.qualitySessionId, {
          claudeSessionId,
        });
      }
    }

    return session;
  }

  getSession(sessionId: string): MCPSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
    return session;
  }

  async trackFileActivity(sessionId: string, filePath: string): Promise<void> {
    const session = await this.getOrCreateSession(sessionId);
    session.activeFiles.add(filePath);
    
    // Record activity in database
    await this.engine.recordSessionActivityPublic(session.qualitySessionId, 'FILE_ACCESSED', {
      filePath,
    });
  }

  async getActiveFiles(sessionId: string): Promise<string[]> {
    const session = this.sessions.get(sessionId);
    return session ? Array.from(session.activeFiles) : [];
  }

  async updateMetadata(sessionId: string, metadata: Record<string, any>): Promise<void> {
    const session = await this.getOrCreateSession(sessionId);
    Object.assign(session.metadata, metadata);
    
    // Update in database
    await this.engine.updateSessionMetadata(session.qualitySessionId, metadata);
  }

  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // End quality session in database
    await this.engine.endSession(session.qualitySessionId);

    // Remove from active sessions
    this.sessions.delete(sessionId);

    logger.info('MCP session ended', {
      sessionId,
      qualitySessionId: session.qualitySessionId,
      filesAnalyzed: session.activeFiles.size,
    });
  }

  private async cleanupInactiveSessions(): Promise<void> {
    const now = new Date();
    const timeout = this.config.mcp?.sessionTimeout || 3600000; // 1 hour default

    for (const [sessionId, session] of this.sessions.entries()) {
      const inactiveTime = now.getTime() - session.lastActivity.getTime();
      
      if (inactiveTime > timeout) {
        logger.info('Cleaning up inactive MCP session', {
          sessionId,
          inactiveMinutes: Math.round(inactiveTime / 60000),
        });
        
        await this.endSession(sessionId);
      }
    }
  }

  async getAllSessions(): Promise<MCPSession[]> {
    return Array.from(this.sessions.values());
  }

  async getSessionsByClaudeId(claudeSessionId: string): Promise<MCPSession[]> {
    return Array.from(this.sessions.values()).filter(
      session => session.claudeSessionId === claudeSessionId
    );
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}