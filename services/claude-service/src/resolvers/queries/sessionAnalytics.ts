import { Context } from '../../types/context.js';
import { intelligentResumption } from '../../services/IntelligentResumption.js';

// Calculate session analytics
export async function sessionAnalytics(
  _parent: unknown,
  { sessionId }: { sessionId: string },
  context: Context
) {
  const session = context.sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // Calculate token usage
  const tokenUsage = calculateTokenUsage(session);
  
  // Calculate time analytics
  const timeAnalytics = calculateTimeAnalytics(session);
  
  // Calculate content analytics
  const contentAnalytics = calculateContentAnalytics(session);
  
  // Calculate cost breakdown
  const costBreakdown = calculateCostBreakdown(session, tokenUsage);

  return {
    sessionId,
    messageCount: session.history.length,
    tokenUsage,
    timeAnalytics,
    contentAnalytics,
    costBreakdown
  };
}

// Batch analytics for multiple sessions
export async function batchSessionAnalytics(
  _parent: unknown,
  { sessionIds }: { sessionIds: string[] },
  context: Context
) {
  return sessionIds.map(sessionId => {
    try {
      return sessionAnalytics(_parent, { sessionId }, context);
    } catch (error) {
      // Return minimal analytics for failed sessions
      return {
        sessionId,
        messageCount: 0,
        tokenUsage: {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          averageTokensPerMessage: 0
        },
        costBreakdown: {
          totalCost: 0,
          projectedMonthlyCost: 0
        }
      };
    }
  });
}

// Get session templates
export async function sessionTemplates(
  _parent: unknown,
  { tags, limit = 20 }: { tags?: string[]; limit?: number },
  context: Context
) {
  if (!context.sessionManager.templates) {
    return [];
  }

  let templates = Array.from(context.sessionManager.templates.values());
  
  // Filter by tags if provided
  if (tags && tags.length > 0) {
    templates = templates.filter(template =>
      tags.some(tag => template.tags.includes(tag))
    );
  }

  // Sort by usage count and limit
  templates.sort((a, b) => b.usageCount - a.usageCount);
  return templates.slice(0, limit);
}

// Get specific template
export async function sessionTemplate(
  _parent: unknown,
  { id }: { id: string },
  context: Context
) {
  return context.sessionManager.templates?.get(id) || null;
}

// Get session resumption data
export async function sessionResumption(
  _parent: unknown,
  { sessionId }: { sessionId: string },
  context: Context
) {
  const session = context.sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  intelligentResumption.analyzeSessionForResumption(session);
  return intelligentResumption.createResumptionSummary(sessionId);
}

// Get resumable sessions
export async function resumableSessions(
  _parent: unknown,
  { limit = 5 }: { limit?: number },
  context: Context
) {
  const sessions = context.sessionManager.getActiveSessions();
  
  // Filter and sort sessions by last activity
  const recentSessions = sessions
    .filter(session => session.status !== 'TERMINATED' && session.history.length > 0)
    .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
    .slice(0, limit);

  // Analyze each session for resumption
  return recentSessions.map(session => {
    const analysisContext = intelligentResumption.analyzeSessionForResumption(session);
    const resumptionData = intelligentResumption.generateResumptionStrategy(session.id);
    
    return {
      session,
      resumptionData: {
        sessionId: session.id,
        lastActivity: session.lastActivity,
        summary: resumptionData.summary,
        priority: resumptionData.priority.toUpperCase(), // Convert to uppercase for GraphQL enum
        suggestedPrompt: resumptionData.suggestedPrompt || null,
        openTasks: analysisContext.openTasks || [],
        unresolvedErrors: analysisContext.unresolvedErrors?.length || 0,
        currentFiles: analysisContext.currentFiles || []
      }
    };
  });
}

// Helper functions

function calculateTokenUsage(session: any) {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const usageOverTime = [];

  session.history.forEach((item: any, index: number) => {
    // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
    const inputTokens = Math.ceil((item.prompt?.length || 0) / 4);
    const outputTokens = Math.ceil((item.response?.length || 0) / 4);
    
    totalInputTokens += inputTokens;
    totalOutputTokens += outputTokens;
    
    usageOverTime.push({
      timestamp: item.timestamp,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens
    });
  });

  const messageCount = session.history.length || 1;
  const averageTokensPerMessage = (totalInputTokens + totalOutputTokens) / messageCount;

  return {
    totalInputTokens,
    totalOutputTokens,
    averageTokensPerMessage,
    usageOverTime
  };
}

function calculateTimeAnalytics(session: any) {
  if (session.history.length === 0) {
    return {
      totalDuration: 0,
      averageResponseTime: 0,
      longestPause: 0,
      activityByHour: []
    };
  }

  const timestamps = session.history.map((item: any) => new Date(item.timestamp));
  const firstMessage = timestamps[0];
  const lastMessage = timestamps[timestamps.length - 1];
  const totalDuration = lastMessage.getTime() - firstMessage.getTime();

  // Calculate response times
  const responseTimes = [];
  let longestPause = 0;
  
  for (let i = 1; i < timestamps.length; i++) {
    const timeDiff = timestamps[i].getTime() - timestamps[i-1].getTime();
    responseTimes.push(timeDiff);
    if (timeDiff > longestPause) {
      longestPause = timeDiff;
    }
  }

  const averageResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;

  // Activity by hour
  const hourCounts = new Array(24).fill(0);
  timestamps.forEach((timestamp: Date) => {
    hourCounts[timestamp.getHours()]++;
  });

  const activityByHour = hourCounts.map((count, hour) => ({
    hour,
    messageCount: count
  })).filter(item => item.messageCount > 0);

  return {
    totalDuration,
    averageResponseTime,
    longestPause,
    activityByHour
  };
}

