import type { GraphQLContext } from '../../graphql/context.js';

interface FileQualityArgs {
  path: string;
  sessionId?: string;
}

export async function fileQuality(
  _parent: unknown,
  args: FileQualityArgs,
  context: GraphQLContext
) {
  const { path } = args;
  const { engine } = context;

  try {
    // Get current file analysis
    const analysis = await engine.getFileAnalysis(path);
    
    if (!analysis.file) {
      return null;
    }

    // Map to GraphQL schema format
    return {
      path: analysis.file.path,
      hash: analysis.file.hash,
      score: analysis.score,
      violations: analysis.violations.map(v => ({
        id: `${v.rule}-${v.lineNumber}-${v.columnNumber}`,
        tool: v.toolType,
        rule: v.rule,
        severity: v.severity,
        message: v.message,
        line: v.lineNumber,
        column: v.columnNumber,
        endLine: v.endLine,
        endColumn: v.endColumn,
        fixable: v.autoFixable,
        suggestions: [] // TODO: Extract suggestions from message
      })),
      lastChecked: analysis.file.updatedAt || new Date().toISOString(),
      trends: null // TODO: Implement trend loading
    };
  } catch (error) {
    console.error('Error getting file quality:', error);
    throw new Error('Failed to get file quality');
  }
}