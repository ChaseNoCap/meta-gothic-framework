import type { ILogger } from '@chasenocap/logger';
import { smartContextManager } from './SmartContextManager.js';

interface ResumptionContext {
  sessionId: string;
  lastActivity: Date;
  lastMessages: any[];
  openTasks: string[];
  unresolvedErrors: any[];
  currentFiles: string[];
  sessionGoals: string[];
}

interface ResumptionStrategy {
  summary: string;
  contextMessages: any[];
  suggestedPrompt?: string;
  priority: 'high' | 'medium' | 'low';
}

export class IntelligentResumptionService {
  private logger?: ILogger;
  private resumptionCache: Map<string, ResumptionContext> = new Map();

  constructor(logger?: ILogger) {
    this.logger = logger;
  }

  /**
   * Analyze session for intelligent resumption
   */
  analyzeSessionForResumption(session: any): ResumptionContext {
    const context: ResumptionContext = {
      sessionId: session.id,
      lastActivity: new Date(session.lastActivity),
      lastMessages: session.history.slice(-10),
      openTasks: this.extractOpenTasks(session.history),
      unresolvedErrors: this.extractUnresolvedErrors(session.history),
      currentFiles: this.extractCurrentFiles(session.history),
      sessionGoals: this.extractSessionGoals(session.history)
    };

    this.resumptionCache.set(session.id, context);
    return context;
  }

  /**
   * Generate resumption strategy
   */
  generateResumptionStrategy(sessionId: string): ResumptionStrategy {
    const context = this.resumptionCache.get(sessionId);
    if (!context) {
      return {
        summary: 'No previous context found',
        contextMessages: [],
        priority: 'low'
      };
    }

    // Calculate time since last activity
    const hoursSinceActivity = (Date.now() - context.lastActivity.getTime()) / (1000 * 60 * 60);
    
    // Determine priority based on various factors
    let priority: 'high' | 'medium' | 'low' = 'medium';
    if (context.unresolvedErrors.length > 0) {
      priority = 'high';
    } else if (hoursSinceActivity < 1) {
      priority = 'high';
    } else if (hoursSinceActivity > 24) {
      priority = 'low';
    }

    // Build summary
    const summaryParts: string[] = [];
    
    if (hoursSinceActivity < 1) {
      summaryParts.push('Continuing from recent conversation');
    } else if (hoursSinceActivity < 24) {
      summaryParts.push(`Resuming after ${Math.round(hoursSinceActivity)} hours`);
    } else {
      summaryParts.push(`Resuming after ${Math.round(hoursSinceActivity / 24)} days`);
    }

    if (context.openTasks.length > 0) {
      summaryParts.push(`${context.openTasks.length} open tasks`);
    }

    if (context.unresolvedErrors.length > 0) {
      summaryParts.push(`${context.unresolvedErrors.length} unresolved errors`);
    }

    if (context.currentFiles.length > 0) {
      summaryParts.push(`Working on ${context.currentFiles.length} files`);
    }

    // Generate suggested prompt
    let suggestedPrompt: string | undefined;
    
    if (context.unresolvedErrors.length > 0) {
      const lastError = context.unresolvedErrors[context.unresolvedErrors.length - 1];
      suggestedPrompt = `Let's continue fixing the error: ${lastError.message}`;
    } else if (context.openTasks.length > 0) {
      suggestedPrompt = `Let's continue with: ${context.openTasks[0]}`;
    } else if (context.sessionGoals.length > 0) {
      suggestedPrompt = `Shall we continue working on ${context.sessionGoals[0]}?`;
    }

    // Optimize context messages
    const optimizedContext = smartContextManager.optimizeContext(
      sessionId,
      context.lastMessages,
      4000 // Smaller context for resumption
    );

    return {
      summary: summaryParts.join(', '),
      contextMessages: optimizedContext,
      suggestedPrompt,
      priority
    };
  }

  /**
   * Extract open tasks from conversation
   */
  private extractOpenTasks(history: any[]): string[] {
    const tasks: string[] = [];
    const taskPatterns = [
      /(?:TODO|FIXME|TASK):\s*(.+)/gi,
      /(?:need to|should|must|have to)\s+(.+)/gi,
      /(?:next|then)\s+(?:we'll|we will|I'll|I will)\s+(.+)/gi
    ];

    history.slice(-20).forEach(message => {
      if (message.type === 'assistant') {
        taskPatterns.forEach(pattern => {
          const matches = message.content?.matchAll(pattern) || [];
          for (const match of matches) {
            if (match[1] && match[1].length < 100) {
              tasks.push(match[1].trim());
            }
          }
        });
      }
    });

    // Remove duplicates and limit to 5 most recent
    return [...new Set(tasks)].slice(-5);
  }

  /**
   * Extract unresolved errors
   */
  private extractUnresolvedErrors(history: any[]): any[] {
    const errors: any[] = [];
    let lastErrorIndex = -1;
    let lastSuccessIndex = -1;

    history.forEach((message, index) => {
      if (message.type === 'error' || 
          message.content?.toLowerCase().includes('error') ||
          message.content?.toLowerCase().includes('failed')) {
        lastErrorIndex = index;
        errors.push({
          message: message.content,
          index,
          timestamp: message.timestamp
        });
      }
      
      if (message.content?.toLowerCase().includes('success') ||
          message.content?.toLowerCase().includes('fixed') ||
          message.content?.toLowerCase().includes('resolved')) {
        lastSuccessIndex = index;
      }
    });

    // Only return errors that haven't been resolved
    return errors.filter(error => error.index > lastSuccessIndex);
  }

  /**
   * Extract files being worked on
   */
  private extractCurrentFiles(history: any[]): string[] {
    const files = new Set<string>();
    const filePattern = /(?:\/[\w\-./]+\/)?[\w\-]+\.(?:ts|tsx|js|jsx|json|yaml|yml|md|css|scss|html)/g;

    history.slice(-10).forEach(message => {
      const matches = message.content?.matchAll(filePattern) || [];
      for (const match of matches) {
        files.add(match[0]);
      }
    });

    return Array.from(files).slice(-10);
  }

  /**
   * Extract session goals
   */
  private extractSessionGoals(history: any[]): string[] {
    const goals: string[] = [];
    const goalPatterns = [
      /(?:goal|objective|aim|trying to|want to)\s*(?:is|:)?\s*(.+)/gi,
      /(?:implement|create|build|fix|update)\s+(.+)/gi
    ];

    // Look at early messages for goals
    history.slice(0, 5).forEach(message => {
      if (message.type === 'user') {
        goalPatterns.forEach(pattern => {
          const matches = message.content?.matchAll(pattern) || [];
          for (const match of matches) {
            if (match[1] && match[1].length < 100) {
              goals.push(match[1].trim());
            }
          }
        });
      }
    });

    return [...new Set(goals)].slice(0, 3);
  }

  /**
   * Create resumption summary for UI
   */
  createResumptionSummary(sessionId: string): any {
    const context = this.resumptionCache.get(sessionId);
    const strategy = this.generateResumptionStrategy(sessionId);

    return {
      sessionId,
      lastActivity: context?.lastActivity,
      summary: strategy.summary,
      priority: strategy.priority,
      suggestedPrompt: strategy.suggestedPrompt,
      openTasks: context?.openTasks || [],
      unresolvedErrors: context?.unresolvedErrors.length || 0,
      currentFiles: context?.currentFiles || [],
      contextOptimization: smartContextManager.getContextSummary(sessionId)
    };
  }
}

// Export singleton instance
export const intelligentResumption = new IntelligentResumptionService();