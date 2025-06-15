import type { GraphQLContext } from '../../graphql/context.js';

interface QualityTrendsArgs {
  path?: string;
  startTime: string;
  endTime: string;
  bucketSize?: string;
}

export async function qualityTrends(
  _parent: unknown,
  args: QualityTrendsArgs,
  context: GraphQLContext
) {
  const { path, startTime, endTime, bucketSize = '1h' } = args;
  const { engine } = context;

  try {
    const trends = await engine.getQualityTrends(
      path || '*', // Use wildcard for all files
      {
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        bucketSize
      }
    );

    // Calculate summary statistics
    const totalViolations = trends.reduce((sum, t) => sum + (t.violationCount || 0), 0);
    const avgScore = trends.length > 0 
      ? trends.reduce((sum, t) => sum + (t.averageScore || 0), 0) / trends.length 
      : 0;
    
    // Determine trend direction
    let trendDirection = 'STABLE' as const;
    if (trends.length >= 2) {
      const firstScore = trends[0].averageScore || 0;
      const lastScore = trends[trends.length - 1].averageScore || 0;
      const improvement = ((lastScore - firstScore) / firstScore) * 100;
      
      if (improvement > 5) trendDirection = 'IMPROVING';
      else if (improvement < -5) trendDirection = 'DECLINING';
    }

    return {
      path,
      buckets: trends.map(t => ({
        time: t.bucketTime.toISOString(),
        averageScore: t.averageScore || 0,
        violationCount: t.violationCount || 0,
        filesAnalyzed: t.filesAnalyzed || 0
      })),
      summary: {
        improvement: trends.length >= 2 
          ? ((trends[trends.length - 1].averageScore || 0) - (trends[0].averageScore || 0)) 
          : 0,
        totalViolations,
        averageScore: avgScore,
        trend: trendDirection
      }
    };
  } catch (error) {
    console.error('Error getting quality trends:', error);
    throw new Error('Failed to get quality trends');
  }
}