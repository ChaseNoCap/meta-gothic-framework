import simpleGit from 'simple-git';
import { Context } from '../context.js';
import { Submodule, SubmoduleStatus } from '../../types/generated.js';
import { getFileSystem } from '@meta-gothic/shared-types/file-system';
import type { IFileSystem } from '@meta-gothic/shared-types/file-system';

export async function submodules(
  _parent: unknown,
  _args: {},
  context: Context
): Promise<Submodule[]> {
  try {
    const git = simpleGit(context.workspaceRoot);
    const fileSystem = getFileSystem({ 
      eventBus: context.eventBus, 
      logger: context.logger, 
      correlationId: context.correlationId 
    });
    
    // Get submodule information (not used directly, just to check if submodules exist)
    await git.subModule(['status']);
    
    // Parse the submodule status output
    const submoduleList: Submodule[] = [];
    
    // Get .gitmodules file content for URL information
    let gitmodulesContent = '';
    try {
      gitmodulesContent = await fileSystem.readFile(
        fileSystem.join(context.workspaceRoot, '.gitmodules')
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
      const submodulePath = fileSystem.join(context.workspaceRoot, name);
      
      try {
        // Check if submodule is initialized
        const isInitialized = await fileSystem.exists(fileSystem.join(submodulePath, '.git'));
        
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