function calculateContentAnalytics(session: any) {
  const topics = new Map<string, number>();
  const codeLanguages = new Map<string, { lines: number; snippets: number }>();
  const fileTypes = new Map<string, { files: number; mods: number }>();
  
  // Analyze message content
  session.history.forEach((item: any) => {
    const content = (item.prompt || '') + ' ' + (item.response || '');
    
    // Extract topics (simple keyword extraction)
    const keywords = ['api', 'database', 'frontend', 'backend', 'testing', 'deployment', 
                     'security', 'performance', 'bug', 'feature', 'refactor', 'documentation'];
    
    keywords.forEach(keyword => {
      const count = (content.toLowerCase().match(new RegExp(keyword, 'g')) || []).length;
      if (count > 0) {
        topics.set(keyword, (topics.get(keyword) || 0) + count);
      }
    });

    // Detect code languages
    const codeBlockRegex = /```(\w+)\n([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const lang = match[1];
      const code = match[2];
      const lines = code.split('\n').length;
      
      const existing = codeLanguages.get(lang) || { lines: 0, snippets: 0 };
      codeLanguages.set(lang, {
        lines: existing.lines + lines,
        snippets: existing.snippets + 1
      });
    }

    // Detect file types
    const fileRegex = /\b(\w+)\.(ts|tsx|js|jsx|json|yaml|yml|md|css|scss|html)\b/g;
    while ((match = fileRegex.exec(content)) !== null) {
      const ext = match[2];
      const existing = fileTypes.get(ext) || { files: 0, mods: 0 };
      fileTypes.set(ext, {
        files: existing.files + 1,
        mods: existing.mods + 1
      });
    }
  });

  // Convert maps to arrays and sort
  const topTopics = Array.from(topics.entries())
    .map(([name, count]) => ({ name, count, relevance: count / session.history.length }))
    .sort((a, b) => b.count - a.count);

  const codeLanguagesList = Array.from(codeLanguages.entries())
    .map(([language, data]) => ({
      language,
      linesOfCode: data.lines,
      snippetCount: data.snippets
    }))
    .sort((a, b) => b.linesOfCode - a.linesOfCode);

  const fileTypesList = Array.from(fileTypes.entries())
    .map(([extension, data]) => ({
      extension,
      fileCount: data.files,
      modificationCount: data.mods
    }))
    .sort((a, b) => b.fileCount - a.fileCount);

  // Calculate complexity score (0-10)
  const complexityScore = Math.min(10, 
    (topTopics.length * 0.5) + 
    (codeLanguagesList.length * 1) + 
    (fileTypesList.length * 0.3)
  );

  return {
    topTopics,
    codeLanguages: codeLanguagesList,
    fileTypes: fileTypesList,
    complexityScore
  };
}

function calculateCostBreakdown(session: any, tokenUsage: any) {
  // Pricing estimates (example rates)
  const COST_PER_1K_INPUT_TOKENS = 0.003;
  const COST_PER_1K_OUTPUT_TOKENS = 0.015;
  
  const inputCost = (tokenUsage.totalInputTokens / 1000) * COST_PER_1K_INPUT_TOKENS;
  const outputCost = (tokenUsage.totalOutputTokens / 1000) * COST_PER_1K_OUTPUT_TOKENS;
  const totalCost = inputCost + outputCost;

  // Calculate projected monthly cost
  const sessionDuration = session.history.length > 0
    ? new Date(session.lastActivity).getTime() - new Date(session.createdAt).getTime()
    : 1;
  
  const hoursElapsed = sessionDuration / (1000 * 60 * 60) || 1;
  const costPerHour = totalCost / hoursElapsed;
  const projectedMonthlyCost = costPerHour * 24 * 30; // Assuming similar usage pattern

  // Generate optimization suggestions
  const optimizationSuggestions = [];
  
  if (tokenUsage.averageTokensPerMessage > 1000) {
    optimizationSuggestions.push('Consider more concise prompts to reduce token usage');
  }
  
  if (outputCost > inputCost * 2) {
    optimizationSuggestions.push('Response length is high - consider requesting summaries');
  }
  
  if (projectedMonthlyCost > 100) {
    optimizationSuggestions.push('High projected costs - review usage patterns');
  }

  const costByModel = [{
    model: session.metadata.model || 'claude-3-opus',
    cost: totalCost,
    tokenCount: tokenUsage.totalInputTokens + tokenUsage.totalOutputTokens
  }];

  return {
    totalCost,
    costByModel,
    projectedMonthlyCost,
    optimizationSuggestions
  };
}