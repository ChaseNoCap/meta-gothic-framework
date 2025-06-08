import { executeCommand } from './executeCommand.js';
import { continueSession } from './continueSession.js';
import { killSession } from './killSession.js';
import { createHandoff } from './createHandoff.js';
import { generateCommitMessages } from './generateCommitMessages.js';
import { 
  forkSession, 
  createSessionTemplate, 
  createSessionFromTemplate,
  batchSessionOperation,
  archiveSession,
  shareSession
} from './sessionManagement.js';
import { claimPreWarmedSession } from './claimPreWarmedSession.js';

export const resolvers = {
  executeCommand,
  continueSession,
  killSession,
  createHandoff,
  generateCommitMessages,
  forkSession,
  createSessionTemplate,
  createSessionFromTemplate,
  batchSessionOperation,
  archiveSession,
  shareSession,
  claimPreWarmedSession
};