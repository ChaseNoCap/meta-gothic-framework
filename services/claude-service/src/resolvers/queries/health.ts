import type { Context } from '../../types/context.js';
import type { HealthStatus } from '../../types/generated.js';
import os from 'os';

/**
 * Check service health and Claude availability
 */
export async function health(
  _parent: unknown,
  _args: {},
  context: Context
): Promise<HealthStatus> {
  const { sessionManager } = context;
  
  // Check Claude CLI availability
  const claudeAvailable = await sessionManager.checkClaudeAvailability();
  
  // Get Claude version if available
  let claudeVersion: string | null = null;
  if (claudeAvailable) {
    try {
      const { execSync } = await import('child_process');
      claudeVersion = execSync('claude --version', { encoding: 'utf8' }).trim();
    } catch {
      // Version check failed, but Claude is available
    }
  }
  
  // Get resource usage
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
  
  const cpus = os.cpus();
  const cpuUsage = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    const idle = cpu.times.idle;
    return acc + ((total - idle) / total) * 100;
  }, 0) / cpus.length;
  
  // Get active sessions count
  const activeSessions = sessionManager.getActiveSessions().length;
  
  // Count active processes (node processes)
  const activeProcesses = 1; // This service process
  
  return {
    healthy: true,
    version: process.env.npm_package_version || '1.0.0',
    claudeAvailable,
    claudeVersion,
    activeSessions,
    resources: {
      memoryUsage,
      cpuUsage,
      activeProcesses
    }
  };
}