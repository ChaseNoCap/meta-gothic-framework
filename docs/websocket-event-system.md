# WebSocket Event System Documentation

## Overview

The Meta-GOTHIC framework now includes a real-time WebSocket event system that broadcasts all system events to connected clients. This enables real-time monitoring, debugging, and dashboard updates.

## Architecture

### Components

1. **Event Broadcaster** (`EventBroadcaster`)
   - WebSocket server at `/ws/events`
   - Manages client connections and subscriptions
   - Filters and broadcasts events based on subscriptions

2. **Event Bus Integration**
   - Global event bus forwards all events to broadcaster
   - Request-scoped buses forward to global bus
   - Maintains correlation ID through event flow

3. **Client Management**
   - Each client has unique ID
   - Supports selective event subscriptions
   - Correlation ID filtering for request tracking

## Connecting to the Event Stream

### WebSocket Endpoint
```
ws://localhost:3000/ws/events
```

### Connection Example (JavaScript)
```javascript
const ws = new WebSocket('ws://localhost:3000/ws/events', {
  headers: {
    'x-correlation-id': 'optional-correlation-id'
  }
});

ws.on('open', () => {
  console.log('Connected to event stream');
});

ws.on('message', (data) => {
  const event = JSON.parse(data.toString());
  console.log('Event received:', event);
});
```

## Protocol

### Client Messages

#### Subscribe to Events
```json
{
  "type": "subscribe",
  "payload": {
    "eventTypes": [
      "claude.*",           // All Claude events
      "repo.commit.created", // Specific event
      "performance.*"        // All performance events
    ],
    "correlationId": "optional-id"
  }
}
```

#### Unsubscribe from Events
```json
{
  "type": "unsubscribe",
  "payload": {
    "eventTypes": ["claude.*"]
  }
}
```

#### Ping/Pong (Keep-alive)
```json
{
  "type": "ping",
  "payload": { "timestamp": 1234567890 }
}
```

### Server Messages

#### Welcome Message
```json
{
  "type": "websocket.connected",
  "timestamp": 1234567890,
  "payload": {
    "clientId": "ws-123456-abc",
    "correlationId": "if-provided"
  }
}
```

#### Subscription Confirmation
```json
{
  "type": "websocket.subscribed",
  "timestamp": 1234567890,
  "payload": {
    "eventTypes": ["claude.*", "repo.*"],
    "subscriptions": ["*", "claude.*", "repo.*"]
  }
}
```

#### System Events
All events follow the structure:
```json
{
  "type": "service.entity.action",
  "timestamp": 1234567890,
  "payload": {
    "correlationId": "request-id",
    // Event-specific data
  }
}
```

## Event Categories

### Claude Service Events
- `claude.session.started`
- `claude.session.completed`
- `claude.session.failed`
- `claude.command.executed`
- `claude.agentRun.progress`

### Repository Service Events
- `repo.status.queried`
- `repo.commit.created`
- `repo.push.completed`
- `repo.scan.completed`

### GitHub API Events
- `github.api.started`
- `github.api.completed`
- `github.workflow.triggered`

### GraphQL Events
- `graphql.query.started`
- `graphql.query.completed`
- `graphql.mutation.started`
- `graphql.mutation.completed`
- `graphql.subscription.started`
- `graphql.subscription.completed`

### Performance Events
- `performance.slowOperation.detected`

## Subscription Patterns

### Subscribe to All Events
```json
{ "eventTypes": ["*"] }
```

### Subscribe to Service Category
```json
{ "eventTypes": ["claude.*", "repo.*"] }
```

### Subscribe to Specific Events
```json
{ "eventTypes": ["repo.commit.created", "github.workflow.triggered"] }
```

### Correlation-based Filtering
Events are automatically filtered by correlation ID if provided in connection headers or subscription.

## Client Examples

### Node.js Client
See: `services/meta-gothic-app/examples/websocket-client.ts`

### Browser Dashboard
Open: `services/meta-gothic-app/examples/event-dashboard.html`

### Test Script
```bash
cd services/meta-gothic-app
./test-websocket.sh
```

## Use Cases

### 1. Real-time Monitoring
- Track all system operations in real-time
- Monitor performance issues as they occur
- Watch GitHub API rate limits

### 2. Request Tracing
- Follow a specific request through all services
- Debug complex operation flows
- Analyze performance bottlenecks

### 3. Dashboard Updates
- Update UI components without polling
- Show live operation status
- Display real-time metrics

### 4. Debugging
- Capture all events for a specific operation
- Replay event sequences
- Identify failure points

## Performance Considerations

1. **Event Volume**: High-frequency events may overwhelm clients
2. **Filtering**: Use specific subscriptions to reduce traffic
3. **Connection Limits**: Monitor concurrent WebSocket connections
4. **Memory Usage**: Events are not persisted in memory indefinitely

## Security Considerations

1. **Authentication**: Currently no authentication (add for production)
2. **Event Data**: Ensure sensitive data is not exposed in events
3. **Rate Limiting**: Consider adding connection rate limits
4. **CORS**: WebSocket connections bypass CORS

## Integration with Services

### Adding Event Broadcasting to a Service

1. Import and create event bus:
```typescript
import { createRequestEventBus } from './eventBus.js';
const eventBus = createRequestEventBus(correlationId);
```

2. Use @Emits decorators:
```typescript
@Emits('service.operation.started')
async performOperation() { /* ... */ }
```

3. Events automatically flow to WebSocket clients

## Troubleshooting

### Connection Issues
- Ensure gateway is running on port 3000
- Check firewall settings for WebSocket connections
- Verify `/ws/events` path is correct

### Missing Events
- Check subscription patterns
- Verify correlation ID if filtering
- Ensure event bus is properly connected

### Performance Issues
- Reduce subscription scope
- Implement client-side throttling
- Monitor event volume

## Future Enhancements

1. **Authentication**: Add JWT-based auth for WebSocket connections
2. **Persistence**: Store events for replay and analysis
3. **Compression**: Implement message compression for high volume
4. **Clustering**: Support multi-instance deployments
5. **Metrics**: Add WebSocket connection metrics