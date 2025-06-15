import type { GraphQLContext } from '../../graphql/context.js';

interface RunQualityCheckInput {
  paths: string[];
  tools?: string[];
  fix?: boolean;
  sessionId?: string;
}

export async function runQualityCheck(
  _parent: unknown,
  args: { input: RunQualityCheckInput },
  context: GraphQLContext
) {
  const { paths, tools, fix = false, sessionId } = args.input;
  const { engine } = context;

  try {
    // Create or use existing session
    const session = sessionId 
      ? await engine.getSession(sessionId)
      : await engine.createSession('MANUAL', { tools });

    if (!session) {
      throw new Error('Failed to create or find session');
    }

    const results = [];
    let totalViolations = 0;
    let totalFixed = 0;

    // Process each file
    for (const path of paths) {
      const startTime = Date.now();
      
      // Analyze file
      const result = await engine.processFile(path, {
        sessionType: 'MANUAL',
        sessionId: session.id,
        triggeredBy: 'graphql'
      });

      // Apply fixes if requested
      if (fix && result.violations.some(v => v.autoFixable)) {
        const fixResult = await engine.applyAutoFix(path, tools?.[0]);
        if (fixResult.fixed) {
          totalFixed += fixResult.fixedCount;
        }
      }

      const analysis = await engine.getFileAnalysis(path);
      
      results.push({
        path: analysis.file?.path || path,
        hash: analysis.file?.hash || '',
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
          suggestions: []
        })),
        lastChecked: new Date().toISOString(),
        trends: null
      });

      totalViolations += analysis.violations.length;
    }

    // Complete the session
    await engine.completeSession(session.id, 'completed');

    return {
      sessionId: session.id,
      filesChecked: paths.length,
      results,
      summary: {
        totalViolations,
        fixableViolations: totalFixed,
        averageScore: results.reduce((sum, r) => sum + r.score, 0) / results.length,
        duration: Date.now() - session.startTime.getTime()
      }
    };
  } catch (error) {
    console.error('Error running quality check:', error);
    throw new Error('Failed to run quality check');
  }
}