import { GraphQLResolveInfo } from 'graphql';
import { Context } from '../resolvers/context';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type BatchCommitInput = {
  /** List of commits to perform */
  commits: Array<CommitInput>;
  /** Whether to continue on error */
  continueOnError: InputMaybe<Scalars['Boolean']['input']>;
  /** Maximum parallel operations */
  maxConcurrency: InputMaybe<Scalars['Int']['input']>;
};

export type BatchCommitResult = {
  __typename?: 'BatchCommitResult';
  /** Execution time in milliseconds */
  executionTime: Scalars['Int']['output'];
  /** Individual results per repository */
  results: Array<CommitResult>;
  /** Number of successful commits */
  successCount: Scalars['Int']['output'];
  /** Total repositories processed */
  totalRepositories: Scalars['Int']['output'];
};

export type Branch = {
  __typename?: 'Branch';
  /** Whether this is the current branch */
  isCurrent: Scalars['Boolean']['output'];
  /** Whether branch tracks a remote */
  isTracking: Scalars['Boolean']['output'];
  /** Last commit on branch */
  lastCommit: Commit;
  /** Branch name */
  name: Scalars['String']['output'];
  /** Remote tracking branch */
  trackingBranch: Maybe<Scalars['String']['output']>;
};

export type ChangesByType = {
  __typename?: 'ChangesByType';
  /** Added files */
  added: Scalars['Int']['output'];
  /** Deleted files */
  deleted: Scalars['Int']['output'];
  /** Modified files */
  modified: Scalars['Int']['output'];
  /** Renamed files */
  renamed: Scalars['Int']['output'];
  /** Untracked files */
  untracked: Scalars['Int']['output'];
};

export type Commit = {
  __typename?: 'Commit';
  /** Author name */
  author: Scalars['String']['output'];
  /** Author email */
  authorEmail: Scalars['String']['output'];
  /** Commit hash */
  hash: Scalars['String']['output'];
  /** Commit message */
  message: Scalars['String']['output'];
  /** Commit timestamp */
  timestamp: Scalars['String']['output'];
};

export type CommitInfo = {
  __typename?: 'CommitInfo';
  /** Author name */
  author: Scalars['String']['output'];
  /** Commit hash */
  hash: Scalars['String']['output'];
  /** Commit message */
  message: Scalars['String']['output'];
  /** Repository path */
  repository: Scalars['String']['output'];
  /** Short hash (7 characters) */
  shortHash: Scalars['String']['output'];
  /** Commit timestamp */
  timestamp: Scalars['String']['output'];
};

export type CommitInput = {
  /** Author name (optional) */
  author: InputMaybe<Scalars['String']['input']>;
  /** Author email (optional) */
  authorEmail: InputMaybe<Scalars['String']['input']>;
  /** Files to stage (empty means all) */
  files: InputMaybe<Array<Scalars['String']['input']>>;
  /** Commit message */
  message: Scalars['String']['input'];
  /** Repository path */
  repository: Scalars['String']['input'];
  /** Whether to stage all changes */
  stageAll: InputMaybe<Scalars['Boolean']['input']>;
};

export type CommitResult = {
  __typename?: 'CommitResult';
  /** Commit hash */
  commitHash: Maybe<Scalars['String']['output']>;
  /** Files that were committed */
  committedFiles: Array<Scalars['String']['output']>;
  /** Error message if failed */
  error: Maybe<Scalars['String']['output']>;
  /** Whether the working directory is clean after commit */
  isClean: Maybe<Scalars['Boolean']['output']>;
  /** Number of uncommitted files remaining */
  remainingFiles: Maybe<Scalars['Int']['output']>;
  /** Repository path */
  repository: Scalars['String']['output'];
  /** Whether commit was successful */
  success: Scalars['Boolean']['output'];
};

export type DetailedScanReport = {
  __typename?: 'DetailedScanReport';
  /** Scan metadata */
  metadata: ScanMetadata;
  /** List of all repositories with detailed information */
  repositories: Array<Repository>;
  /** Overall statistics */
  statistics: ScanStatistics;
};

export type FileStatus = {
  __typename?: 'FileStatus';
  /** Whether file is staged */
  isStaged: Scalars['Boolean']['output'];
  /** File path relative to repository root */
  path: Scalars['String']['output'];
  /** Git status code (M, A, D, R, U, etc.) */
  status: Scalars['String']['output'];
  /** Human-readable status description */
  statusDescription: Scalars['String']['output'];
};

