# GitHub Federation Solution

## Problem
The health dashboard at http://localhost:3001/ was only showing GraphQL service health, not GitHub repository/pipeline data after the GraphQL migration.

## Solution
Implemented a federated GraphQL gateway that includes GitHub REST API through direct integration.

## What Was Done

### 1. Created GitHub-Enabled Gateway
- Created `yoga-mesh-gateway-github.ts` that includes:
  - Claude Service (GraphQL)
  - Repo Agent Service (GraphQL)
  - GitHub API (Direct REST integration)

### 2. Implemented GitHub Schema
Added GraphQL types and resolvers for:
- `githubUser` - Get authenticated user info
- `githubRepositories` - List user's repositories
- `githubRepository` - Get specific repository
- `githubWorkflows` - List workflows for a repo
- `githubWorkflowRuns` - List workflow runs

### 3. Created Combined Dashboard
- Created `CombinedHealthDashboard.tsx` that shows:
  - System health status
  - GraphQL service health
  - GitHub user information
  - Recent repositories with activity
  - System resource usage

### 4. Updated Service Scripts
- Modified `start-yoga-services.sh` to use the new gateway
- Gateway now properly picks up GitHub token from environment

## How It Works

1. The gateway at `http://localhost:3000/graphql` federates:
   - Local GraphQL services (Claude, Repo Agent)
   - GitHub REST API wrapped in GraphQL

2. The combined dashboard queries both:
   ```graphql
   # System health
   query { 
     health { 
       healthy 
       version 
       claudeAvailable 
     } 
   }
   
   # GitHub data
   query { 
     githubRepositories { 
       name 
       description 
       stargazersCount 
     } 
   }
   ```

3. GitHub authentication:
   - Token is read from `GITHUB_TOKEN` or `VITE_GITHUB_TOKEN` environment variables
   - Token is passed in Authorization header to GitHub API

## Benefits

1. **Unified GraphQL API**: All data accessible through single endpoint
2. **No OpenAPI complexity**: Direct REST integration is simpler and more reliable
3. **Flexible queries**: Can query exactly what's needed
4. **Real-time data**: Both service health and GitHub data update live
5. **Error resilience**: Dashboard continues to work even if GitHub queries fail

## Testing

Visit http://localhost:3001/ to see:
- System operational status
- Service health for all GraphQL services
- GitHub user profile (if authenticated)
- List of recent repositories
- System resource usage (CPU, Memory)

## Future Enhancements

1. Add GitHub Actions/Workflows to dashboard
2. Add repository commit activity graphs
3. Add pull request information
4. Add issue tracking
5. Cache GitHub responses to reduce API calls