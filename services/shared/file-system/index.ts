import { Container } from 'inversify';
import { NodeFileSystem } from '@chasenocap/file-system';
import type { IFileSystem } from '@chasenocap/file-system';
import type { IEventBus } from '@chasenocap/event-system';
import type { ILogger } from '@chasenocap/logger';
import { EventEmittingFileSystem } from './EventEmittingFileSystem.js';

// Shared container for file system
const fileSystemContainer = new Container();

// Bind the NodeFileSystem implementation
fileSystemContainer.bind<IFileSystem>('IFileSystem').to(NodeFileSystem).inSingletonScope();

// Default file system instance (without events)
let defaultFileSystem: IFileSystem | null = null;

// Export a function to get the file system instance
export function getFileSystem(options?: {
  eventBus?: IEventBus;
  logger?: ILogger;
  correlationId?: string;
}): IFileSystem {
  if (!options?.eventBus && !options?.logger) {
    // Return cached default instance for simple cases
    if (!defaultFileSystem) {
      defaultFileSystem = fileSystemContainer.get<IFileSystem>('IFileSystem');
    }
    return defaultFileSystem;
  }
  
  // Return event-emitting wrapper when event bus or logger is provided
  const baseFileSystem = fileSystemContainer.get<IFileSystem>('IFileSystem');
  return new EventEmittingFileSystem(
    baseFileSystem,
    options.eventBus,
    options.logger,
    options.correlationId
  );
}

// Export the interface for convenience
export type { IFileSystem } from '@chasenocap/file-system';
export { EventEmittingFileSystem } from './EventEmittingFileSystem.js';