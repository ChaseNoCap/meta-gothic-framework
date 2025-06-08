#!/bin/bash

# Claude Service Health Monitor
# This script monitors the health of the Claude service and can trigger restarts if needed

SERVICE_NAME="claude-service"
HEALTH_URL="http://localhost:3002/health"
LOG_FILE="/Users/josh/Documents/meta-gothic-framework/logs/claude-service/health-monitor.log"
MAX_ERRORS=5
CHECK_INTERVAL=30

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_health() {
    # Try to get health status
    response=$(curl -s -w "\n%{http_code}" "$HEALTH_URL" 2>/dev/null)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" != "200" ]; then
        log "ERROR: Health check failed with HTTP $http_code"
        return 1
    fi
    
    # Parse JSON response (basic check)
    status=$(echo "$body" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    errors=$(echo "$body" | grep -o '"recentErrors":[0-9]*' | cut -d':' -f2)
    
    if [ "$status" = "degraded" ] || [ "$errors" -gt "$MAX_ERRORS" ]; then
        log "WARNING: Service is degraded (status: $status, errors: $errors)"
        return 1
    fi
    
    log "INFO: Service is healthy (status: $status, errors: $errors)"
    return 0
}

# Main monitoring loop
log "Starting health monitor for $SERVICE_NAME"

while true; do
    if ! check_health; then
        log "WARNING: Health check failed, checking PM2 status..."
        
        # Check if service is running in PM2
        pm2_status=$(pm2 jlist | jq -r ".[] | select(.name==\"$SERVICE_NAME\") | .pm2_env.status")
        
        if [ "$pm2_status" != "online" ]; then
            log "ERROR: Service is not online (status: $pm2_status), attempting restart..."
            pm2 restart "$SERVICE_NAME"
            
            # Wait for service to come back up
            sleep 10
        fi
    fi
    
    sleep "$CHECK_INTERVAL"
done