export type GitCommandInput = {
  /** Command arguments */
  args: Array<Scalars['String']['input']>;
  /** Git command to execute (without 'git' prefix) */
  command: Scalars['String']['input'];
  /** Repository path */
  repository: Scalars['String']['input'];
  /** Working directory (defaults to repository path) */
  workingDirectory: InputMaybe<Scalars['String']['input']>;
};

export type GitCommandResult = {
  __typename?: 'GitCommandResult';
  /** Command that was executed */
  command: Scalars['String']['output'];
  /** Error message if failed */
  error: Maybe<Scalars['String']['output']>;
  /** Exit code */
  exitCode: Scalars['Int']['output'];
  /** Command output */
  output: Maybe<Scalars['String']['output']>;
  /** Whether command executed successfully */
  success: Scalars['Boolean']['output'];
};

export type GitStatus = {
  __typename?: 'GitStatus';
  /** Number of commits ahead of remote */
  ahead: Scalars['Int']['output'];
  /** Number of commits behind remote */
  behind: Scalars['Int']['output'];
  /** Current branch name */
  branch: Scalars['String']['output'];
  /** List of files with changes */
  files: Array<FileStatus>;
  /** Whether repository has a remote */
  hasRemote: Scalars['Boolean']['output'];
  /** Whether there are uncommitted changes */
  isDirty: Scalars['Boolean']['output'];
  /** List of stashes */
  stashes: Array<Stash>;
};

export type HierarchicalCommitAndPushResult = {
  __typename?: 'HierarchicalCommitAndPushResult';
  /** Result of the hierarchical commit */
  commitResult: HierarchicalCommitResult;
  /** Overall error message if failed */
  error: Maybe<Scalars['String']['output']>;
  /** Total execution time in milliseconds */
  executionTime: Scalars['Int']['output'];
  /** Push results for each repository */
  pushResults: Array<PushResult>;
  /** Whether all operations were successful */
  success: Scalars['Boolean']['output'];
};

export type HierarchicalCommitInput = {
  /** Author name (optional) */
  author: InputMaybe<Scalars['String']['input']>;
  /** Author email (optional) */
  authorEmail: InputMaybe<Scalars['String']['input']>;
  /** Commit message to use for all repositories */
  message: Scalars['String']['input'];
  /** Whether to stage all changes in each repository */
  stageAll: InputMaybe<Scalars['Boolean']['input']>;
};

export type HierarchicalCommitResult = {
  __typename?: 'HierarchicalCommitResult';
  /** Overall error message if failed */
  error: Maybe<Scalars['String']['output']>;
  /** Execution time in milliseconds */
  executionTime: Scalars['Int']['output'];
  /** Commit made in parent repository */
  parentCommit: Maybe<CommitResult>;
  /** Commits made in submodules */
  submoduleCommits: Array<CommitResult>;
  /** Whether all commits were successful */
  success: Scalars['Boolean']['output'];
  /** Number of successful commits */
  successCount: Scalars['Int']['output'];
  /** Total repositories processed */
  totalRepositories: Scalars['Int']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  /** Commit changes across multiple repositories */
  batchCommit: BatchCommitResult;
  /** Stage and commit changes */
  commitChanges: CommitResult;
  /** Execute a git command (with safety restrictions) */
  executeGitCommand: GitCommandResult;
  /** Commit all changes hierarchically (submodules first, then parent) */
  hierarchicalCommit: HierarchicalCommitResult;
  /** Commit and push all changes hierarchically */
  hierarchicalCommitAndPush: HierarchicalCommitAndPushResult;
  /** Push changes to remote repository */
  pushChanges: PushResult;
};


export type MutationBatchCommitArgs = {
  input: BatchCommitInput;
};


export type MutationCommitChangesArgs = {
  input: CommitInput;
};


export type MutationExecuteGitCommandArgs = {
  input: GitCommandInput;
};


export type MutationHierarchicalCommitArgs = {
  input: HierarchicalCommitInput;
};


export type MutationHierarchicalCommitAndPushArgs = {
  input: HierarchicalCommitInput;
};


export type MutationPushChangesArgs = {
  input: PushInput;
};

export type PackageInfo = {
  __typename?: 'PackageInfo';
  /** Dependencies count */
  dependencyCount: Scalars['Int']['output'];
  /** Package description */
  description: Maybe<Scalars['String']['output']>;
  /** Dev dependencies count */
  devDependencyCount: Scalars['Int']['output'];
  /** Main entry point */
  main: Maybe<Scalars['String']['output']>;
  /** Package name from package.json */
  name: Scalars['String']['output'];
  /** Scripts available */
  scripts: Array<Scalars['String']['output']>;
  /** Package version */
  version: Scalars['String']['output'];
};

