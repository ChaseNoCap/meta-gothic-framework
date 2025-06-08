# Meta-GOTHIC Observability Platform

## Overview

The Meta-GOTHIC Observability Platform provides comprehensive monitoring and debugging capabilities for the entire framework. It offers real-time insights into logs, events, performance metrics, and AI operations through a unified web dashboard.

## Architecture

### Components

1. **Web Dashboard** (`services/observability-dashboard/`)
   - Real-time log streaming
   - Event flow visualization
   - Performance analytics
   - Request tracing
   - AI operation monitoring

2. **WebSocket Integration**
   - Connects to gateway WebSocket at `ws://localhost:3000/ws/events`
   - Receives all system events in real-time
   - Automatic reconnection on disconnect

3. **Data Collection**
   - Logs from all services via structured logging
   - Events from event-driven architecture
   - Performance metrics from @Traces decorators
   - AI operation details from Claude service

## Features

### 1. Log Analysis Dashboard
- **Real-time streaming** of logs from all services
- **Filtering** by level (error, warn, info, debug)
- **Service filtering** (claude-service, repo-agent, gateway)
- **Search functionality** for finding specific log entries
- **Correlation ID tracking** in log metadata

### 2. Event Stream Visualization
- **Live event table** showing all system events
- **Event categorization** by service and type
- **Duration tracking** for completed operations
- **Event details viewer** for payload inspection

### 3. Request Tracing
- **Correlation ID search** to trace entire request flow
- **Timeline view** showing each step in the request
- **Service attribution** for each operation
- **Error highlighting** for failed steps
- **Payload inspection** at each step

### 4. Performance Analytics
- **Response time chart** showing trends over time
- **Operations per minute** bar chart
- **Slow operation detection** table
- **Threshold monitoring** for performance degradation

### 5. AI Operations Monitoring
- **Active session tracking**
- **Token usage analytics** with cost estimation
- **Operation history** with success/failure status
- **Input/output token breakdown**

## Getting Started

### Prerequisites
1. Ensure all services are running:
   ```bash
   cd services
   ./start-yoga-services.sh
   ```

2. Verify WebSocket endpoint is available:
   ```bash
   curl http://localhost:3000/graphql
   ```

### Starting the Dashboard

```bash
cd services
./start-observability.sh
```

The dashboard will be available at: http://localhost:3005

### Alternative: Direct Access
You can also open the dashboard HTML file directly:
```bash
open services/observability-dashboard/index.html
```

Note: Direct file access may have CORS limitations for WebSocket connections.

## Usage Guide

### Viewing Logs
1. Navigate to the **Logs** tab
2. Use filters to narrow down log entries:
   - Level: error, warn, info, debug
   - Service: claude-service, repo-agent, gateway
   - Search: Enter keywords to filter
3. Logs auto-scroll as new entries arrive

### Tracing Requests
1. Navigate to the **Request Traces** tab
2. Enter a correlation ID in the search box
3. Press Enter to load the trace
4. View the complete request flow with timings

### Monitoring Performance
1. Navigate to the **Performance** tab
2. View real-time response time trends
3. Check operations per minute metrics
4. Review slow operations table for bottlenecks

### AI Operations
1. Navigate to the **AI Operations** tab
2. Monitor active Claude sessions
3. Track token usage and estimated costs
4. Review operation history and success rates

## Event Categories

### Service Events
- `claude.*` - Claude service operations
- `repo.*` - Repository operations
- `github.*` - GitHub API calls
- `graphql.*` - GraphQL operations

### System Events
- `performance.*` - Performance alerts
- `log.entry` - Log entries as events
- `websocket.*` - WebSocket meta events

## Metrics Tracked

### Performance Metrics
- Total events processed
- Error count
- Average response time
- Active operations count
- Operations per minute

### AI Metrics
- Active Claude sessions
- Total tokens processed
- Estimated cost (input/output pricing)
- Success/failure rates

## Troubleshooting

### Dashboard Not Loading
1. Check if observability server is running on port 3005
2. Verify no other service is using that port
3. Check browser console for errors

### No Events Showing
1. Ensure gateway is running on port 4000
2. Check WebSocket connection status (top right)
3. Verify services are generating events
4. Check browser console for WebSocket errors

### Missing Logs
1. Ensure services are using structured logging
2. Check if log level filtering is too restrictive
3. Verify services are running and generating logs

### Performance Issues
1. Clear old data using "Clear All" button
2. Reduce event retention (default: 1000 events)
3. Close unused tabs to reduce processing

## Architecture Details

### Data Flow
1. Services emit events via @Emits decorators
2. Events flow through event bus to WebSocket
3. Dashboard receives events via WebSocket
4. Events are processed and categorized
5. UI updates in real-time

### Storage
- All data is stored in browser memory
- No persistence between sessions
- Data cleared on page refresh
- Manual clear via "Clear All" button

### Performance Considerations
- Events limited to last 1000 entries
- Logs limited to last 500 entries
- Charts show last 20-100 data points
- Automatic cleanup of old data

## Future Enhancements

1. **Data Persistence**
   - Store events in database
   - Historical analysis capabilities
   - Long-term trend analysis

2. **Advanced Analytics**
   - Machine learning for anomaly detection
   - Predictive performance alerts
   - Cost optimization recommendations

3. **Export Capabilities**
   - Export traces as JSON
   - Generate performance reports
   - Share dashboard snapshots

4. **Integration**
   - Slack/Discord notifications
   - PagerDuty integration
   - Custom webhooks

## Development

### Adding New Metrics
1. Update event types in `shared/event-types.ts`
2. Add handlers in `observability.js`
3. Create UI components in dashboard
4. Update documentation

### Extending the Dashboard
The dashboard uses:
- Bootstrap 5 for UI components
- Chart.js for visualizations
- Vanilla JavaScript for simplicity
- WebSocket API for real-time data

### Contributing
1. Keep the dashboard lightweight
2. Maintain real-time responsiveness
3. Follow existing UI patterns
4. Update documentation for new features