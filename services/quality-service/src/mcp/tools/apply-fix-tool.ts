import { BaseTool, ToolSchema } from './base-tool.js';
import { logger } from '../../utils/logger.js';

export class ApplyFixTool extends BaseTool {
  get name(): string {
    return 'apply_quality_fix';
  }

  get description(): string {
    return 'Applies automatic fixes for code quality violations. Supports ESLint auto-fix, Prettier formatting, and other tool-specific fixes.';
  }

  get inputSchema(): ToolSchema {
    return {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'The absolute path to the file to fix',
        },
        sessionId: {
          type: 'string',
          description: 'The MCP session ID for tracking',
        },
        toolType: {
          type: 'string',
          description: 'Specific tool to use for fixes (optional, applies all if not specified)',
          enum: ['eslint', 'prettier', 'typescript', 'all'],
        },
        dryRun: {
          type: 'boolean',
          description: 'If true, reports what would be fixed without making changes',
          default: false,
        },
      },
      required: ['filePath', 'sessionId'],
    };
  }

  async execute(args: {
    filePath: string;
    sessionId: string;
    toolType?: string;
    dryRun?: boolean;
  }): Promise<any> {
    const { filePath, sessionId, toolType = 'all', dryRun = false } = args;

    try {
      // Track activity
      await this.sessionManager.trackFileActivity(sessionId, filePath);

      // Get current state before fixes
      const beforeAnalysis = await this.engine.getFileAnalysis(filePath);
      const beforeScore = beforeAnalysis.score;
      const beforeViolations = beforeAnalysis.violations.length;
      const autoFixable = beforeAnalysis.violations.filter(v => v.autoFixable).length;

      if (dryRun) {
        // Just report what would be fixed
        const fixableByTool: Record<string, number> = {};
        beforeAnalysis.violations
          .filter(v => v.autoFixable)
          .forEach(v => {
            if (toolType === 'all' || v.toolType === toolType) {
              fixableByTool[v.toolType] = (fixableByTool[v.toolType] || 0) + 1;
            }
          });

        logger.info('Dry run fix analysis', {
          filePath,
          sessionId,
          fixableByTool,
          totalFixable: Object.values(fixableByTool).reduce((a, b) => a + b, 0),
        });

        return {
          content: [
            {
              type: 'text',
              text: `Dry run analysis for ${filePath}:\n\n` +
                    `Current quality score: ${beforeScore.toFixed(1)}/100\n` +
                    `Total violations: ${beforeViolations}\n` +
                    `Auto-fixable violations: ${autoFixable}\n\n` +
                    `Fixable by tool:\n${JSON.stringify(fixableByTool, null, 2)}\n\n` +
                    `Run without dryRun=true to apply these fixes.`,
            },
          ],
          metadata: {
            dryRun: true,
            beforeScore,
            beforeViolations,
            fixableByTool,
          },
        };
      }

      // Apply fixes
      logger.info('Applying quality fixes', {
        filePath,
        sessionId,
        toolType,
        autoFixable,
      });

      const fixResult = await this.engine.applyAutoFix(
        filePath,
        toolType === 'all' ? undefined : toolType
      );

      // Get state after fixes
      const afterAnalysis = await this.engine.getFileAnalysis(filePath);
      const afterScore = afterAnalysis.score;
      const afterViolations = afterAnalysis.violations.length;

      // Calculate improvements
      const improvements = {
        scoreImprovement: afterScore - beforeScore,
        violationsFixed: beforeViolations - afterViolations,
        percentageImprovement: beforeViolations > 0 
          ? ((beforeViolations - afterViolations) / beforeViolations * 100).toFixed(1)
          : '0',
      };

      // Update session metadata with fix results
      await this.sessionManager.updateMetadata(sessionId, {
        lastFix: {
          filePath,
          timestamp: new Date().toISOString(),
          violationsFixed: fixResult.fixedCount,
          toolType,
        },
      });

      logger.info('Quality fixes applied', {
        filePath,
        sessionId,
        fixed: fixResult.fixed,
        fixedCount: fixResult.fixedCount,
        improvements,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Applied quality fixes to ${filePath}:\n\n` +
                  `✅ Fixed ${fixResult.fixedCount} violations\n\n` +
                  `Before:\n` +
                  `- Quality Score: ${beforeScore.toFixed(1)}/100\n` +
                  `- Violations: ${beforeViolations}\n\n` +
                  `After:\n` +
                  `- Quality Score: ${afterScore.toFixed(1)}/100\n` +
                  `- Violations: ${afterViolations}\n\n` +
                  `Improvement: ${improvements.scoreImprovement.toFixed(1)} points (${improvements.percentageImprovement}% reduction in violations)\n\n` +
                  `${fixResult.remainingViolations.length > 0 
                    ? `Remaining violations require manual fixes:\n${this.formatRemainingViolations(fixResult.remainingViolations.slice(0, 5))}`
                    : 'All auto-fixable violations have been resolved! 🎉'}`,
          },
        ],
        metadata: {
          fixed: fixResult.fixed,
          fixedCount: fixResult.fixedCount,
          beforeState: {
            score: beforeScore,
            violations: beforeViolations,
          },
          afterState: {
            score: afterScore,
            violations: afterViolations,
          },
          improvements,
          remainingViolations: fixResult.remainingViolations.length,
        },
      };
    } catch (error) {
      logger.error('Failed to apply fixes', {
        error: error instanceof Error ? error.message : error,
        filePath,
        sessionId,
        toolType,
      });
      
      throw error;
    }
  }

  private formatRemainingViolations(violations: any[]): string {
    return violations.map(v => 
      `- [${v.severity}] ${v.rule}: ${v.message} (line ${v.lineNumber})`
    ).join('\n');
  }
}