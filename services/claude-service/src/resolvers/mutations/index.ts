import { executeCommand } from './executeCommand.js';
import { continueSession } from './continueSession.js';
import { killSession } from './killSession.js';
import { createHandoff } from './createHandoff.js';
import { generateCommitMessages } from './generateCommitMessages.js';
import { generateExecutiveSummary } from './generateExecutiveSummary.js';

export const resolvers = {
  executeCommand,
  continueSession,
  killSession,
  createHandoff,
  generateCommitMessages,
  generateExecutiveSummary
};