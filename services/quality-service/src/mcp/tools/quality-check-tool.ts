import { BaseTool, ToolSchema } from './base-tool.js';
import { logger } from '../../utils/logger.js';

export class QualityCheckTool extends BaseTool {
  get name(): string {
    return 'quality_check_interactive';
  }

  get description(): string {
    return 'Performs real-time quality analysis on a file during Claude editing sessions. Returns violations, quality score, and actionable suggestions.';
  }

  get inputSchema(): ToolSchema {
    return {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'The absolute path to the file to analyze',
        },
        sessionId: {
          type: 'string',
          description: 'The MCP session ID for tracking',
        },
        claudeSessionId: {
          type: 'string',
          description: 'Optional Claude session ID for correlation',
        },
        includeFixable: {
          type: 'boolean',
          description: 'Whether to highlight auto-fixable violations',
          default: true,
        },
      },
      required: ['filePath', 'sessionId'],
    };
  }

  async execute(args: {
    filePath: string;
    sessionId: string;
    claudeSessionId?: string;
    includeFixable?: boolean;
  }): Promise<any> {
    const { filePath, sessionId, claudeSessionId, includeFixable = true } = args;

    try {
      // Get or create MCP session
      const mcpSession = await this.sessionManager.getOrCreateSession(sessionId, claudeSessionId);
      
      // Track file activity
      await this.sessionManager.trackFileActivity(sessionId, filePath);

      // Analyze the file
      logger.info('Running quality check', { filePath, sessionId });
      
      // First, process the file to ensure we have latest data
      await this.engine.processFile(filePath, {
        sessionType: 'INTERACTIVE',
        triggeredBy: 'mcp_tool',
      });

      // Get detailed analysis
      const analysis = await this.engine.getFileAnalysis(filePath);
      
      // Get suggestions
      const suggestions = await this.engine.getSuggestionsForFile(filePath);

      // Format violations for readability
      const formattedViolations = analysis.violations.map(v => ({
        rule: v.rule,
        severity: v.severity,
        message: v.message,
        location: `${v.lineNumber}:${v.columnNumber}`,
        tool: v.toolType,
        fixable: includeFixable ? v.autoFixable : undefined,
      }));

      // Calculate summary stats
      const summary = {
        totalViolations: analysis.violations.length,
        byTool: {} as Record<string, number>,
        bySeverity: {} as Record<string, number>,
        autoFixable: 0,
      };

      analysis.violations.forEach(v => {
        summary.byTool[v.toolType] = (summary.byTool[v.toolType] || 0) + 1;
        summary.bySeverity[v.severity] = (summary.bySeverity[v.severity] || 0) + 1;
        if (v.autoFixable) summary.autoFixable++;
      });

      return {
        content: [
          {
            type: 'text',
            text: `Quality analysis for ${filePath}:\n\n` +
                  `Quality Score: ${analysis.score.toFixed(1)}/100\n` +
                  `Total Violations: ${summary.totalViolations}\n` +
                  `Auto-fixable: ${summary.autoFixable}\n\n` +
                  `By Tool: ${JSON.stringify(summary.byTool, null, 2)}\n` +
                  `By Severity: ${JSON.stringify(summary.bySeverity, null, 2)}\n\n` +
                  `Suggestions:\n${suggestions.suggestions.map(s => `- ${s}`).join('\n')}`,
          },
        ],
        metadata: {
          qualityScore: analysis.score,
          violations: formattedViolations,
          summary,
          suggestions: suggestions.suggestions,
          sessionId: mcpSession.qualitySessionId,
        },
      };
    } catch (error) {
      logger.error('Quality check failed', {
        error: error instanceof Error ? error.message : error,
        filePath,
        sessionId,
      });
      
      throw error;
    }
  }
}