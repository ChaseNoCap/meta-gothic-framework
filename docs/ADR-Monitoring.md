# ADR-Monitoring: CI/CD Dashboard and Metrics Collection

**Status**: Accepted  
**Date**: 2024-05-15 (Renamed 2025-01-06)  
**Original**: ADR-004

## Context

The metaGOTHIC framework consists of multiple packages across different repositories. We need a systematic way to collect, persist, and visualize CI/CD metrics to monitor the health and performance of our entire ecosystem.

## Decision

We will implement a dashboard data collection system that:

1. **Collects metrics during CI/CD runs** across all metaGOTHIC package repositories
2. **Persists data in a structured format** accessible to the dashboard
3. **Provides real-time and historical views** of build status, test results, and package health

### Data Collection Strategy

Each repository's CI/CD workflow will:
- Generate metrics during build/test/publish phases
- Structure data in a consistent JSON format
- Push data to a central location (initially the meta repository)

### Data Structure

```json
{
  "timestamp": "2024-05-15T10:30:00Z",
  "repository": "prompt-toolkit",
  "workflow": "ci",
  "status": "success",
  "metrics": {
    "duration": 145,
    "tests": {
      "total": 156,
      "passed": 156,
      "failed": 0,
      "coverage": 92.5
    },
    "build": {
      "size": 245678,
      "dependencies": 12
    }
  }
}
```

## Implementation

### Collection Phase
```yaml
# In each package's workflow
- name: Collect Metrics
  run: |
    echo "{
      \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"repository\": \"${{ github.repository }}\",
      \"metrics\": {
        \"tests\": $(jest --json | jq '.numTotalTests as $t | {total: $t, passed: .numPassedTests}'),
        \"coverage\": $(jest --coverage --json | jq '.coverageMap.total.lines.pct')
      }
    }" > metrics.json
```

### Storage Phase
```yaml
# Push to meta repository
- name: Update Dashboard Data
  uses: peter-evans/repository-dispatch@v2
  with:
    token: ${{ secrets.DISPATCH_TOKEN }}
    repository: ChaseNoCap/meta-gothic-framework
    event-type: update-dashboard
    client-payload: '{"metrics": ${{ toJson(fromJson(steps.collect.outputs.metrics)) }}}'
```

### Visualization Phase
The dashboard will:
- Aggregate data from all repositories
- Display real-time status cards
- Show historical trends
- Alert on failures or degraded performance

## Consequences

### Positive
- Centralized visibility across all packages
- Historical tracking of project health
- Early detection of quality issues
- Data-driven decision making

### Negative
- Additional CI/CD complexity
- Storage requirements grow over time
- Potential for data inconsistency

## Status

Implemented and operational. The dashboard successfully tracks:
- Build status across 8 packages
- Test coverage trends
- Deployment success rates
- Performance metrics over time

## Future Enhancements

1. **Prometheus Integration**: Export metrics for monitoring
2. **Alerting**: Automated notifications for failures
3. **Advanced Analytics**: ML-based anomaly detection
4. **Cost Tracking**: CI/CD resource usage and costs