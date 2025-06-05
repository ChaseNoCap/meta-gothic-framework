# PM2 Setup Guide for Meta-GOTHIC Framework

## Installation

```bash
# Install PM2 globally
npm install -g pm2

# Install tsx globally (required for running TypeScript)
npm install -g tsx
```

## Basic Commands

### Start All Services
```bash
# Start all services defined in ecosystem.config.js
pm2 start ecosystem.config.js

# Or start specific service
pm2 start ecosystem.config.js --only claude-service
```

### Service Management
```bash
# List all services
pm2 list

# Check detailed status
pm2 status

# Monitor services in real-time
pm2 monit

# View logs
pm2 logs                    # All services
pm2 logs claude-service     # Specific service
pm2 logs --lines 100       # Last 100 lines

# Restart services
pm2 restart all
pm2 restart claude-service

# Stop services
pm2 stop all
pm2 stop claude-service

# Delete services from PM2
pm2 delete all
```

### Advanced Features

```bash
# Save current process list
pm2 save

# Resurrect saved process list on reboot
pm2 startup
pm2 save

# Scale services (if configured)
pm2 scale gateway 2

# Reload with zero downtime
pm2 reload all

# View service details
pm2 describe claude-service

# Dashboard
pm2 web  # Starts web dashboard on port 9615
```

## Benefits Over Current Approach

1. **Process Persistence**: Services keep running after terminal closes
2. **Auto-Restart**: Crashed services restart automatically
3. **Log Management**: Centralized, rotated logs with timestamps
4. **Memory Management**: Auto-restart on memory threshold
5. **Load Balancing**: Can run multiple instances of a service
6. **Monitoring**: Built-in CPU/memory monitoring
7. **Zero-Downtime Reload**: Update code without dropping connections

## Example Workflow

```bash
# Initial setup
cd /path/to/meta-gothic-framework
pm2 start ecosystem.config.js

# Check everything is running
pm2 list

# Monitor in real-time
pm2 monit

# When you need to stop for development
pm2 stop all

# When done developing
pm2 delete all
```

## Integration with Existing Scripts

You could update your npm scripts:

```json
{
  "scripts": {
    "pm2:start": "pm2 start ecosystem.config.js",
    "pm2:stop": "pm2 stop all",
    "pm2:restart": "pm2 restart all",
    "pm2:logs": "pm2 logs",
    "pm2:monit": "pm2 monit",
    "pm2:status": "pm2 list"
  }
}
```

## Development vs Production

For development, you might want:
- `watch: true` in ecosystem.config.js for auto-reload
- More verbose logging
- No clustering

For production:
- `instances: 'max'` for clustering
- Log rotation configured
- Monitoring alerts set up