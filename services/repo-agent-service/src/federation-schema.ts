import { buildSubgraphSchema } from '@apollo/subgraph';
import { gql } from 'graphql-tag';

export const typeDefs = gql`
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.10", import: ["@key", "@shareable"])

  type Query {
    """Get the current git status of a repository"""
    gitStatus(path: String!): GitStatus!
    
    """Scan workspace for all git repositories"""
    scanAllRepositories: [RepositoryScan!]!
    
    """Perform a detailed scan with diffs and history"""
    scanAllDetailed: DetailedScanReport!
    
    """List and get status of git submodules"""
    submodules: [Submodule!]!
    
    """Get comprehensive information about a specific repository"""
    repositoryDetails(path: String!): RepositoryDetails!
    
    """Check if repository has uncommitted changes"""
    isRepositoryClean(path: String!): RepositoryCleanStatus!
    
    """Get the latest commit hash for a repository"""
    latestCommit(path: String!): CommitInfo!
  }

  type Mutation {
    """Execute a git command (with safety restrictions)"""
    executeGitCommand(input: GitCommandInput!): GitCommandResult!
    
    """Stage and commit changes"""
    commitChanges(input: CommitInput!): CommitResult!
    
    """Commit changes across multiple repositories"""
    batchCommit(input: BatchCommitInput!): BatchCommitResult!
    
    """Push changes to remote repository"""
    pushChanges(input: PushInput!): PushResult!
  }

  # Entity type that can be shared across services
  type Repository @key(fields: "path") {
    """Absolute path to the repository"""
    path: String!
    
    """Repository name"""
    name: String!
    
    """Current git status"""
    status: GitStatus!
    
    """Whether repository has uncommitted changes"""
    isDirty: Boolean!
    
    """Current branch"""
    branch: String!
  }

  type GitStatus {
    """Current branch name"""
    branch: String!
    
    """Whether there are uncommitted changes"""
    isDirty: Boolean!
    
    """List of files with changes"""
    files: [FileStatus!]!
    
    """Number of commits ahead of remote"""
    ahead: Int!
    
    """Number of commits behind remote"""
    behind: Int!
    
    """Whether the branch has a remote tracking branch"""
    hasRemote: Boolean!
    
    """List of stashes"""
    stashes: [Stash!]!
  }

  type FileStatus {
    """File path relative to repository root"""
    path: String!
    
    """Git status code (M, A, D, ??, etc.)"""
    status: String!
    
    """Human-readable status description"""
    statusDescription: String!
    
    """Whether the file is staged"""
    isStaged: Boolean!
  }

  type Stash {
    """Stash index"""
    index: Int!
    
    """Stash message"""
    message: String!
    
    """When the stash was created"""
    timestamp: String!
  }

  type RepositoryScan {
    """Repository name"""
    name: String!
    
    """Absolute path to repository"""
    path: String!
    
    """Whether repository has uncommitted changes"""
    isDirty: Boolean!
    
    """Current branch"""
    branch: String!
    
    """Number of uncommitted files"""
    uncommittedCount: Int!
    
    """Repository type"""
    type: RepositoryType!
  }

  enum RepositoryType {
    REGULAR
    SUBMODULE
    BARE
    WORKTREE
  }

  type DetailedScanReport {
    """List of all repositories with detailed information"""
    repositories: [DetailedRepository!]!
    
    """Aggregate statistics"""
    statistics: ScanStatistics!
    
    """Scan metadata"""
    metadata: ScanMetadata!
  }

  type DetailedRepository {
    """Repository name"""
    name: String!
    
    """Absolute path"""
    path: String!
    
    """Current git status"""
    status: GitStatus!
    
    """Diff of staged changes"""
    stagedDiff: String
    
    """Diff of unstaged changes"""
    unstagedDiff: String
    
    """Recent commits"""
    recentCommits: [Commit!]!
    
    """Remote repositories"""
    remotes: [Remote!]!
    
    """Repository configuration"""
    config: RepositoryConfig!
  }

  type Commit {
    """Commit hash"""
    hash: String!
    
    """Commit message"""
    message: String!
    
    """Author name"""
    author: String!
    
    """Author email"""
    authorEmail: String!
    
    """Commit timestamp"""
    timestamp: String!
  }

  type Remote {
    """Remote name (e.g., origin)"""
    name: String!
    
    """Fetch URL"""
    fetchUrl: String!
    
    """Push URL"""
    pushUrl: String!
  }

  type RepositoryConfig {
    """Default branch name"""
    defaultBranch: String!
    
    """Whether this is a bare repository"""
    isBare: Boolean!
    
    """Whether this is a shallow clone"""
    isShallow: Boolean!
  }

  type Submodule {
    """Submodule name"""
    name: String!
    
    """Path relative to parent repository"""
    path: String!
    
    """Absolute path"""
    absolutePath: String!
    
    """Current commit hash"""
    hash: String!
    
    """Submodule URL"""
    url: String!
    
    """Whether submodule is initialized"""
    initialized: Boolean!
    
    """Git status if initialized"""
    status: GitStatus
  }

  type RepositoryDetails {
    """Repository name"""
    name: String!
    
    """Absolute path"""
    path: String!
    
    """Current git status"""
    status: GitStatus!
    
    """Repository statistics"""
    statistics: RepositoryStatistics!
    
    """Recent activity"""
    activity: RepositoryActivity!
  }

  type RepositoryStatistics {
    """Total number of commits"""
    totalCommits: Int!
    
    """Number of contributors"""
    contributors: Int!
    
    """Number of branches"""
    branches: Int!
    
    """Number of tags"""
    tags: Int!
    
    """Repository size in bytes"""
    sizeInBytes: Int!
  }

  type RepositoryActivity {
    """Last commit date"""
    lastCommitDate: String!
    
    """Most active contributor"""
    mostActiveContributor: String!
    
    """Recent branches"""
    recentBranches: [String!]!
  }

  type ScanStatistics {
    """Total number of repositories"""
    totalRepositories: Int!
    
    """Number of repositories with uncommitted changes"""
    dirtyRepositories: Int!
    
    """Total number of uncommitted files"""
    totalUncommittedFiles: Int!
    
    """Total additions across all repositories"""
    totalAdditions: Int!
    
    """Total deletions across all repositories"""
    totalDeletions: Int!
    
    """Changes grouped by type"""
    changesByType: ChangesByType!
  }

  type ChangesByType {
    """Number of modified files"""
    modified: Int!
    
    """Number of added files"""
    added: Int!
    
    """Number of deleted files"""
    deleted: Int!
    
    """Number of renamed files"""
    renamed: Int!
    
    """Number of untracked files"""
    untracked: Int!
  }

  type ScanMetadata {
    """When the scan started"""
    startTime: String!
    
    """When the scan completed"""
    endTime: String!
    
    """Duration in milliseconds"""
    duration: Int!
    
    """Workspace root path"""
    workspaceRoot: String!
  }

  type RepositoryCleanStatus {
    """Whether the repository is clean (no uncommitted changes)"""
    isClean: Boolean!
    
    """Number of uncommitted files"""
    uncommittedFiles: Int!
    
    """Latest commit hash"""
    latestCommitHash: String!
    
    """Repository path"""
    repository: String!
  }

  type CommitInfo {
    """Full commit hash"""
    hash: String!
    
    """Short commit hash"""
    shortHash: String!
    
    """Commit message"""
    message: String!
    
    """Author name"""
    author: String!
    
    """Commit timestamp"""
    timestamp: String!
    
    """Repository path"""
    repository: String!
  }

  # Input Types

  input GitCommandInput {
    """Git command to execute"""
    command: String!
    
    """Command arguments"""
    args: [String!]!
    
    """Working directory"""
    cwd: String!
  }

  input CommitInput {
    """Repository path"""
    repository: String!
    
    """Commit message"""
    message: String!
    
    """Specific files to commit (empty = all)"""
    files: [String!]
    
    """Stage all changes before committing"""
    stageAll: Boolean
    
    """Author name (optional)"""
    author: String
    
    """Author email (optional)"""
    authorEmail: String
  }

  input BatchCommitInput {
    """List of commits to perform"""
    commits: [CommitInput!]!
    
    """Continue on error"""
    continueOnError: Boolean
  }

  input PushInput {
    """Repository path"""
    repository: String!
    
    """Remote name (default: origin)"""
    remote: String
    
    """Branch to push (default: current)"""
    branch: String
    
    """Force push"""
    force: Boolean
  }

  # Result Types

  type GitCommandResult {
    """Whether the command succeeded"""
    success: Boolean!
    
    """Command output"""
    output: String
    
    """Error message if failed"""
    error: String
  }

  type CommitResult {
    """Whether the commit succeeded"""
    success: Boolean!
    
    """Commit hash if successful"""
    commitHash: String
    
    """Error message if failed"""
    error: String
    
    """Repository path"""
    repository: String!
    
    """Files that were committed"""
    committedFiles: [String!]!
    
    """Whether the repository is clean after commit"""
    isClean: Boolean @shareable
    
    """Number of remaining uncommitted files"""
    remainingFiles: Int @shareable
  }

  type BatchCommitResult {
    """Total number of repositories processed"""
    totalRepositories: Int!
    
    """Number of successful commits"""
    successCount: Int!
    
    """Individual commit results"""
    results: [CommitResult!]!
    
    """Total execution time in milliseconds"""
    executionTime: Int!
  }

  type PushResult {
    """Whether the push succeeded"""
    success: Boolean!
    
    """Remote that was pushed to"""
    remote: String!
    
    """Branch that was pushed"""
    branch: String!
    
    """Error message if failed"""
    error: String
    
    """Push summary from git"""
    summary: String
  }
`;

// Build the federated schema
export const schema = buildSubgraphSchema({ typeDefs });