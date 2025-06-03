// Meta-GOTHIC Observability Platform
// Real-time monitoring for logs, events, and performance

class ObservabilityDashboard {
    constructor() {
        this.ws = null;
        this.logs = [];
        this.events = [];
        this.traces = new Map();
        this.metrics = {
            totalEvents: 0,
            errorCount: 0,
            responseTimes: [],
            activeOperations: new Set(),
            slowOperations: [],
            aiOperations: []
        };
        
        this.charts = {};
        this.initializeCharts();
        this.connectWebSocket();
        this.attachEventListeners();
        this.startMetricsUpdate();
    }

    connectWebSocket() {
        const wsUrl = 'ws://localhost:3000/ws/events';
        console.log('Connecting to WebSocket:', wsUrl);
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.updateConnectionStatus(true);
            
            // Subscribe to all events
            this.ws.send(JSON.stringify({
                type: 'subscribe',
                payload: { eventTypes: ['*'] }
            }));
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleEvent(data);
            } catch (error) {
                console.error('Failed to parse event:', error);
            }
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.updateConnectionStatus(false);
            setTimeout(() => this.connectWebSocket(), 5000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus(false);
        };
    }

    updateConnectionStatus(connected) {
        const indicator = document.getElementById('wsStatus');
        const text = document.getElementById('wsStatusText');
        
        if (connected) {
            indicator.className = 'status-indicator status-active';
            text.textContent = 'Connected';
        } else {
            indicator.className = 'status-indicator status-error';
            text.textContent = 'Disconnected';
        }
    }

    handleEvent(event) {
        // Skip WebSocket meta events
        if (event.type.startsWith('websocket.')) return;
        
        // Update metrics
        this.metrics.totalEvents++;
        this.events.unshift(event);
        if (this.events.length > 1000) this.events.pop();
        
        // Extract log from event if it's a log event
        if (event.type === 'log.entry') {
            this.handleLogEntry(event.payload);
        }
        
        // Track errors
        if (event.type.includes('.failed') || event.type.includes('.error')) {
            this.metrics.errorCount++;
        }
        
        // Track performance
        if (event.type.endsWith('.completed') && event.payload?.duration) {
            this.metrics.responseTimes.push({
                time: new Date(),
                duration: event.payload.duration,
                operation: event.type
            });
            
            // Keep only last 100 response times
            if (this.metrics.responseTimes.length > 100) {
                this.metrics.responseTimes.shift();
            }
        }
        
        // Track slow operations
        if (event.type === 'performance.slowOperation.detected') {
            this.metrics.slowOperations.unshift({
                ...event.payload,
                timestamp: new Date()
            });
        }
        
        // Track AI operations
        if (event.type.startsWith('claude.')) {
            this.handleAIOperation(event);
        }
        
        // Update trace information
        if (event.payload?.correlationId) {
            this.updateTrace(event.payload.correlationId, event);
        }
        
        // Update UI based on active tab
        const activeTab = document.querySelector('.nav-link.active').id;
        switch (activeTab) {
            case 'events-tab':
                this.updateEventStream(event);
                break;
            case 'performance-tab':
                this.updatePerformanceMetrics();
                break;
            case 'ai-tab':
                this.updateAIMetrics();
                break;
        }
        
        // Update metrics display
        this.updateMetricsDisplay();
    }

    handleLogEntry(logData) {
        this.logs.unshift({
            timestamp: new Date(),
            level: logData.level || 'info',
            service: logData.service || 'unknown',
            message: logData.message || '',
            metadata: logData.metadata || {}
        });
        
        // Keep only last 500 logs
        if (this.logs.length > 500) this.logs.pop();
        
        // Update log display if on logs tab
        if (document.getElementById('logs-tab').classList.contains('active')) {
            this.updateLogDisplay();
        }
    }

    handleAIOperation(event) {
        if (event.type === 'claude.command.executed') {
            this.metrics.aiOperations.unshift({
                timestamp: new Date(),
                sessionId: event.payload.sessionId,
                operation: 'command',
                inputTokens: event.payload.tokenCount?.input || 0,
                outputTokens: event.payload.tokenCount?.output || 0,
                duration: event.payload.duration,
                success: event.payload.success
            });
            
            // Keep only last 100 AI operations
            if (this.metrics.aiOperations.length > 100) {
                this.metrics.aiOperations.shift();
            }
        }
    }

    updateTrace(correlationId, event) {
        if (!this.traces.has(correlationId)) {
            this.traces.set(correlationId, []);
        }
        
        const trace = this.traces.get(correlationId);
        trace.push({
            timestamp: new Date(event.timestamp),
            type: event.type,
            service: this.getServiceFromEventType(event.type),
            payload: event.payload
        });
        
        // Sort trace by timestamp
        trace.sort((a, b) => a.timestamp - b.timestamp);
    }

    getServiceFromEventType(eventType) {
        if (eventType.startsWith('claude.')) return 'claude-service';
        if (eventType.startsWith('repo.')) return 'repo-agent';
        if (eventType.startsWith('graphql.')) return 'gateway';
        if (eventType.startsWith('github.')) return 'gateway';
        return 'unknown';
    }

    updateLogDisplay() {
        const container = document.getElementById('logContainer');
        const levelFilter = document.getElementById('logLevelFilter').value;
        const serviceFilter = document.getElementById('logServiceFilter').value;
        const searchTerm = document.getElementById('logSearch').value.toLowerCase();
        
        const filteredLogs = this.logs.filter(log => {
            if (levelFilter && log.level !== levelFilter) return false;
            if (serviceFilter && log.service !== serviceFilter) return false;
            if (searchTerm && !log.message.toLowerCase().includes(searchTerm)) return false;
            return true;
        });
        
        container.innerHTML = filteredLogs.slice(0, 100).map(log => `
            <div class="log-entry log-level-${log.level}">
                <span class="text-muted">${log.timestamp.toLocaleTimeString()}</span>
                <span class="badge bg-${this.getLevelColor(log.level)} ms-2">${log.level.toUpperCase()}</span>
                <span class="text-info ms-2">[${log.service}]</span>
                <span class="ms-2">${this.escapeHtml(log.message)}</span>
                ${log.metadata.correlationId ? `<span class="text-muted ms-2">(${log.metadata.correlationId})</span>` : ''}
            </div>
        `).join('');
    }

    updateEventStream(event) {
        const tbody = document.getElementById('eventTableBody');
        const row = document.createElement('tr');
        
        const eventCategory = event.type.split('.')[0];
        const time = new Date(event.timestamp).toLocaleTimeString();
        
        row.innerHTML = `
            <td>${time}</td>
            <td><span class="badge bg-${this.getCategoryColor(eventCategory)}">${event.type}</span></td>
            <td>${this.getServiceFromEventType(event.type)}</td>
            <td>${event.payload?.correlationId || '-'}</td>
            <td>${event.payload?.duration ? event.payload.duration + 'ms' : '-'}</td>
            <td>
                <button class="btn btn-sm btn-outline-info" onclick="viewEventDetails('${btoa(JSON.stringify(event))}')">
                    <i class="ti ti-eye"></i>
                </button>
            </td>
        `;
        
        tbody.insertBefore(row, tbody.firstChild);
        
        // Keep only 50 rows
        while (tbody.children.length > 50) {
            tbody.removeChild(tbody.lastChild);
        }
        
        // Update event flow visualization
        this.updateEventFlow(event);
    }

    updateEventFlow(event) {
        // This would implement a visual flow diagram
        // For now, we'll skip the complex visualization
    }

    updatePerformanceMetrics() {
        // Update response time chart
        const ctx = document.getElementById('responseTimeChart').getContext('2d');
        const times = this.metrics.responseTimes.slice(-20);
        
        this.charts.responseTime.data.labels = times.map(t => t.time.toLocaleTimeString());
        this.charts.responseTime.data.datasets[0].data = times.map(t => t.duration);
        this.charts.responseTime.update();
        
        // Update slow operations table
        const tbody = document.getElementById('slowOpsTableBody');
        tbody.innerHTML = this.metrics.slowOperations.slice(0, 10).map(op => `
            <tr>
                <td>${op.timestamp.toLocaleTimeString()}</td>
                <td>${op.operation}</td>
                <td class="text-warning">${op.duration}ms</td>
                <td>${op.threshold}ms</td>
                <td>${op.service}</td>
                <td>${op.correlationId || '-'}</td>
            </tr>
        `).join('');
    }

    updateAIMetrics() {
        // Calculate totals
        const totalTokens = this.metrics.aiOperations.reduce((sum, op) => 
            sum + op.inputTokens + op.outputTokens, 0);
        
        // Rough cost estimate (Claude pricing)
        const inputCost = this.metrics.aiOperations.reduce((sum, op) => 
            sum + (op.inputTokens * 0.003 / 1000), 0);
        const outputCost = this.metrics.aiOperations.reduce((sum, op) => 
            sum + (op.outputTokens * 0.015 / 1000), 0);
        
        document.getElementById('totalTokens').textContent = totalTokens.toLocaleString();
        document.getElementById('estimatedCost').textContent = `$${(inputCost + outputCost).toFixed(2)}`;
        
        // Update AI operations table
        const tbody = document.getElementById('aiOpsTableBody');
        tbody.innerHTML = this.metrics.aiOperations.slice(0, 10).map(op => `
            <tr>
                <td>${op.timestamp.toLocaleTimeString()}</td>
                <td>${op.sessionId}</td>
                <td>${op.operation}</td>
                <td>${op.inputTokens}</td>
                <td>${op.outputTokens}</td>
                <td>${op.duration || '-'}ms</td>
                <td>
                    <span class="badge bg-${op.success ? 'success' : 'danger'}">
                        ${op.success ? 'Success' : 'Failed'}
                    </span>
                </td>
            </tr>
        `).join('');
    }

    updateMetricsDisplay() {
        document.getElementById('totalEvents').textContent = this.metrics.totalEvents.toLocaleString();
        document.getElementById('errorCount').textContent = this.metrics.errorCount.toLocaleString();
        
        // Calculate average response time
        if (this.metrics.responseTimes.length > 0) {
            const avg = this.metrics.responseTimes.reduce((sum, t) => sum + t.duration, 0) / 
                       this.metrics.responseTimes.length;
            document.getElementById('avgResponseTime').textContent = Math.round(avg) + 'ms';
        }
        
        // Active operations (simplified - count events without completion)
        document.getElementById('activeOperations').textContent = this.metrics.activeOperations.size;
    }

    searchCorrelationId() {
        const correlationId = document.getElementById('correlationSearch').value.trim();
        if (!correlationId) return;
        
        const trace = this.traces.get(correlationId);
        const traceView = document.getElementById('traceView');
        
        if (!trace || trace.length === 0) {
            traceView.innerHTML = `
                <div class="alert alert-warning">
                    No trace found for correlation ID: ${correlationId}
                </div>
            `;
            return;
        }
        
        const startTime = trace[0].timestamp;
        traceView.innerHTML = trace.map((step, index) => {
            const duration = step.timestamp - startTime;
            const isError = step.type.includes('.failed') || step.type.includes('.error');
            const isSuccess = step.type.includes('.completed');
            
            return `
                <div class="trace-step ${isError ? 'error' : isSuccess ? 'success' : ''}">
                    <div class="d-flex justify-content-between">
                        <div>
                            <strong>${index + 1}. ${step.type}</strong>
                            <div class="text-muted small">${step.service}</div>
                        </div>
                        <div class="text-end">
                            <div>${step.timestamp.toLocaleTimeString()}</div>
                            <div class="text-muted small">+${duration}ms</div>
                        </div>
                    </div>
                    ${step.payload ? `
                        <div class="mt-2">
                            <pre class="small mb-0">${JSON.stringify(step.payload, null, 2)}</pre>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    initializeCharts() {
        // Response Time Chart
        const responseTimeCtx = document.getElementById('responseTimeChart')?.getContext('2d');
        if (responseTimeCtx) {
            this.charts.responseTime = new Chart(responseTimeCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Response Time (ms)',
                        data: [],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }
        
        // Operations per Minute Chart
        const opsCtx = document.getElementById('opsPerMinuteChart')?.getContext('2d');
        if (opsCtx) {
            this.charts.opsPerMinute = new Chart(opsCtx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Operations',
                        data: [],
                        backgroundColor: '#10b981'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }
    }

    attachEventListeners() {
        // Log filters
        document.getElementById('logLevelFilter')?.addEventListener('change', () => this.updateLogDisplay());
        document.getElementById('logServiceFilter')?.addEventListener('change', () => this.updateLogDisplay());
        document.getElementById('logSearch')?.addEventListener('input', () => this.updateLogDisplay());
        
        // Correlation ID search
        document.getElementById('correlationSearch')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchCorrelationId();
        });
    }

    startMetricsUpdate() {
        // Update operations per minute
        setInterval(() => {
            const now = new Date();
            const oneMinuteAgo = new Date(now - 60000);
            
            const recentEvents = this.events.filter(e => 
                new Date(e.timestamp) > oneMinuteAgo
            );
            
            // Update ops chart
            if (this.charts.opsPerMinute) {
                const minutes = [];
                const counts = [];
                
                for (let i = 4; i >= 0; i--) {
                    const start = new Date(now - (i + 1) * 60000);
                    const end = new Date(now - i * 60000);
                    
                    const count = this.events.filter(e => {
                        const time = new Date(e.timestamp);
                        return time >= start && time < end;
                    }).length;
                    
                    minutes.push(start.toLocaleTimeString());
                    counts.push(count);
                }
                
                this.charts.opsPerMinute.data.labels = minutes;
                this.charts.opsPerMinute.data.datasets[0].data = counts;
                this.charts.opsPerMinute.update();
            }
        }, 5000);
    }

    getLevelColor(level) {
        switch (level) {
            case 'error': return 'danger';
            case 'warn': return 'warning';
            case 'info': return 'info';
            case 'debug': return 'secondary';
            default: return 'primary';
        }
    }

    getCategoryColor(category) {
        switch (category) {
            case 'claude': return 'primary';
            case 'repo': return 'success';
            case 'github': return 'info';
            case 'graphql': return 'warning';
            case 'performance': return 'danger';
            default: return 'secondary';
        }
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}

// Initialize dashboard
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new ObservabilityDashboard();
});

// Global functions
function clearAllData() {
    if (confirm('Clear all collected data?')) {
        dashboard.logs = [];
        dashboard.events = [];
        dashboard.traces.clear();
        dashboard.metrics = {
            totalEvents: 0,
            errorCount: 0,
            responseTimes: [],
            activeOperations: new Set(),
            slowOperations: [],
            aiOperations: []
        };
        location.reload();
    }
}

function viewEventDetails(encodedEvent) {
    const event = JSON.parse(atob(encodedEvent));
    alert(JSON.stringify(event, null, 2));
}