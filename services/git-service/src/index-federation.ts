import { buildSubgraphSchema } from '@apollo/subgraph';
import { createYoga } from 'graphql-yoga';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'node:http';
import { GitServiceWithEvents } from './services/GitServiceWithEvents.js';
import type { Context } from './resolvers/context.js';
import { useEventTracking } from './plugins/eventTracking.js';
import { ClaudeSessionRepositoryResolver } from './resolvers/federation/claudeSessionResolver.js';
import { parse } from 'graphql';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load the federated schema
const typeDefsString = readFileSync(join(__dirname, '../schema/schema-federated.graphql'), 'utf8');
const typeDefs = parse(typeDefsString);

// Create the Git service
const gitService = new GitServiceWithEvents(process.env['WORKSPACE_ROOT'] || process.cwd());

// Import resolvers
import { gitStatus } from './resolvers/queries/gitStatus.js';
import { scanAllRepositories } from './resolvers/queries/scanAllRepositories.js';
import { scanAllDetailed } from './resolvers/queries/scanAllDetailed.js';
import { submodules } from './resolvers/queries/submodules.js';
import { repositoryDetails } from './resolvers/queries/repositoryDetails.js';
import { isRepositoryClean } from './resolvers/queries/isRepositoryClean.js';
import { latestCommit } from './resolvers/queries/latestCommit.js';
import { healthResolver as repoAgentHealth } from './resolvers/queries/health.js';

import { executeGitCommand } from './resolvers/mutations/executeGitCommand.js';
import { commitChanges } from './resolvers/mutations/commitChanges.js';
import { batchCommit } from './resolvers/mutations/batchCommit.js';
import { pushChanges } from './resolvers/mutations/pushChanges.js';
import { hierarchicalCommit } from './resolvers/mutations/hierarchicalCommit.js';
import { hierarchicalCommitAndPush } from './resolvers/mutations/hierarchicalCommitAndPush.js';

