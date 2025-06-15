// Mapper functions to transform database types to GraphQL types

import type { QualitySession } from '../types/index.js';

export function mapQualitySession(session: QualitySession): any {
  return {
    id: session.id,
    type: session.sessionType,
    startTime: session.startedAt.toISOString(),
    endTime: session.completedAt?.toISOString() || null,
    filesAnalyzed: session.totalFilesChecked,
    totalViolations: session.totalViolationsFound,
    averageScore: 0, // TODO: Calculate from metrics
    metadata: session.context ? {
      claudeSessionId: session.context['claudeSessionId'] || null,
      gitBranch: session.context['gitBranch'] || null,
      gitCommit: session.context['gitCommit'] || null,
      userId: session.context['userId'] || null
    } : null
  };
}