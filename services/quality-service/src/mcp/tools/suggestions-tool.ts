import { BaseTool, ToolSchema } from './base-tool.js';
import { logger } from '../../utils/logger.js';

export class SuggestionsTool extends BaseTool {
  get name(): string {
    return 'get_quality_suggestions';
  }

  get description(): string {
    return 'Provides intelligent code quality improvement suggestions based on violation patterns, including priority fixes and configuration recommendations.';
  }

  get inputSchema(): ToolSchema {
    return {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'The absolute path to the file to get suggestions for',
        },
        sessionId: {
          type: 'string',
          description: 'The MCP session ID for tracking',
        },
        violationType: {
          type: 'string',
          description: 'Optional: Focus suggestions on specific violation types (eslint, prettier, typescript)',
          enum: ['eslint', 'prettier', 'typescript'],
        },
        maxSuggestions: {
          type: 'integer',
          description: 'Maximum number of suggestions to return',
          default: 10,
        },
      },
      required: ['filePath', 'sessionId'],
    };
  }

  async execute(args: {
    filePath: string;
    sessionId: string;
    violationType?: string;
    maxSuggestions?: number;
  }): Promise<any> {
    const { filePath, sessionId, violationType, maxSuggestions = 10 } = args;

    try {
      // Track activity
      await this.sessionManager.trackFileActivity(sessionId, filePath);

      // Get suggestions
      const suggestions = await this.engine.getSuggestionsForFile(filePath);
      
      // Get violation patterns for more intelligent suggestions
      const patterns = await this.engine.getViolationPatterns(filePath, 7);
      
      // Build prioritized suggestions
      const prioritizedSuggestions: Array<{
        priority: 'high' | 'medium' | 'low';
        suggestion: string;
        impact: string;
        action?: string;
      }> = [];

      // High priority: Auto-fixable violations
      if (suggestions.autoFixableCount > 0) {
        prioritizedSuggestions.push({
          priority: 'high',
          suggestion: `Fix ${suggestions.autoFixableCount} auto-fixable violations automatically`,
          impact: `Immediately improves code quality with no manual effort`,
          action: 'Run apply_quality_fix tool',
        });
      }

      // High priority: Recurring patterns
      patterns.forEach(pattern => {
        if (pattern.frequency > 5) {
          prioritizedSuggestions.push({
            priority: 'high',
            suggestion: `Address recurring violation: "${pattern.rule}" (${pattern.frequency} occurrences)`,
            impact: `Fixing this pattern will significantly reduce violations`,
            ...(pattern.toolType === 'eslint' && { action: 'Consider adjusting ESLint configuration' }),
          });
        }
      });

      // Medium priority: Tool-specific suggestions
      suggestions.suggestions.forEach(s => {
        if (s.includes('ESLint') || s.includes('Prettier') || s.includes('TypeScript')) {
          prioritizedSuggestions.push({
            priority: 'medium',
            suggestion: s,
            impact: 'Improves code consistency and maintainability',
          });
        }
      });

      // Low priority: General suggestions
      suggestions.suggestions.forEach(s => {
        if (!prioritizedSuggestions.some(ps => ps.suggestion === s)) {
          prioritizedSuggestions.push({
            priority: 'low',
            suggestion: s,
            impact: 'General code quality improvement',
          });
        }
      });

      // Filter by violation type if specified
      let filteredSuggestions = prioritizedSuggestions;
      if (violationType) {
        filteredSuggestions = prioritizedSuggestions.filter(s => 
          s.suggestion.toLowerCase().includes(violationType)
        );
      }

      // Limit suggestions
      const finalSuggestions = filteredSuggestions.slice(0, maxSuggestions);

      // Group by priority
      const groupedSuggestions = {
        high: finalSuggestions.filter(s => s.priority === 'high'),
        medium: finalSuggestions.filter(s => s.priority === 'medium'),
        low: finalSuggestions.filter(s => s.priority === 'low'),
      };

      logger.info('Generated quality suggestions', {
        filePath,
        sessionId,
        totalSuggestions: finalSuggestions.length,
        highPriority: groupedSuggestions.high.length,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Quality improvement suggestions for ${filePath}:\n\n` +
                  `${this.formatSuggestionGroup('High Priority', groupedSuggestions.high)}\n` +
                  `${this.formatSuggestionGroup('Medium Priority', groupedSuggestions.medium)}\n` +
                  `${this.formatSuggestionGroup('Low Priority', groupedSuggestions.low)}`,
          },
        ],
        metadata: {
          suggestions: finalSuggestions,
          violationSummary: {
            total: suggestions.violations.length,
            autoFixable: suggestions.autoFixableCount,
          },
          patterns: patterns.slice(0, 5),
        },
      };
    } catch (error) {
      logger.error('Failed to generate suggestions', {
        error: error instanceof Error ? error.message : error,
        filePath,
        sessionId,
      });
      
      throw error;
    }
  }

  private formatSuggestionGroup(
    title: string, 
    suggestions: Array<{ suggestion: string; impact: string; action?: string }>
  ): string {
    if (suggestions.length === 0) return '';
    
    let text = `${title}:\n`;
    suggestions.forEach((s, i) => {
      text += `${i + 1}. ${s.suggestion}\n`;
      text += `   Impact: ${s.impact}\n`;
      if (s.action) {
        text += `   Action: ${s.action}\n`;
      }
      text += '\n';
    });
    
    return text;
  }
}