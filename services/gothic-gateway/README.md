# Meta GOTHIC Gateway

The GraphQL Federation Gateway for the metaGOTHIC framework, unifying all microservices under a single GraphQL endpoint.

## Overview

This gateway federates the following services:
- **git-service** (port 3004): Git operations and repository management
- **claude-service** (port 3002): Claude AI integration and operations

## Features

- **GraphQL Federation**: Unified schema from multiple services
- **WebSocket Subscriptions**: Real-time updates via WebSocket
- **Health Checks**: Service health monitoring and status reporting
- **Rate Limiting**: Built-in rate limiting (100 requests/minute)
- **Error Handling**: Comprehensive error formatting and logging
- **Service Discovery**: Auto-discovery of federated services
- **Request Tracing**: Request ID tracking for debugging

## Getting Started

### Prerequisites

Ensure the following services are running:
1. `git-service` on port 3004
2. `claude-service` on port 3002

### Installation

```bash
cd services/gothic-gateway
npm install
```

### Development

```bash
# Start the gateway in development mode
npm run dev

# The gateway will be available at:
# - GraphQL endpoint: http://localhost:3000/graphql
# - GraphiQL playground: http://localhost:3000/graphiql
# - Health check: http://localhost:3000/health
# - Service discovery: http://localhost:3000/services
```

### Production

```bash
# Build the TypeScript code
npm run build

# Start the production server
npm start
```

## Configuration

Environment variables:
- `GATEWAY_PORT`: Gateway port (default: 3000)
- `GATEWAY_HOST`: Gateway host (default: 0.0.0.0)
- `LOG_LEVEL`: Logging level (default: info)
- `CORS_ORIGIN`: CORS allowed origin (default: http://localhost:3001)
- `NODE_ENV`: Environment (production disables GraphiQL)
- `REPO_AGENT_URL`: Repo agent service URL
- `CLAUDE_SERVICE_URL`: Claude service URL

## API Endpoints

### GraphQL
- **Endpoint**: `/graphql`
- **Method**: POST
- **WebSocket**: `ws://localhost:3000/graphql`

### Health Check
- **Endpoint**: `/health`
- **Method**: GET
- **Response**: Gateway and service health status

### Service Discovery
- **Endpoint**: `/services`
- **Method**: GET
- **Response**: List of federated services and their status

## Example Queries

### Unified Query
```graphql
query GetRepositoryWithAI {
  # From git-service
  gitStatus(path: "/path/to/repo") {
    branch
    files {
      path
      status
    }
  }
  
  # From claude-service
  sessions {
    id
    status
    createdAt
  }
}
```

### Subscription
```graphql
subscription WatchClaudeOutput {
  commandOutput(sessionId: "session-123") {
    type
    content
    timestamp
  }
}
```

## Error Handling

The gateway provides comprehensive error handling:
- Service unavailability detection
- Request timeout handling
- Rate limiting with retry information
- Detailed error logging with request IDs

## Development Tips

1. Use the GraphiQL playground for testing queries
2. Check `/health` endpoint to verify all services are running
3. Monitor logs for detailed request/response information
4. Use request IDs from logs for debugging

## Troubleshooting

### Gateway won't start
- Check if ports 3000, 3002, and 3004 are available
- Verify all dependent services are running
- Check logs for detailed error messages

### Service unavailable errors
- Verify the service is running on the correct port
- Check service health endpoint directly
- Review gateway logs for connection errors

### WebSocket connection issues
- Ensure WebSocket support is enabled in your client
- Check for proxy/firewall blocking WebSocket connections
- Verify CORS settings if connecting from a browser