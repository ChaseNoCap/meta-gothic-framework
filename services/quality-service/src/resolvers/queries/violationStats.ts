import type { GraphQLContext } from '../../graphql/context.js';

interface ViolationStatsArgs {
  sessionId?: string;
  severity?: string;
  tool?: string;
}

export async function violationStats(
  _parent: unknown,
  args: ViolationStatsArgs,
  context: GraphQLContext
) {
  const { sessionId, severity, tool } = args;
  const { engine } = context;

  try {
    const stats = await engine.getViolationStats({
      ...(sessionId && { sessionId }),
      ...(severity && { severity }),
      ...(tool && { tool })
    });

    return {
      total: stats.total,
      bySeverity: stats.bySeverity.map((item: any) => ({
        severity: item.severity,
        count: item.count
      })),
      byTool: stats.byTool.map((item: any) => ({
        tool: item.tool,
        count: item.count
      })),
      topRules: stats.topRules.map((item: any) => ({
        rule: item.rule,
        count: item.count,
        tool: item.tool
      })),
      fixableCount: stats.fixableCount
    };
  } catch (error) {
    console.error('Error getting violation stats:', error);
    throw new Error('Failed to get violation statistics');
  }
}