# Meta GOTHIC Federation Gateway

## Overview

The Meta GOTHIC Federation Gateway provides a unified GraphQL API that combines the Git operations service (repo-agent) and Claude AI service into a single endpoint. This gateway implements the Apollo Federation specification using Mercurius.

## Architecture

```
┌─────────────────┐
│   UI Client     │
│  (Port 3001)    │
└────────┬────────┘
         │ GraphQL Queries/Mutations/Subscriptions
         ▼
┌─────────────────┐
│Federation Gateway│
│  (Port 3000)    │
└────┬───────┬────┘
     │       │
     ▼       ▼
┌─────────┐ ┌─────────┐
│Repo Agent│ │ Claude  │
│ Service │ │ Service │
│ (3004)  │ │ (3002)  │
└─────────┘ └─────────┘
```

## Features

### 1. Service Federation
- Combines multiple GraphQL services into a single schema
- Automatic service discovery and health checks
- Schema polling for hot reloading (2-second interval)
- Service-level error handling with custom messages

### 2. Performance Optimizations
- Request-level caching
- Query depth limiting (max 7 levels)
- Query complexity analysis
- Connection pooling for downstream services
- Parallel query execution

### 3. Security Features
- Rate limiting (100 requests/minute per IP)
- Query depth validation
- Request ID tracing
- Authorization header forwarding
- CORS configuration

### 4. Monitoring & Observability
- Health check endpoint (`/health`)
- Service discovery endpoint (`/services`)
- Metrics endpoint (`/metrics`)
- Request logging with duration tracking
- Error tracking and reporting

### 5. Developer Experience
- GraphiQL playground in development
- Detailed error messages
- Service status visibility
- WebSocket support for subscriptions

## Available Endpoints

### REST Endpoints
- `GET /health` - Gateway health status
- `GET /services` - Service discovery and status
- `GET /metrics` - Performance metrics

### GraphQL Endpoints
- `POST /graphql` - Main GraphQL endpoint
- `WS /graphql` - WebSocket endpoint for subscriptions
- `GET /graphiql` - Interactive GraphQL playground

## Configuration

Environment variables:
- `GATEWAY_PORT` - Gateway port (default: 3000)
- `GATEWAY_HOST` - Gateway host (default: 0.0.0.0)
- `REPO_AGENT_URL` - Repo agent service URL (default: http://localhost:3004/graphql)
- `CLAUDE_SERVICE_URL` - Claude service URL (default: http://localhost:3002/graphql)
- `CORS_ORIGIN` - CORS allowed origin (default: http://localhost:3001)
- `LOG_LEVEL` - Logging level (default: info)
- `NODE_ENV` - Environment (production disables GraphiQL)

## Running the Gateway

### Development Mode (Simple Gateway)
```bash
npm run dev
```

### Federation Mode
```bash
npm run dev:federation
```

### Production Mode
```bash
npm run build
npm start
```

### Run All Services
```bash
cd ../..
./services/start-all-services.sh
```

## Testing

### Quick Test
```bash
./test-federation.sh
```

### Manual Testing

1. Check health:
```bash
curl http://localhost:3000/health
```

2. Check services:
```bash
curl http://localhost:3000/services | jq
```

3. Test GraphQL query:
```bash
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ health { status claudeAvailable } }"}'
```

## Error Handling

The gateway provides custom error handling for common scenarios:

1. **Service Unavailable**: When a downstream service is not running
   ```
   Service [name] is not available. Please ensure it's running.
   ```

2. **Service Timeout**: When a service takes too long to respond
   ```
   Service [name] timed out. The operation took too long.
   ```

3. **Query Too Deep**: When query exceeds depth limit
   ```
   Query depth X exceeds maximum allowed depth of 7
   ```

4. **Rate Limited**: When client exceeds rate limit
   ```
   Rate limit exceeded. Please try again later.
   ```

## Monitoring

### Metrics Available
- Total requests
- GraphQL requests
- Error count
- Average response time
- P95 response time
- P99 response time

### Service Status
Each service reports:
- Name
- URL
- Health status
- Response time
- WebSocket URL

## Troubleshooting

### Gateway won't start
1. Check if port 3000 is available
2. Ensure all required services are running
3. Check logs: `tail -f /tmp/meta-gothic-gateway.log`

### Service connection errors
1. Verify services are running on correct ports
2. Check service health endpoints directly
3. Review gateway logs for connection details

### Query failures
1. Check GraphiQL for schema availability
2. Verify query syntax and depth
3. Check rate limiting status
4. Review service-specific errors in response

## Development Tips

1. **Hot Reloading**: The gateway polls for schema changes every 2 seconds
2. **Debugging**: Set `LOG_LEVEL=debug` for detailed logs
3. **Testing Subscriptions**: Use GraphiQL playground for WebSocket testing
4. **Performance Testing**: Monitor `/metrics` endpoint during load tests

## Next Steps

- [ ] Add caching layer with Redis
- [ ] Implement query batching
- [ ] Add distributed tracing
- [ ] Enhanced authentication/authorization
- [ ] Query cost analysis
- [ ] Schema versioning support