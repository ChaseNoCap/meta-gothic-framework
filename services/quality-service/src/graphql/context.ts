import type { IncomingMessage } from 'node:http';
import { TimescaleQualityEngine } from '../core/quality-engine.js';
import DataLoader from 'dataloader';
import type { FileQuality, QualitySession, Violation } from '../types/index.js';

export interface GraphQLContext {
  engine: TimescaleQualityEngine;
  request: IncomingMessage;
  dataloaders: {
    fileQuality: DataLoader<string, FileQuality | null>;
    session: DataLoader<string, QualitySession | null>;
    fileViolations: DataLoader<string, Violation[]>;
  };
}

export function createContext(
  engine: TimescaleQualityEngine, 
  request: IncomingMessage
): GraphQLContext {
  // Create DataLoaders for efficient batching
  const fileQualityLoader = new DataLoader<string, FileQuality | null>(
    async (paths) => {
      const results = await Promise.all(
        paths.map(path => engine.getFileQuality(path))
      );
      return results;
    },
    { cache: false } // Disable caching as data changes frequently
  );

  const sessionLoader = new DataLoader<string, QualitySession | null>(
    async (sessionIds) => {
      const results = await Promise.all(
        sessionIds.map(id => engine.getSession(id))
      );
      return results;
    },
    { cache: true }
  );

  const fileViolationsLoader = new DataLoader<string, Violation[]>(
    async (paths) => {
      const results = await Promise.all(
        paths.map(path => engine.getFileViolations(path))
      );
      return results;
    },
    { cache: false }
  );

  return {
    engine,
    request,
    dataloaders: {
      fileQuality: fileQualityLoader,
      session: sessionLoader,
      fileViolations: fileViolationsLoader
    }
  };
}