# Dashboard Status - Health Page Issue

## Current State
The health dashboard at http://localhost:3001/ is currently showing only GraphQL service health information, not GitHub repository/pipeline data.

## What's Happening
1. The app has been migrated to use GraphQL services
2. The root path (`/`) shows `HealthDashboardGraphQL` component
3. This component is designed to show "Monitor the health of GraphQL services in real-time"
4. It's currently showing:
   - System status (Operational/Degraded)
   - Service count
   - Uptime
   - Individual GraphQL service health

## Where to Find Repository/Pipeline Data
Based on the routing configuration:
- **Pipeline Control**: Navigate to http://localhost:3001/pipelines
- **Repository Status**: Navigate to http://localhost:3001/tools/repository-status
- **Agent Status**: Navigate to http://localhost:3001/agent-status

## Quick Fix Applied
Fixed the HealthDashboardGraphQL component to:
1. Use the correct `health` query instead of `systemHealth`
2. Mock service data since the basic health query doesn't provide detailed service info
3. Display basic system health information

## To Restore Full GitHub Data on Home Page
If you want the home page to show GitHub repository data like before, you would need to either:
1. Navigate to `/pipelines` for pipeline data
2. Navigate to `/tools/repository-status` for repository status
3. Or modify the root route to show a different component that includes GitHub data

## Navigation
The app has a Navigation component that should provide links to all these sections. Check the navigation menu to easily access different parts of the dashboard.