export type PushInput = {
  /** Branch to push (defaults to current) */
  branch: InputMaybe<Scalars['String']['input']>;
  /** Whether to push tags */
  pushTags: InputMaybe<Scalars['Boolean']['input']>;
  /** Remote name (defaults to origin) */
  remote: InputMaybe<Scalars['String']['input']>;
  /** Repository path */
  repository: Scalars['String']['input'];
  /** Whether to set upstream */
  setUpstream: InputMaybe<Scalars['Boolean']['input']>;
};

export type PushResult = {
  __typename?: 'PushResult';
  /** Branch that was pushed */
  branch: Scalars['String']['output'];
  /** Error message if failed */
  error: Maybe<Scalars['String']['output']>;
  /** Remote name */
  remote: Scalars['String']['output'];
  /** Repository path */
  repository: Scalars['String']['output'];
  /** Whether push was successful */
  success: Scalars['Boolean']['output'];
};

export type Query = {
  __typename?: 'Query';
  /** Get the current git status of a repository */
  gitStatus: GitStatus;
  /** Check service health and Git availability */
  health: RepoAgentHealth;
  /** Check if repository has uncommitted changes */
  isRepositoryClean: RepositoryCleanStatus;
  /** Get the latest commit hash for a repository */
  latestCommit: CommitInfo;
  /** Get comprehensive information about a specific repository */
  repositoryDetails: Repository;
  /** Perform a detailed scan with diffs and history */
  scanAllDetailed: DetailedScanReport;
  /** Scan workspace for all git repositories */
  scanAllRepositories: Array<Repository>;
  /** List and get status of git submodules */
  submodules: Array<Submodule>;
};


export type QueryGitStatusArgs = {
  path: Scalars['String']['input'];
};


export type QueryIsRepositoryCleanArgs = {
  path: Scalars['String']['input'];
};


export type QueryLatestCommitArgs = {
  path: Scalars['String']['input'];
};


export type QueryRepositoryDetailsArgs = {
  path: Scalars['String']['input'];
};

export type Remote = {
  __typename?: 'Remote';
  /** Fetch URL */
  fetchUrl: Scalars['String']['output'];
  /** Remote name (e.g., origin) */
  name: Scalars['String']['output'];
  /** Push URL */
  pushUrl: Scalars['String']['output'];
};

export type RepoAgentHealth = {
  __typename?: 'RepoAgentHealth';
  /** Additional service information */
  details: RepoAgentHealthDetails;
  /** Whether service is healthy */
  healthy: Scalars['Boolean']['output'];
  /** Current timestamp */
  timestamp: Scalars['String']['output'];
  /** Service version */
  version: Maybe<Scalars['String']['output']>;
};

export type RepoAgentHealthDetails = {
  __typename?: 'RepoAgentHealthDetails';
  /** Git version */
  gitVersion: Scalars['String']['output'];
  /** Number of repositories being monitored */
  repositoryCount: Scalars['Int']['output'];
  /** System information */
  system: RepoAgentSystemInfo;
};

export type RepoAgentSystemInfo = {
  __typename?: 'RepoAgentSystemInfo';
  /** CPU architecture */
  arch: Scalars['String']['output'];
  /** Free memory in bytes */
  freeMemory: Scalars['Float']['output'];
  /** Node.js version */
  nodeVersion: Scalars['String']['output'];
  /** Platform (linux, darwin, win32) */
  platform: Scalars['String']['output'];
  /** Total memory in bytes */
  totalMemory: Scalars['Float']['output'];
};

/** Repository is the main entity owned by this service */
export type Repository = {
  __typename?: 'Repository';
  /** Current branch */
  branch: Scalars['String']['output'];
  /** All branches */
  branches: Array<Branch>;
  /** Repository configuration */
  config: RepositoryConfig;
  /** Whether repository has uncommitted changes */
  isDirty: Scalars['Boolean']['output'];
  /** Repository name derived from path */
  name: Scalars['String']['output'];
  /** Package information if applicable */
  packageInfo: Maybe<PackageInfo>;
  /** Absolute path to repository - unique identifier */
  path: Scalars['String']['output'];
  /** Recent commit history */
  recentCommits: Array<Commit>;
  /** All remotes */
  remotes: Array<Remote>;
  /** Repository size information */
  size: RepositorySize;
  /** Staged diff */
  stagedDiff: Maybe<Scalars['String']['output']>;
  /** Current git status */
  status: GitStatus;
  /** All tags */
  tags: Array<Tag>;
  /** Repository type (regular, submodule, etc.) */
  type: RepositoryType;
  /** Number of uncommitted files */
  uncommittedCount: Scalars['Int']['output'];
  /** Unstaged diff */
  unstagedDiff: Maybe<Scalars['String']['output']>;
};

