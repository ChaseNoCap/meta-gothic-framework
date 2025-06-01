import { RunStorage, RunStatus } from '../../src/services/RunStorage';

// Initialize RunStorage singleton
const runStorage = new RunStorage();

export async function agentRun(_parent: unknown, { id }: { id: string }) {
  const run = await runStorage.getRun(id);
  if (!run) return null;
  
  return formatRunForGraphQL(run);
}

export async function agentRuns(
  _parent: unknown,
  args: {
    status?: RunStatus;
    repository?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }
) {
  const options = {
    status: args.status,
    startDate: args.startDate ? new Date(args.startDate) : undefined,
    endDate: args.endDate ? new Date(args.endDate) : undefined,
    limit: args.limit,
    offset: args.offset,
  };

  const result = await runStorage.getAllRuns(options);
  
  // Filter by repository if specified
  let runs = result.runs;
  if (args.repository) {
    runs = runs.filter(run => run.repository === args.repository);
  }

  return {
    runs: runs.map(formatRunForGraphQL),
    total: result.total,
  };
}

export async function repositoryRuns(
  _parent: unknown,
  { repository }: { repository: string }
) {
  const runs = await runStorage.getRunsByRepository(repository);
  return runs.map(formatRunForGraphQL);
}

export async function runStatistics() {
  const stats = await runStorage.getRunStatistics();
  
  return {
    ...stats,
    byRepository: Object.entries(stats.byRepository).map(([repository, count]) => ({
      repository,
      count,
    })),
    byStatus: {
      QUEUED: stats.byStatus[RunStatus.QUEUED] || 0,
      RUNNING: stats.byStatus[RunStatus.RUNNING] || 0,
      SUCCESS: stats.byStatus[RunStatus.SUCCESS] || 0,
      FAILED: stats.byStatus[RunStatus.FAILED] || 0,
      CANCELLED: stats.byStatus[RunStatus.CANCELLED] || 0,
      RETRYING: stats.byStatus[RunStatus.RETRYING] || 0,
    },
  };
}

// Helper to format dates for GraphQL
function formatRunForGraphQL(run: any) {
  return {
    ...run,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() || null,
  };
}