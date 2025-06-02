import simpleGit from 'simple-git';
import { Context } from '../context.js';
import { GitCommandResult, GitCommandInput } from '../../types/generated.js';
import path from 'path';
import fs from 'fs/promises';

const ALLOWED_COMMANDS = [
  'status',
  'log',
  'diff',
  'branch',
  'remote',
  'stash',
  'tag',
  'show',
  'fetch',
  'pull',
  'push',
  'checkout',
  'merge',
  'rebase',
  'reset',
  'clean',
  'add',
  'commit',
  'cherry-pick'
];

export async function executeGitCommand(
  _parent: unknown,
  { input }: { input: GitCommandInput },
  context: Context
): Promise<GitCommandResult> {
  try {
    const { repository: repoPath, command, args, workingDirectory } = input;
    
    // Validate command is allowed
    if (!ALLOWED_COMMANDS.includes(command)) {
      throw new Error(`Command '${command}' is not allowed. Allowed commands: ${ALLOWED_COMMANDS.join(', ')}`);
    }
    
    // Resolve absolute path
    const absolutePath = path.isAbsolute(repoPath) 
      ? repoPath 
      : path.join(context.workspaceRoot, repoPath);
    
    // Check if directory exists and is a git repository
    try {
      await fs.access(path.join(absolutePath, '.git'));
    } catch {
      throw new Error(`Not a git repository: ${repoPath}`);
    }
    
    const git = simpleGit(workingDirectory || absolutePath);
    
    // Execute the command
    let output: string;
    const commandArgs = args || [];
    
    // Handle special cases that need custom processing
    switch (command) {
      case 'add':
        // Ensure we're not adding sensitive files
        const sensitivePatterns = ['.env', 'secrets', 'credentials', 'private', 'key'];
        for (const arg of commandArgs) {
          const lowerArg = arg.toLowerCase();
          if (sensitivePatterns.some(pattern => lowerArg.includes(pattern))) {
            throw new Error(`Cannot add potentially sensitive file: ${arg}`);
          }
        }
        output = await git.raw(['add', ...commandArgs]);
        break;
        
      case 'commit':
        // Ensure commit has a message
        if (!commandArgs.includes('-m') && !commandArgs.includes('--message')) {
          throw new Error('Commit requires a message. Use -m flag.');
        }
        output = await git.raw(['commit', ...commandArgs]);
        break;
        
      case 'push':
        // Add safety check for force push
        if (commandArgs.includes('--force') || commandArgs.includes('-f')) {
          throw new Error('Force push is not allowed through this interface for safety.');
        }
        output = await git.raw(['push', ...commandArgs]);
        break;
        
      case 'reset':
        // Warn about destructive operations
        if (commandArgs.includes('--hard')) {
          throw new Error('Hard reset is not allowed through this interface for safety. Use --soft or --mixed instead.');
        }
        output = await git.raw(['reset', ...commandArgs]);
        break;
        
      default:
        // For all other commands, execute directly
        output = await git.raw([command, ...commandArgs]);
    }
    
    
    return {
      success: true,
      output: output || 'Command executed successfully',
      error: null,
      exitCode: 0,
      command: `git ${command} ${commandArgs.join(' ')}`
    };
  } catch (error: any) {
    
    return {
      success: false,
      output: null,
      error: error.message || 'Unknown error occurred',
      exitCode: 1,
      command: `git ${input.command} ${(input.args || []).join(' ')}`
    };
  }
}