export type RepositoryCleanStatus = {
  __typename?: 'RepositoryCleanStatus';
  /** Whether the repository has uncommitted changes */
  isClean: Scalars['Boolean']['output'];
  /** Latest commit hash */
  latestCommitHash: Scalars['String']['output'];
  /** Repository path */
  repository: Scalars['String']['output'];
  /** Number of uncommitted files */
  uncommittedFiles: Scalars['Int']['output'];
};

export type RepositoryConfig = {
  __typename?: 'RepositoryConfig';
  /** Default branch name */
  defaultBranch: Scalars['String']['output'];
  /** Whether repository is bare */
  isBare: Scalars['Boolean']['output'];
  /** Whether repository is shallow */
  isShallow: Scalars['Boolean']['output'];
};

export type RepositorySize = {
  __typename?: 'RepositorySize';
  /** Number of commits */
  commitCount: Scalars['Int']['output'];
  /** Number of files */
  fileCount: Scalars['Int']['output'];
  /** Size of .git directory */
  gitSize: Scalars['Int']['output'];
  /** Total size in bytes */
  totalSize: Scalars['Int']['output'];
};

export type RepositoryType =
  /** Bare repository */
  | 'BARE'
  /** Regular git repository */
  | 'REGULAR'
  /** Git submodule */
  | 'SUBMODULE'
  /** Worktree */
  | 'WORKTREE';

export type ScanMetadata = {
  __typename?: 'ScanMetadata';
  /** Scan duration in milliseconds */
  duration: Scalars['Int']['output'];
  /** When the scan completed */
  endTime: Scalars['String']['output'];
  /** When the scan started */
  startTime: Scalars['String']['output'];
  /** Workspace root path */
  workspaceRoot: Scalars['String']['output'];
};

export type ScanStatistics = {
  __typename?: 'ScanStatistics';
  /** Breakdown by file type */
  changesByType: ChangesByType;
  /** Number of dirty repositories */
  dirtyRepositories: Scalars['Int']['output'];
  /** Total lines added */
  totalAdditions: Scalars['Int']['output'];
  /** Total lines deleted */
  totalDeletions: Scalars['Int']['output'];
  /** Total number of repositories */
  totalRepositories: Scalars['Int']['output'];
  /** Total uncommitted files */
  totalUncommittedFiles: Scalars['Int']['output'];
};

export type Stash = {
  __typename?: 'Stash';
  /** Stash index */
  index: Scalars['Int']['output'];
  /** Stash message */
  message: Scalars['String']['output'];
  /** When the stash was created */
  timestamp: Scalars['String']['output'];
};

export type Submodule = {
  __typename?: 'Submodule';
  /** Current commit hash */
  commit: Scalars['String']['output'];
  /** Whether submodule has uncommitted changes */
  isDirty: Scalars['Boolean']['output'];
  /** Whether submodule is initialized */
  isInitialized: Scalars['Boolean']['output'];
  /** Submodule name */
  name: Scalars['String']['output'];
  /** Path relative to parent repository */
  path: Scalars['String']['output'];
  /** Submodule status */
  status: SubmoduleStatus;
  /** Submodule URL */
  url: Scalars['String']['output'];
};

export type SubmoduleStatus = {
  __typename?: 'SubmoduleStatus';
  /** Number of commits ahead */
  ahead: Scalars['Int']['output'];
  /** Number of commits behind */
  behind: Scalars['Int']['output'];
  /** Whether submodule has merge conflicts */
  hasConflicts: Scalars['Boolean']['output'];
  /** Whether submodule is up to date */
  isUpToDate: Scalars['Boolean']['output'];
};

export type Tag = {
  __typename?: 'Tag';
  /** Tagged commit */
  commit: Scalars['String']['output'];
  /** Tag date */
  date: Maybe<Scalars['String']['output']>;
  /** Tag message (for annotated tags) */
  message: Maybe<Scalars['String']['output']>;
  /** Tag name */
  name: Scalars['String']['output'];
  /** Tagger information */
  tagger: Maybe<Scalars['String']['output']>;
  /** Tag type (lightweight or annotated) */
  type: TagType;
};

