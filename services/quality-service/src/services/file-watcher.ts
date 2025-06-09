import { watch, FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import path from 'path';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import type { TimescaleQualityEngine } from '../core/quality-engine';
import type { ProcessingContext } from '../types/index';

export interface FileWatcherConfig {
  paths: string[];
  excludePatterns?: string[];
  debounceDelay?: number;
  fileExtensions?: string[];
  followSymlinks?: boolean;
  depth?: number;
}

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink';
  filePath: string;
  timestamp: Date;
  hash?: string;
}

export class QualityFileWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private config: FileWatcherConfig;
  private engine: TimescaleQualityEngine;
  private fileHashes: Map<string, string> = new Map();
  private processingQueue: Set<string> = new Set();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(engine: TimescaleQualityEngine, config: FileWatcherConfig) {
    super();
    this.engine = engine;
    this.config = {
      debounceDelay: 1000,
      fileExtensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      followSymlinks: false,
      depth: 10,
      ...config
    };
  }

  /**
   * Start watching files
   */
  async start(): Promise<void> {
    if (this.watcher) {
      console.warn('File watcher is already running');
      return;
    }

    // Initialize watcher with configuration
    this.watcher = watch(this.config.paths, {
      ignored: this.config.excludePatterns || [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/*.log',
        '**/.DS_Store'
      ],
      persistent: true,
      ignoreInitial: false,
      followSymlinks: this.config.followSymlinks,
      depth: this.config.depth,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    });

    // Set up event handlers
    this.watcher
      .on('add', this.handleFileAdd.bind(this))
      .on('change', this.handleFileChange.bind(this))
      .on('unlink', this.handleFileDelete.bind(this))
      .on('error', this.handleError.bind(this))
      .on('ready', () => {
        console.log('✅ File watcher is ready');
        this.emit('ready', { 
          watchedPaths: this.config.paths,
          fileCount: this.fileHashes.size 
        });
      });
  }

  /**
   * Stop watching files
   */
  async stop(): Promise<void> {
    if (!this.watcher) {
      return;
    }

    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Close watcher
    await this.watcher.close();
    this.watcher = null;
    
    console.log('🛑 File watcher stopped');
    this.emit('stopped');
  }

  /**
   * Handle file addition
   */
  private async handleFileAdd(filePath: string): Promise<void> {
    if (!this.shouldProcessFile(filePath)) {
      return;
    }

    // Calculate initial hash
    const hash = await this.getFileHash(filePath);
    this.fileHashes.set(filePath, hash);

    // Emit event
    const event: FileChangeEvent = {
      type: 'add',
      filePath,
      timestamp: new Date(),
      hash
    };
    this.emit('file:add', event);

    // Process the file
    this.debounceFileProcessing(filePath, 'add');
  }

  /**
   * Handle file change
   */
  private async handleFileChange(filePath: string): Promise<void> {
    if (!this.shouldProcessFile(filePath)) {
      return;
    }

    // Check if file actually changed by comparing hashes
    const newHash = await this.getFileHash(filePath);
    const oldHash = this.fileHashes.get(filePath);

    if (oldHash === newHash) {
      // File didn't actually change (metadata change only)
      return;
    }

    this.fileHashes.set(filePath, newHash);

    // Emit event
    const event: FileChangeEvent = {
      type: 'change',
      filePath,
      timestamp: new Date(),
      hash: newHash
    };
    this.emit('file:change', event);

    // Process the file
    this.debounceFileProcessing(filePath, 'change');
  }

  /**
   * Handle file deletion
   */
  private handleFileDelete(filePath: string): void {
    if (!this.shouldProcessFile(filePath)) {
      return;
    }

    // Cancel any pending processing
    const timer = this.debounceTimers.get(filePath);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(filePath);
    }

    // Remove from tracking
    this.fileHashes.delete(filePath);
    this.processingQueue.delete(filePath);

    // Emit event
    const event: FileChangeEvent = {
      type: 'unlink',
      filePath,
      timestamp: new Date()
    };
    this.emit('file:delete', event);

    // TODO: Mark violations as resolved or historical
  }

  /**
   * Handle watcher errors
   */
  private handleError(error: Error): void {
    console.error('File watcher error:', error);
    this.emit('error', error);
  }

  /**
   * Check if file should be processed
   */
  private shouldProcessFile(filePath: string): boolean {
    // Check file extension
    if (this.config.fileExtensions) {
      const ext = path.extname(filePath);
      if (!this.config.fileExtensions.includes(ext)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Debounce file processing to avoid rapid re-analysis
   */
  private debounceFileProcessing(filePath: string, eventType: string): void {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(filePath);
      await this.processFile(filePath, eventType);
    }, this.config.debounceDelay);

    this.debounceTimers.set(filePath, timer);
  }

  /**
   * Process a file through the quality engine
   */
  private async processFile(filePath: string, eventType: string): Promise<void> {
    // Avoid processing the same file multiple times simultaneously
    if (this.processingQueue.has(filePath)) {
      return;
    }

    this.processingQueue.add(filePath);
    
    try {
      console.log(`🔍 Processing ${eventType} event for ${filePath}`);
      
      const context: ProcessingContext = {
        sessionType: 'WATCH',
        triggeredBy: `file-watcher:${eventType}`,
        watchMode: true
      };

      const result = await this.engine.processFile(filePath, context);
      
      // Emit processing result
      this.emit('file:processed', {
        filePath,
        eventType,
        sessionId: result.session.id,
        qualityScore: result.metrics?.qualityScore,
        violationCount: result.violations.length,
        timestamp: new Date()
      });

      // Auto-complete watch sessions
      await this.engine.completeSession(result.session.id, 'completed');
      
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
      this.emit('file:error', { filePath, error });
    } finally {
      this.processingQueue.delete(filePath);
    }
  }

  /**
   * Get file hash
   */
  private async getFileHash(filePath: string): Promise<string> {
    try {
      const content = await readFile(filePath, 'utf-8');
      return createHash('sha256').update(content).digest('hex');
    } catch (error) {
      // Return empty hash if file can't be read
      return '';
    }
  }

  /**
   * Get current watcher statistics
   */
  getStats(): {
    watchedFiles: number;
    processingQueue: number;
    pendingDebounce: number;
    isRunning: boolean;
  } {
    return {
      watchedFiles: this.fileHashes.size,
      processingQueue: this.processingQueue.size,
      pendingDebounce: this.debounceTimers.size,
      isRunning: this.watcher !== null
    };
  }

  /**
   * Get list of watched files
   */
  getWatchedFiles(): string[] {
    return Array.from(this.fileHashes.keys());
  }
}