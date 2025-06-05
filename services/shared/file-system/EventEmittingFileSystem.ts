import type { IFileSystem, FileSystemError, IFileStats } from '@chasenocap/file-system';
import type { IEventBus } from '@chasenocap/event-system';
import type { ILogger } from '@chasenocap/logger';

export class EventEmittingFileSystem implements IFileSystem {
  constructor(
    private baseFileSystem: IFileSystem,
    private eventBus?: IEventBus,
    private logger?: ILogger,
    private correlationId?: string
  ) {}

  private emit(type: string, payload: any) {
    if (this.eventBus) {
      this.eventBus.emit({
        type: `file.${type}`,
        timestamp: Date.now(),
        payload: {
          ...payload,
          correlationId: this.correlationId
        }
      });
    }
  }

  async readFile(filePath: string): Promise<string> {
    const startTime = Date.now();
    this.logger?.debug(`Reading file: ${filePath}`);
    
    try {
      const content = await this.baseFileSystem.readFile(filePath);
      const duration = Date.now() - startTime;
      
      this.emit('read.completed', {
        path: filePath,
        size: content.length,
        duration
      });
      
      this.logger?.debug(`File read completed: ${filePath} (${content.length} bytes, ${duration}ms)`);
      return content;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.emit('read.failed', {
        path: filePath,
        error: (error as Error).message,
        duration
      });
      
      this.logger?.error(`Failed to read file: ${filePath}`, error as Error);
      throw error;
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const startTime = Date.now();
    this.logger?.debug(`Writing file: ${filePath} (${content.length} bytes)`);
    
    try {
      await this.baseFileSystem.writeFile(filePath, content);
      const duration = Date.now() - startTime;
      
      this.emit('write.completed', {
        path: filePath,
        size: content.length,
        duration
      });
      
      this.logger?.debug(`File write completed: ${filePath} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.emit('write.failed', {
        path: filePath,
        size: content.length,
        error: (error as Error).message,
        duration
      });
      
      this.logger?.error(`Failed to write file: ${filePath}`, error as Error);
      throw error;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    const startTime = Date.now();
    this.logger?.debug(`Deleting file: ${filePath}`);
    
    try {
      await this.baseFileSystem.deleteFile(filePath);
      const duration = Date.now() - startTime;
      
      this.emit('delete.completed', {
        path: filePath,
        duration
      });
      
      this.logger?.debug(`File deleted: ${filePath} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.emit('delete.failed', {
        path: filePath,
        error: (error as Error).message,
        duration
      });
      
      this.logger?.error(`Failed to delete file: ${filePath}`, error as Error);
      throw error;
    }
  }

  async exists(path: string): Promise<boolean> {
    const startTime = Date.now();
    this.logger?.trace(`Checking existence: ${path}`);
    
    try {
      const result = await this.baseFileSystem.exists(path);
      const duration = Date.now() - startTime;
      
      this.emit('exists.checked', {
        path,
        exists: result,
        duration
      });
      
      return result;
    } catch (error) {
      this.logger?.error(`Failed to check existence: ${path}`, error as Error);
      throw error;
    }
  }

  async createDirectory(dirPath: string): Promise<void> {
    const startTime = Date.now();
    this.logger?.debug(`Creating directory: ${dirPath}`);
    
    try {
      await this.baseFileSystem.createDirectory(dirPath);
      const duration = Date.now() - startTime;
      
      this.emit('directory.created', {
        path: dirPath,
        duration
      });
      
      this.logger?.debug(`Directory created: ${dirPath} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.emit('directory.create.failed', {
        path: dirPath,
        error: (error as Error).message,
        duration
      });
      
      this.logger?.error(`Failed to create directory: ${dirPath}`, error as Error);
      throw error;
    }
  }

  async removeDirectory(dirPath: string): Promise<void> {
    const startTime = Date.now();
    this.logger?.debug(`Removing directory: ${dirPath}`);
    
    try {
      await this.baseFileSystem.removeDirectory(dirPath);
      const duration = Date.now() - startTime;
      
      this.emit('directory.removed', {
        path: dirPath,
        duration
      });
      
      this.logger?.debug(`Directory removed: ${dirPath} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.emit('directory.remove.failed', {
        path: dirPath,
        error: (error as Error).message,
        duration
      });
      
      this.logger?.error(`Failed to remove directory: ${dirPath}`, error as Error);
      throw error;
    }
  }

  async listDirectory(dirPath: string): Promise<string[]> {
    const startTime = Date.now();
    this.logger?.debug(`Listing directory: ${dirPath}`);
    
    try {
      const entries = await this.baseFileSystem.listDirectory(dirPath);
      const duration = Date.now() - startTime;
      
      this.emit('directory.listed', {
        path: dirPath,
        entryCount: entries.length,
        duration
      });
      
      this.logger?.debug(`Directory listed: ${dirPath} (${entries.length} entries, ${duration}ms)`);
      return entries;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.emit('directory.list.failed', {
        path: dirPath,
        error: (error as Error).message,
        duration
      });
      
      this.logger?.error(`Failed to list directory: ${dirPath}`, error as Error);
      throw error;
    }
  }

  async getStats(path: string): Promise<IFileStats> {
    const startTime = Date.now();
    this.logger?.trace(`Getting stats: ${path}`);
    
    try {
      const stats = await this.baseFileSystem.getStats(path);
      const duration = Date.now() - startTime;
      
      this.emit('stats.retrieved', {
        path,
        stats,
        duration
      });
      
      return stats;
    } catch (error) {
      this.logger?.error(`Failed to get stats: ${path}`, error as Error);
      throw error;
    }
  }

  async isFile(path: string): Promise<boolean> {
    return this.baseFileSystem.isFile(path);
  }

  async isDirectory(path: string): Promise<boolean> {
    return this.baseFileSystem.isDirectory(path);
  }

  // Path operations (no events needed)
  join(...paths: string[]): string {
    return this.baseFileSystem.join(...paths);
  }

  resolve(...paths: string[]): string {
    return this.baseFileSystem.resolve(...paths);
  }

  dirname(path: string): string {
    return this.baseFileSystem.dirname(path);
  }

  basename(path: string, ext?: string): string {
    return this.baseFileSystem.basename(path, ext);
  }

  relative(from: string, to: string): string {
    return this.baseFileSystem.relative(from, to);
  }

  normalize(path: string): string {
    return this.baseFileSystem.normalize(path);
  }
}