export type TagType =
  /** Annotated tag */
  | 'ANNOTATED'
  /** Lightweight tag */
  | 'LIGHTWEIGHT';

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;



/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  BatchCommitInput: BatchCommitInput;
  BatchCommitResult: ResolverTypeWrapper<BatchCommitResult>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Branch: ResolverTypeWrapper<Branch>;
  ChangesByType: ResolverTypeWrapper<ChangesByType>;
  Commit: ResolverTypeWrapper<Commit>;
  CommitInfo: ResolverTypeWrapper<CommitInfo>;
  CommitInput: CommitInput;
  CommitResult: ResolverTypeWrapper<CommitResult>;
  DetailedScanReport: ResolverTypeWrapper<DetailedScanReport>;
  FileStatus: ResolverTypeWrapper<FileStatus>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  GitCommandInput: GitCommandInput;
  GitCommandResult: ResolverTypeWrapper<GitCommandResult>;
  GitStatus: ResolverTypeWrapper<GitStatus>;
  HierarchicalCommitAndPushResult: ResolverTypeWrapper<HierarchicalCommitAndPushResult>;
  HierarchicalCommitInput: HierarchicalCommitInput;
  HierarchicalCommitResult: ResolverTypeWrapper<HierarchicalCommitResult>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  Mutation: ResolverTypeWrapper<{}>;
  PackageInfo: ResolverTypeWrapper<PackageInfo>;
  PushInput: PushInput;
  PushResult: ResolverTypeWrapper<PushResult>;
  Query: ResolverTypeWrapper<{}>;
  Remote: ResolverTypeWrapper<Remote>;
  RepoAgentHealth: ResolverTypeWrapper<RepoAgentHealth>;
  RepoAgentHealthDetails: ResolverTypeWrapper<RepoAgentHealthDetails>;
  RepoAgentSystemInfo: ResolverTypeWrapper<RepoAgentSystemInfo>;
  Repository: ResolverTypeWrapper<Repository>;
  RepositoryCleanStatus: ResolverTypeWrapper<RepositoryCleanStatus>;
  RepositoryConfig: ResolverTypeWrapper<RepositoryConfig>;
  RepositorySize: ResolverTypeWrapper<RepositorySize>;
  RepositoryType: RepositoryType;
  ScanMetadata: ResolverTypeWrapper<ScanMetadata>;
  ScanStatistics: ResolverTypeWrapper<ScanStatistics>;
  Stash: ResolverTypeWrapper<Stash>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Submodule: ResolverTypeWrapper<Submodule>;
  SubmoduleStatus: ResolverTypeWrapper<SubmoduleStatus>;
  Tag: ResolverTypeWrapper<Tag>;
  TagType: TagType;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  BatchCommitInput: BatchCommitInput;
  BatchCommitResult: BatchCommitResult;
  Boolean: Scalars['Boolean']['output'];
  Branch: Branch;
  ChangesByType: ChangesByType;
  Commit: Commit;
  CommitInfo: CommitInfo;
  CommitInput: CommitInput;
  CommitResult: CommitResult;
  DetailedScanReport: DetailedScanReport;
  FileStatus: FileStatus;
  Float: Scalars['Float']['output'];
  GitCommandInput: GitCommandInput;
  GitCommandResult: GitCommandResult;
  GitStatus: GitStatus;
  HierarchicalCommitAndPushResult: HierarchicalCommitAndPushResult;
  HierarchicalCommitInput: HierarchicalCommitInput;
  HierarchicalCommitResult: HierarchicalCommitResult;
  Int: Scalars['Int']['output'];
  Mutation: {};
  PackageInfo: PackageInfo;
  PushInput: PushInput;
  PushResult: PushResult;
  Query: {};
  Remote: Remote;
  RepoAgentHealth: RepoAgentHealth;
  RepoAgentHealthDetails: RepoAgentHealthDetails;
  RepoAgentSystemInfo: RepoAgentSystemInfo;
  Repository: Repository;
  RepositoryCleanStatus: RepositoryCleanStatus;
  RepositoryConfig: RepositoryConfig;
  RepositorySize: RepositorySize;
  ScanMetadata: ScanMetadata;
  ScanStatistics: ScanStatistics;
  Stash: Stash;
  String: Scalars['String']['output'];
  Submodule: Submodule;
  SubmoduleStatus: SubmoduleStatus;
  Tag: Tag;
}>;

