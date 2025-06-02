import { RunStorage } from '../../services/RunStorage.js';

// Initialize RunStorage singleton
const runStorage = new RunStorage();

export async function retryAgentRun(
  _parent: unknown,
  { runId }: { runId: string }
) {
  const run = await runStorage.retryRun(runId);
  return formatRunForGraphQL(run);
}

export async function cancelAgentRun(
  _parent: unknown,
  { runId }: { runId: string }
) {
  const run = await runStorage.cancelRun(runId);
  return formatRunForGraphQL(run);
}

export async function retryFailedRuns(
  _parent: unknown,
  { runIds }: { runIds: string[] }
) {
  const retriedRuns = [];
  
  for (const runId of runIds) {
    try {
      const run = await runStorage.retryRun(runId);
      retriedRuns.push(formatRunForGraphQL(run));
    } catch (error) {
      console.error(`Failed to retry run ${runId}:`, error);
    }
  }
  
  return retriedRuns;
}

export async function deleteOldRuns() {
  return await runStorage.deleteOldRuns();
}

// Helper to format dates for GraphQL
function formatRunForGraphQL(run: any) {
  return {
    ...run,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() || null,
  };
}