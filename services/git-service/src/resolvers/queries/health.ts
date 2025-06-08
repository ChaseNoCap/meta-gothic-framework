import { execSync } from 'child_process';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

interface ServiceHealthStatus {
  healthy: boolean;
  service: string;
  version: string;
  timestamp: string;
  details: any;
}

export const healthResolver = async (): Promise<ServiceHealthStatus> => {
  try {
    // Get Git version (testing tsx watch restart)
    let gitVersion = 'unknown';
    try {
      gitVersion = execSync('git --version', { encoding: 'utf8' }).trim();
    } catch (error) {
      console.error('Failed to get git version:', error);
    }

    // Count repositories (scan workspace)
    let repositoryCount = 0;
    try {
      const workspaceRoot = process.cwd();
      const scanDir = (dir: string) => {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          if (item.isDirectory()) {
            const fullPath = path.join(dir, item.name);
            if (item.name === '.git') {
              repositoryCount++;
            } else if (!item.name.startsWith('.') && item.name !== 'node_modules') {
              scanDir(fullPath);
            }
          }
        }
      };
      scanDir(workspaceRoot);
    } catch (error) {
      console.error('Failed to scan repositories:', error);
    }

    // Get package version
    let version: string | undefined;
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const packageJsonPath = path.join(__dirname, '../../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      version = packageJson.version;
    } catch (error) {
      console.error('Failed to read package.json:', error);
    }

    return {
      healthy: true,
      service: 'git-service',
      version: version || '1.0.0',
      timestamp: new Date().toISOString(),
      details: {
        repositoryCount,
        gitVersion,
        system: {
          platform: os.platform(),
          arch: os.arch(),
          nodeVersion: process.version,
          freeMemory: os.freemem(),
          totalMemory: os.totalmem()
        }
      }
    };
  } catch (error) {
    console.error('Health check failed:', error);
    return {
      healthy: false,
      service: 'git-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        repositoryCount: 0,
        gitVersion: 'unknown',
        system: {
          platform: os.platform(),
          arch: os.arch(),
          nodeVersion: process.version,
          freeMemory: os.freemem(),
          totalMemory: os.totalmem()
        }
      }
    };
  }
};