// Enhanced resolvers for federation
const resolvers = {
  Query: {
    repoAgentHealth,
    gitStatus,
    scanAllRepositories: async (_: any, __: any, context: Context) => {
      // Return Repository entities instead of RepositoryScan
      const scans = await scanAllRepositories(_, __, context);
      return scans.map(scan => ({
        path: scan.path,
        name: scan.name,
        isDirty: scan.isDirty,
        branch: scan.branch,
        uncommittedCount: scan.uncommittedCount,
        type: scan.type,
        // These will be resolved by field resolvers
        status: null,
        branches: null,
        tags: null,
        remotes: null,
        size: null,
        packageInfo: null,
        stagedDiff: null,
        unstagedDiff: null,
        recentCommits: null,
        config: null
      }));
    },
    scanAllDetailed,
    submodules,
    repositoryDetails: async (_: any, args: { path: string }, context: Context) => {
      const details = await repositoryDetails(_, args, context);
      // Transform to Repository entity
      return {
        path: details.path,
        name: details.name,
        status: details.status,
        isDirty: details.status.isDirty,
        branch: details.status.branch,
        uncommittedCount: details.status.files.length,
        type: 'REGULAR',
        branches: details.branches,
        tags: details.tags,
        remotes: details.remotes,
        size: details.size,
        packageInfo: details.packageInfo,
        stagedDiff: null,
        unstagedDiff: null,
        recentCommits: [],
        config: {
          defaultBranch: 'main',
          isBare: false,
          isShallow: false
        }
      };
    },
    isRepositoryClean,
    latestCommit
  },
  Mutation: {
    executeGitCommand,
    commitChanges,
    batchCommit,
    pushChanges,
    hierarchicalCommit,
    hierarchicalCommitAndPush
  },
  // Entity resolver
  Repository: {
    __resolveReference: async (reference: { path: string }, context: Context) => {
      // Resolve repository by path
      try {
        const details = await repositoryDetails(null, { path: reference.path }, context);
        return {
          path: details.path,
          name: details.name,
          status: details.status,
          isDirty: details.status.isDirty,
          branch: details.status.branch,
          uncommittedCount: details.status.files.length,
          type: 'REGULAR',
          branches: details.branches,
          tags: details.tags,
          remotes: details.remotes,
          size: details.size,
          packageInfo: details.packageInfo,
          stagedDiff: null,
          unstagedDiff: null,
          recentCommits: [],
          config: {
            defaultBranch: 'main',
            isBare: false,
            isShallow: false
          }
        };
      } catch (error) {
        console.error(`Failed to resolve repository ${reference.path}:`, error);
        return null;
      }
    },
    // Field resolvers that need async computation
    status: async (repository: any, _: any, context: Context) => {
      if (repository.status) return repository.status;
      const result = await gitStatus(null, { path: repository.path }, context);
      return result;
    },
    branches: async (repository: any, _: any, context: Context) => {
      if (repository.branches) return repository.branches;
      const details = await repositoryDetails(null, { path: repository.path }, context);
      return details.branches;
    },
    tags: async (repository: any, _: any, context: Context) => {
      if (repository.tags) return repository.tags;
      const details = await repositoryDetails(null, { path: repository.path }, context);
      return details.tags;
    },
    remotes: async (repository: any, _: any, context: Context) => {
      if (repository.remotes) return repository.remotes;
      const details = await repositoryDetails(null, { path: repository.path }, context);
      return details.remotes;
    },
    size: async (repository: any, _: any, context: Context) => {
      if (repository.size) return repository.size;
      const details = await repositoryDetails(null, { path: repository.path }, context);
      return details.size;
    },
    packageInfo: async (repository: any, _: any, context: Context) => {
      if (repository.packageInfo !== undefined) return repository.packageInfo;
      const details = await repositoryDetails(null, { path: repository.path }, context);
      return details.packageInfo;
    },
    stagedDiff: async (repository: any, _: any, context: Context) => {
      if (repository.stagedDiff !== undefined) return repository.stagedDiff;
      const detailed = await scanAllDetailed(null, {}, context);
      const repo = detailed.repositories.find(r => r.path === repository.path);
      return repo?.stagedDiff || null;
    },
    unstagedDiff: async (repository: any, _: any, context: Context) => {
      if (repository.unstagedDiff !== undefined) return repository.unstagedDiff;
      const detailed = await scanAllDetailed(null, {}, context);
      const repo = detailed.repositories.find(r => r.path === repository.path);
      return repo?.unstagedDiff || null;
    },
    recentCommits: async (repository: any, _: any, context: Context) => {
      if (repository.recentCommits) return repository.recentCommits;
      const detailed = await scanAllDetailed(null, {}, context);
      const repo = detailed.repositories.find(r => r.path === repository.path);
      return repo?.recentCommits || [];
    },
    config: async (repository: any, _: any, context: Context) => {
      if (repository.config) return repository.config;
      const detailed = await scanAllDetailed(null, {}, context);
      const repo = detailed.repositories.find(r => r.path === repository.path);
      return repo?.config || {
        defaultBranch: 'main',
        isBare: false,
        isShallow: false
      };
    }
  },
  // Extend ClaudeSession to resolve repository references
  ClaudeSession: new ClaudeSessionRepositoryResolver(gitService)
};

// Build the federated schema
const schema = buildSubgraphSchema([{ typeDefs, resolvers }]);

// Create Yoga instance with federated schema
const yoga = createYoga({
  schema,
  context: async () => ({
    gitService,
    workspaceRoot: process.env.WORKSPACE_ROOT || process.cwd()
  }),
  plugins: [useEventTracking({ serviceName: 'repo-agent' })],
  cors: {
    origin: '*',
    credentials: true,
  },
  graphiql: {
    title: 'Repo Agent Federated Subgraph',
    defaultQuery: `# Repo Agent Federated Service
# This service owns the Repository entity

query GetRepositories {
  scanAllRepositories {
    path
    name
    isDirty
    branch
    status {
      files {
        path
        status
      }
    }
  }
}

query GetRepositoryDetails {
  repositoryDetails(path: "meta-gothic-framework") {
    path
    name
    branches {
      name
      isCurrent
    }
    size {
      totalSize
      fileCount
    }
  }
}`,
  },
});

// Create and start the server
const port = process.env.PORT || 3004;
const server = createServer(yoga);

server.listen(port, () => {
  console.log(`🚀 Repo Agent federated subgraph ready at http://localhost:${port}/graphql`);
  console.log(`📊 GraphiQL available at http://localhost:${port}/graphql`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});