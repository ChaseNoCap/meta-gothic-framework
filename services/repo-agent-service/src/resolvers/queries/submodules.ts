import simpleGit from 'simple-git';
import { Context } from '../context.js';
import { Submodule, SubmoduleStatus } from '../../types/generated.js';
import path from 'path';
import fs from 'fs/promises';

export async function submodules(
  _parent: unknown,
  _args: {},
  context: Context
): Promise<Submodule[]> {
  try {
    const git = simpleGit(context.workspaceRoot);
    
    // Get submodule information (not used directly, just to check if submodules exist)
    await git.subModule(['status']);
    
    // Parse the submodule status output
    const submoduleList: Submodule[] = [];
    
    // Get .gitmodules file content for URL information
    let gitmodulesContent = '';
    try {
      gitmodulesContent = await fs.readFile(
        path.join(context.workspaceRoot, '.gitmodules'), 
        'utf-8'
      );
    } catch {
      // No .gitmodules file, so no submodules
      return [];
    }
    
    // Parse .gitmodules to get URLs
    const submoduleUrls = new Map<string, string>();
    const lines = gitmodulesContent.split('\n');
    let currentSubmodule = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('[submodule')) {
        const match = trimmed.match(/\[submodule "(.+)"\]/);
        if (match) {
          currentSubmodule = match[1]!;
        }
      } else if (trimmed.startsWith('url =') && currentSubmodule) {
        const url = trimmed.replace('url =', '').trim();
        submoduleUrls.set(currentSubmodule, url);
      }
    }
    
    // Get detailed status for each submodule
    for (const [name, url] of submoduleUrls) {
      const submodulePath = path.join(context.workspaceRoot, name);
      
      try {
        // Check if submodule is initialized
        const isInitialized = await fs.access(path.join(submodulePath, '.git'))
          .then(() => true)
          .catch(() => false);
        
        if (!isInitialized) {
          submoduleList.push({
            name,
            path: name,
            commit: '',
            url,
            isInitialized: false,
            isDirty: false,
            status: {
              isUpToDate: false,
              ahead: 0,
              behind: 0,
              hasConflicts: false
            }
          });
          continue;
        }
        
        // Get submodule status
        const subGit = simpleGit(submodulePath);
        const status = await subGit.status();
        const currentCommit = await subGit.revparse(['HEAD']);
        
        // Check if submodule has uncommitted changes
        const isDirty = status.files.length > 0;
        
        // Get ahead/behind info
        let ahead = 0;
        let behind = 0;
        let isUpToDate = true;
        
        if (status.tracking) {
          ahead = status.ahead;
          behind = status.behind;
          isUpToDate = ahead === 0 && behind === 0;
        }
        
        // Check for conflicts
        const hasConflicts = status.conflicted.length > 0;
        
        const submoduleStatus: SubmoduleStatus = {
          isUpToDate,
          ahead,
          behind,
          hasConflicts
        };
        
        submoduleList.push({
          name,
          path: name,
          commit: currentCommit.trim(),
          url,
          isInitialized: true,
          isDirty,
          status: submoduleStatus
        });
      } catch (error: any) {
        // If we can't get status, mark as uninitialized
        submoduleList.push({
          name,
          path: name,
          commit: '',
          url,
          isInitialized: false,
          isDirty: false,
          status: {
            isUpToDate: false,
            ahead: 0,
            behind: 0,
            hasConflicts: false
          }
        });
      }
    }
    
    return submoduleList;
  } catch (error: any) {
    // If there's an error (like no git repository), return empty array
    return [];
  }
}