export type BatchCommitResultResolvers<ContextType = Context, ParentType extends ResolversParentTypes['BatchCommitResult'] = ResolversParentTypes['BatchCommitResult']> = ResolversObject<{
  executionTime: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  results: Resolver<Array<ResolversTypes['CommitResult']>, ParentType, ContextType>;
  successCount: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalRepositories: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type BranchResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Branch'] = ResolversParentTypes['Branch']> = ResolversObject<{
  isCurrent: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isTracking: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  lastCommit: Resolver<ResolversTypes['Commit'], ParentType, ContextType>;
  name: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  trackingBranch: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ChangesByTypeResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ChangesByType'] = ResolversParentTypes['ChangesByType']> = ResolversObject<{
  added: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  deleted: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  modified: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  renamed: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  untracked: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type CommitResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Commit'] = ResolversParentTypes['Commit']> = ResolversObject<{
  author: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  authorEmail: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  hash: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  message: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  timestamp: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type CommitInfoResolvers<ContextType = Context, ParentType extends ResolversParentTypes['CommitInfo'] = ResolversParentTypes['CommitInfo']> = ResolversObject<{
  author: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  hash: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  message: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  repository: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  shortHash: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  timestamp: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type CommitResultResolvers<ContextType = Context, ParentType extends ResolversParentTypes['CommitResult'] = ResolversParentTypes['CommitResult']> = ResolversObject<{
  commitHash: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  committedFiles: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  error: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  isClean: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  remainingFiles: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  repository: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  success: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type DetailedScanReportResolvers<ContextType = Context, ParentType extends ResolversParentTypes['DetailedScanReport'] = ResolversParentTypes['DetailedScanReport']> = ResolversObject<{
  metadata: Resolver<ResolversTypes['ScanMetadata'], ParentType, ContextType>;
  repositories: Resolver<Array<ResolversTypes['Repository']>, ParentType, ContextType>;
  statistics: Resolver<ResolversTypes['ScanStatistics'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type FileStatusResolvers<ContextType = Context, ParentType extends ResolversParentTypes['FileStatus'] = ResolversParentTypes['FileStatus']> = ResolversObject<{
  isStaged: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  path: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  statusDescription: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type GitCommandResultResolvers<ContextType = Context, ParentType extends ResolversParentTypes['GitCommandResult'] = ResolversParentTypes['GitCommandResult']> = ResolversObject<{
  command: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  error: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  exitCode: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  output: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  success: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type GitStatusResolvers<ContextType = Context, ParentType extends ResolversParentTypes['GitStatus'] = ResolversParentTypes['GitStatus']> = ResolversObject<{
  ahead: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  behind: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  branch: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  files: Resolver<Array<ResolversTypes['FileStatus']>, ParentType, ContextType>;
  hasRemote: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isDirty: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  stashes: Resolver<Array<ResolversTypes['Stash']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type HierarchicalCommitAndPushResultResolvers<ContextType = Context, ParentType extends ResolversParentTypes['HierarchicalCommitAndPushResult'] = ResolversParentTypes['HierarchicalCommitAndPushResult']> = ResolversObject<{
  commitResult: Resolver<ResolversTypes['HierarchicalCommitResult'], ParentType, ContextType>;
  error: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  executionTime: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  pushResults: Resolver<Array<ResolversTypes['PushResult']>, ParentType, ContextType>;
  success: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type HierarchicalCommitResultResolvers<ContextType = Context, ParentType extends ResolversParentTypes['HierarchicalCommitResult'] = ResolversParentTypes['HierarchicalCommitResult']> = ResolversObject<{
  error: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  executionTime: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  parentCommit: Resolver<Maybe<ResolversTypes['CommitResult']>, ParentType, ContextType>;
  submoduleCommits: Resolver<Array<ResolversTypes['CommitResult']>, ParentType, ContextType>;
  success: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  successCount: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalRepositories: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MutationResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = ResolversObject<{
  batchCommit: Resolver<ResolversTypes['BatchCommitResult'], ParentType, ContextType, RequireFields<MutationBatchCommitArgs, 'input'>>;
  commitChanges: Resolver<ResolversTypes['CommitResult'], ParentType, ContextType, RequireFields<MutationCommitChangesArgs, 'input'>>;
  executeGitCommand: Resolver<ResolversTypes['GitCommandResult'], ParentType, ContextType, RequireFields<MutationExecuteGitCommandArgs, 'input'>>;
  hierarchicalCommit: Resolver<ResolversTypes['HierarchicalCommitResult'], ParentType, ContextType, RequireFields<MutationHierarchicalCommitArgs, 'input'>>;
  hierarchicalCommitAndPush: Resolver<ResolversTypes['HierarchicalCommitAndPushResult'], ParentType, ContextType, RequireFields<MutationHierarchicalCommitAndPushArgs, 'input'>>;
  pushChanges: Resolver<ResolversTypes['PushResult'], ParentType, ContextType, RequireFields<MutationPushChangesArgs, 'input'>>;
}>;

export type PackageInfoResolvers<ContextType = Context, ParentType extends ResolversParentTypes['PackageInfo'] = ResolversParentTypes['PackageInfo']> = ResolversObject<{
  dependencyCount: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  description: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  devDependencyCount: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  main: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  name: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  scripts: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  version: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type PushResultResolvers<ContextType = Context, ParentType extends ResolversParentTypes['PushResult'] = ResolversParentTypes['PushResult']> = ResolversObject<{
  branch: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  error: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  remote: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  repository: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  success: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type QueryResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  gitStatus: Resolver<ResolversTypes['GitStatus'], ParentType, ContextType, RequireFields<QueryGitStatusArgs, 'path'>>;
  health: Resolver<ResolversTypes['RepoAgentHealth'], ParentType, ContextType>;
  isRepositoryClean: Resolver<ResolversTypes['RepositoryCleanStatus'], ParentType, ContextType, RequireFields<QueryIsRepositoryCleanArgs, 'path'>>;
  latestCommit: Resolver<ResolversTypes['CommitInfo'], ParentType, ContextType, RequireFields<QueryLatestCommitArgs, 'path'>>;
  repositoryDetails: Resolver<ResolversTypes['Repository'], ParentType, ContextType, RequireFields<QueryRepositoryDetailsArgs, 'path'>>;
  scanAllDetailed: Resolver<ResolversTypes['DetailedScanReport'], ParentType, ContextType>;
  scanAllRepositories: Resolver<Array<ResolversTypes['Repository']>, ParentType, ContextType>;
  submodules: Resolver<Array<ResolversTypes['Submodule']>, ParentType, ContextType>;
}>;

export type RemoteResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Remote'] = ResolversParentTypes['Remote']> = ResolversObject<{
  fetchUrl: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  pushUrl: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type RepoAgentHealthResolvers<ContextType = Context, ParentType extends ResolversParentTypes['RepoAgentHealth'] = ResolversParentTypes['RepoAgentHealth']> = ResolversObject<{
  details: Resolver<ResolversTypes['RepoAgentHealthDetails'], ParentType, ContextType>;
  healthy: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  timestamp: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  version: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type RepoAgentHealthDetailsResolvers<ContextType = Context, ParentType extends ResolversParentTypes['RepoAgentHealthDetails'] = ResolversParentTypes['RepoAgentHealthDetails']> = ResolversObject<{
  gitVersion: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  repositoryCount: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  system: Resolver<ResolversTypes['RepoAgentSystemInfo'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type RepoAgentSystemInfoResolvers<ContextType = Context, ParentType extends ResolversParentTypes['RepoAgentSystemInfo'] = ResolversParentTypes['RepoAgentSystemInfo']> = ResolversObject<{
  arch: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  freeMemory: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  nodeVersion: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  platform: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  totalMemory: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type RepositoryResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Repository'] = ResolversParentTypes['Repository']> = ResolversObject<{
  branch: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  branches: Resolver<Array<ResolversTypes['Branch']>, ParentType, ContextType>;
  config: Resolver<ResolversTypes['RepositoryConfig'], ParentType, ContextType>;
  isDirty: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  name: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  packageInfo: Resolver<Maybe<ResolversTypes['PackageInfo']>, ParentType, ContextType>;
  path: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  recentCommits: Resolver<Array<ResolversTypes['Commit']>, ParentType, ContextType>;
  remotes: Resolver<Array<ResolversTypes['Remote']>, ParentType, ContextType>;
  size: Resolver<ResolversTypes['RepositorySize'], ParentType, ContextType>;
  stagedDiff: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  status: Resolver<ResolversTypes['GitStatus'], ParentType, ContextType>;
  tags: Resolver<Array<ResolversTypes['Tag']>, ParentType, ContextType>;
  type: Resolver<ResolversTypes['RepositoryType'], ParentType, ContextType>;
  uncommittedCount: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  unstagedDiff: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type RepositoryCleanStatusResolvers<ContextType = Context, ParentType extends ResolversParentTypes['RepositoryCleanStatus'] = ResolversParentTypes['RepositoryCleanStatus']> = ResolversObject<{
  isClean: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  latestCommitHash: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  repository: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  uncommittedFiles: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type RepositoryConfigResolvers<ContextType = Context, ParentType extends ResolversParentTypes['RepositoryConfig'] = ResolversParentTypes['RepositoryConfig']> = ResolversObject<{
  defaultBranch: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  isBare: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isShallow: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type RepositorySizeResolvers<ContextType = Context, ParentType extends ResolversParentTypes['RepositorySize'] = ResolversParentTypes['RepositorySize']> = ResolversObject<{
  commitCount: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  fileCount: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  gitSize: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalSize: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ScanMetadataResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ScanMetadata'] = ResolversParentTypes['ScanMetadata']> = ResolversObject<{
  duration: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  endTime: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  startTime: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  workspaceRoot: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ScanStatisticsResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ScanStatistics'] = ResolversParentTypes['ScanStatistics']> = ResolversObject<{
  changesByType: Resolver<ResolversTypes['ChangesByType'], ParentType, ContextType>;
  dirtyRepositories: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalAdditions: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalDeletions: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalRepositories: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalUncommittedFiles: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type StashResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Stash'] = ResolversParentTypes['Stash']> = ResolversObject<{
  index: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  message: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  timestamp: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type SubmoduleResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Submodule'] = ResolversParentTypes['Submodule']> = ResolversObject<{
  commit: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  isDirty: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isInitialized: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  name: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  path: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status: Resolver<ResolversTypes['SubmoduleStatus'], ParentType, ContextType>;
  url: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type SubmoduleStatusResolvers<ContextType = Context, ParentType extends ResolversParentTypes['SubmoduleStatus'] = ResolversParentTypes['SubmoduleStatus']> = ResolversObject<{
  ahead: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  behind: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  hasConflicts: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isUpToDate: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type TagResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Tag'] = ResolversParentTypes['Tag']> = ResolversObject<{
  commit: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  date: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  message: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  name: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  tagger: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type: Resolver<ResolversTypes['TagType'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type Resolvers<ContextType = Context> = ResolversObject<{
  BatchCommitResult: BatchCommitResultResolvers<ContextType>;
  Branch: BranchResolvers<ContextType>;
  ChangesByType: ChangesByTypeResolvers<ContextType>;
  Commit: CommitResolvers<ContextType>;
  CommitInfo: CommitInfoResolvers<ContextType>;
  CommitResult: CommitResultResolvers<ContextType>;
  DetailedScanReport: DetailedScanReportResolvers<ContextType>;
  FileStatus: FileStatusResolvers<ContextType>;
  GitCommandResult: GitCommandResultResolvers<ContextType>;
  GitStatus: GitStatusResolvers<ContextType>;
  HierarchicalCommitAndPushResult: HierarchicalCommitAndPushResultResolvers<ContextType>;
  HierarchicalCommitResult: HierarchicalCommitResultResolvers<ContextType>;
  Mutation: MutationResolvers<ContextType>;
  PackageInfo: PackageInfoResolvers<ContextType>;
  PushResult: PushResultResolvers<ContextType>;
  Query: QueryResolvers<ContextType>;
  Remote: RemoteResolvers<ContextType>;
  RepoAgentHealth: RepoAgentHealthResolvers<ContextType>;
  RepoAgentHealthDetails: RepoAgentHealthDetailsResolvers<ContextType>;
  RepoAgentSystemInfo: RepoAgentSystemInfoResolvers<ContextType>;
  Repository: RepositoryResolvers<ContextType>;
  RepositoryCleanStatus: RepositoryCleanStatusResolvers<ContextType>;
  RepositoryConfig: RepositoryConfigResolvers<ContextType>;
  RepositorySize: RepositorySizeResolvers<ContextType>;
  ScanMetadata: ScanMetadataResolvers<ContextType>;
  ScanStatistics: ScanStatisticsResolvers<ContextType>;
  Stash: StashResolvers<ContextType>;
  Submodule: SubmoduleResolvers<ContextType>;
  SubmoduleStatus: SubmoduleStatusResolvers<ContextType>;
  Tag: TagResolvers<ContextType>;
}>;

