import { EventEmitter } from 'eventemitter3';
import type { ILogger } from '@chasenocap/logger';

interface ContextWindow {
  maxTokens: number;
  currentTokens: number;
  messages: any[];
  importance: Map<string, number>;
}

interface ContextStrategy {
  name: string;
  priority: number;
  shouldInclude: (message: any, context: ContextWindow) => boolean;
  calculateImportance: (message: any) => number;
}

export class SmartContextManager extends EventEmitter {
  private strategies: ContextStrategy[] = [];
  private logger?: ILogger;
  private contextCache: Map<string, ContextWindow> = new Map();
  
  constructor(logger?: ILogger) {
    super();
    this.logger = logger;
    this.initializeStrategies();
  }

  private initializeStrategies() {
    // Recent messages strategy
    this.strategies.push({
      name: 'recent',
      priority: 1,
      shouldInclude: (message, context) => {
        const messageIndex = context.messages.indexOf(message);
        const recencyThreshold = Math.min(5, context.messages.length);
        return messageIndex >= context.messages.length - recencyThreshold;
      },
      calculateImportance: (message) => {
        const age = Date.now() - new Date(message.timestamp).getTime();
        const hoursSinceMessage = age / (1000 * 60 * 60);
        return Math.max(0, 10 - hoursSinceMessage);
      }
    });

    // Error context strategy
    this.strategies.push({
      name: 'error-context',
      priority: 3,
      shouldInclude: (message) => {
        return message.type === 'error' || 
               message.content?.toLowerCase().includes('error') ||
               message.content?.toLowerCase().includes('failed');
      },
      calculateImportance: () => 8
    });

    // Code context strategy
    this.strategies.push({
      name: 'code-context',
      priority: 2,
      shouldInclude: (message) => {
        return message.content?.includes('```') || 
               message.metadata?.hasCode;
      },
      calculateImportance: (message) => {
        const codeBlocks = (message.content?.match(/```/g) || []).length / 2;
        return Math.min(10, 5 + codeBlocks * 2);
      }
    });

    // Decision points strategy
    this.strategies.push({
      name: 'decision-points',
      priority: 2,
      shouldInclude: (message) => {
        const decisionKeywords = ['should i', 'which', 'option', 'choice', 'decide', 'recommend'];
        const content = message.content?.toLowerCase() || '';
        return decisionKeywords.some(keyword => content.includes(keyword));
      },
      calculateImportance: () => 7
    });

    // File modification strategy
    this.strategies.push({
      name: 'file-modifications',
      priority: 2,
      shouldInclude: (message) => {
        const filePatterns = /\b\w+\.(ts|tsx|js|jsx|json|yaml|yml|md)\b/;
        return filePatterns.test(message.content || '');
      },
      calculateImportance: (message) => {
        const fileCount = (message.content?.match(/\b\w+\.\w+\b/g) || []).length;
        return Math.min(9, 5 + fileCount);
      }
    });
  }

  /**
   * Optimize context for a session
   */
  optimizeContext(sessionId: string, messages: any[], maxTokens: number = 8000): any[] {
    // Estimate tokens (rough: 1 token ≈ 4 characters)
    const estimateTokens = (text: string) => Math.ceil((text?.length || 0) / 4);
    
    // Create context window
    const context: ContextWindow = {
      maxTokens,
      currentTokens: 0,
      messages: messages,
      importance: new Map()
    };

    // Calculate importance for each message
    messages.forEach(message => {
      let totalImportance = 0;
      let applicableStrategies = 0;

      this.strategies.forEach(strategy => {
        if (strategy.shouldInclude(message, context)) {
          totalImportance += strategy.calculateImportance(message) * strategy.priority;
          applicableStrategies++;
        }
      });

      const avgImportance = applicableStrategies > 0 
        ? totalImportance / applicableStrategies 
        : 1;
      
      context.importance.set(message.id, avgImportance);
    });

    // Sort messages by importance (keeping chronological order as tiebreaker)
    const sortedMessages = [...messages].sort((a, b) => {
      const importanceA = context.importance.get(a.id) || 0;
      const importanceB = context.importance.get(b.id) || 0;
      
      if (Math.abs(importanceA - importanceB) < 0.5) {
        // Keep chronological order for similar importance
        return messages.indexOf(a) - messages.indexOf(b);
      }
      
      return importanceB - importanceA;
    });

    // Build optimized context
    const optimizedMessages: any[] = [];
    let currentTokenCount = 0;

    // Always include the first and last few messages
    const alwaysInclude = [
      ...messages.slice(0, 2),
      ...messages.slice(-3)
    ];

    // Add always-include messages first
    alwaysInclude.forEach(msg => {
      const tokens = estimateTokens(msg.content);
      if (currentTokenCount + tokens <= maxTokens) {
        optimizedMessages.push(msg);
        currentTokenCount += tokens;
      }
    });

    // Add remaining messages by importance
    sortedMessages.forEach(message => {
      if (!optimizedMessages.includes(message)) {
        const tokens = estimateTokens(message.content);
        if (currentTokenCount + tokens <= maxTokens) {
          optimizedMessages.push(message);
          currentTokenCount += tokens;
        }
      }
    });

    // Sort back to chronological order
    optimizedMessages.sort((a, b) => 
      messages.indexOf(a) - messages.indexOf(b)
    );

    // Cache the optimized context
    this.contextCache.set(sessionId, {
      ...context,
      messages: optimizedMessages,
      currentTokens: currentTokenCount
    });

    this.logger?.info('Context optimized', {
      sessionId,
      originalMessages: messages.length,
      optimizedMessages: optimizedMessages.length,
      tokenUsage: `${currentTokenCount}/${maxTokens}`,
      compressionRatio: (1 - optimizedMessages.length / messages.length) * 100
    });

    return optimizedMessages;
  }

  /**
   * Get context summary for a session
   */
  getContextSummary(sessionId: string): any {
    const cached = this.contextCache.get(sessionId);
    if (!cached) return null;

    const importanceStats = Array.from(cached.importance.values());
    const avgImportance = importanceStats.reduce((a, b) => a + b, 0) / importanceStats.length;

    return {
      totalMessages: cached.messages.length,
      tokenUsage: cached.currentTokens,
      maxTokens: cached.maxTokens,
      utilizationPercent: (cached.currentTokens / cached.maxTokens) * 100,
      averageImportance: avgImportance,
      strategies: this.strategies.map(s => s.name)
    };
  }

  /**
   * Suggest context optimization
   */
  suggestOptimization(messages: any[]): string[] {
    const suggestions: string[] = [];
    
    // Check for redundant messages
    const contentHashes = new Set();
    let duplicates = 0;
    
    messages.forEach(msg => {
      const hash = this.simpleHash(msg.content);
      if (contentHashes.has(hash)) {
        duplicates++;
      }
      contentHashes.add(hash);
    });

    if (duplicates > 2) {
      suggestions.push(`Remove ${duplicates} duplicate or near-duplicate messages`);
    }

    // Check for long code blocks
    const longCodeBlocks = messages.filter(msg => {
      const codeMatches = msg.content?.match(/```[\s\S]*?```/g) || [];
      return codeMatches.some((block: string) => block.length > 1000);
    });

    if (longCodeBlocks.length > 0) {
      suggestions.push('Consider summarizing or linking to long code blocks');
    }

    // Check message density
    const avgMessageLength = messages.reduce((sum, msg) => 
      sum + (msg.content?.length || 0), 0
    ) / messages.length;

    if (avgMessageLength > 2000) {
      suggestions.push('Messages are quite long - consider more concise communication');
    }

    // Check for old context
    const oldMessages = messages.filter(msg => {
      const age = Date.now() - new Date(msg.timestamp).getTime();
      const daysSince = age / (1000 * 60 * 60 * 24);
      return daysSince > 7;
    });

    if (oldMessages.length > messages.length * 0.3) {
      suggestions.push('Over 30% of context is older than a week - consider archiving');
    }

    return suggestions;
  }

  /**
   * Simple hash function for content comparison
   */
  private simpleHash(str: string): number {
    let hash = 0;
    if (!str) return hash;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash;
  }
}

// Export singleton instance
export const smartContextManager = new SmartContextManager();