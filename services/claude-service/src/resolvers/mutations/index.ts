import { executeCommand } from './executeCommand.js';
import { continueSession } from './continueSession.js';
import { killSession } from './killSession.js';
import { createHandoff } from './createHandoff.js';
import { generateCommitMessages } from './generateCommitMessages.js';
import { generateExecutiveSummary } from './generateExecutiveSummary.js';
import { retryAgentRun, cancelAgentRun, retryFailedRuns, deleteOldRuns } from './agentRuns.js';

export const resolvers = {
  executeCommand,
  continueSession,
  killSession,
  createHandoff,
  generateCommitMessages,
  generateExecutiveSummary,
  retryAgentRun,
  cancelAgentRun,
  retryFailedRuns,
  deleteOldRuns
};