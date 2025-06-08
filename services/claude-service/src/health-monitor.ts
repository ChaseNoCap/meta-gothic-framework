import { createLogger } from '@chasenocap/logger';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Initialize logger for health monitoring
const logger = createLogger('claude-health-monitor', {}, {
  logDir: join(__dirname, '../../logs/claude-service')
});

// Health metrics
interface HealthMetrics {
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  activeRequests: number;
  lastHealthCheck: Date;
  errors: Array<{
    timestamp: Date;
    error: string;
    stack?: string;
  }>;
}

class HealthMonitor {
  private metrics: HealthMetrics;
  private errorWindow = 5 * 60 * 1000; // 5 minutes
  private maxErrors = 10;
  private checkInterval?: NodeJS.Timer;
  
  constructor() {
    this.metrics = {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      activeRequests: 0,
      lastHealthCheck: new Date(),
      errors: []
    };
  }
  
  start() {
    // Check health every 30 seconds
    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000);
    
    logger.info('Health monitor started');
  }
  
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    logger.info('Health monitor stopped');
  }
  
  recordError(error: Error) {
    const now = new Date();
    
    // Add error to list
    this.metrics.errors.push({
      timestamp: now,
      error: error.message,
      stack: error.stack
    });
    
    // Clean up old errors
    const cutoff = new Date(now.getTime() - this.errorWindow);
    this.metrics.errors = this.metrics.errors.filter(e => e.timestamp > cutoff);
    
    // Check if we have too many errors
    if (this.metrics.errors.length >= this.maxErrors) {
      logger.error('Too many errors in window, service may be unhealthy', {
        errorCount: this.metrics.errors.length,
        window: this.errorWindow,
        recentErrors: this.metrics.errors.slice(-5)
      });
      
      // Could trigger alerts or auto-restart here
    }
  }
  
  incrementActiveRequests() {
    this.metrics.activeRequests++;
  }
  
  decrementActiveRequests() {
    this.metrics.activeRequests--;
  }
  
  private performHealthCheck() {
    this.metrics.uptime = process.uptime();
    this.metrics.memoryUsage = process.memoryUsage();
    this.metrics.lastHealthCheck = new Date();
    
    // Log health metrics
    logger.info('Health check', {
      uptime: Math.floor(this.metrics.uptime),
      memory: {
        heapUsed: Math.round(this.metrics.memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(this.metrics.memoryUsage.heapTotal / 1024 / 1024) + 'MB',
        rss: Math.round(this.metrics.memoryUsage.rss / 1024 / 1024) + 'MB'
      },
      activeRequests: this.metrics.activeRequests,
      recentErrors: this.metrics.errors.length
    });
    
    // Check for memory leaks
    const heapUsedMB = this.metrics.memoryUsage.heapUsed / 1024 / 1024;
    if (heapUsedMB > 500) {
      logger.warn('High memory usage detected', {
        heapUsedMB,
        uptime: this.metrics.uptime
      });
    }
  }
  
  getMetrics(): HealthMetrics {
    return { ...this.metrics };
  }
}

export const healthMonitor = new HealthMonitor();