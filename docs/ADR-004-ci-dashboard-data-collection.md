# ADR-004: CI/CD Dashboard Data Collection Strategy

**Date**: 2025-05-27  
**Status**: Proposed  
**Decision Makers**: Development Team  

## Context

Our CI/CD monitoring infrastructure generates valuable data but currently displays "N/A" for many metrics because we lack a systematic approach to collect and persist CI/CD data across our 12 repositories.

### Current State
- Dashboard script (`generate-ci-dashboard.sh`) exists and formats data beautifully
- Health monitoring script (`monitor-ci-health.sh`) provides real-time status
- No persistent storage of CI/CD metrics
- Cannot track trends or calculate success rates over time
- Manual inspection required to understand automation health

### Problem Statement
We need a scalable, maintainable way to collect CI/CD data from multiple repositories and persist it for dashboard generation, trend analysis, and automation health monitoring.

### Requirements
- Collect data from 12 repositories (1 meta + 11 packages)
- Store workflow run history and outcomes
- Calculate meaningful metrics (success rates, publish counts, update frequency)
- Minimal operational overhead
- Work within GitHub Actions constraints
- Support both real-time and historical views

## Decision

Implement a GitHub Actions-based data collection system that persists CI/CD metrics in the meta repository using JSON files and GitHub API.

### Chosen Solution
Create a scheduled GitHub Action workflow that:
1. Runs every 6 hours in the meta repository
2. Uses GitHub API to collect workflow run data from all repositories
3. Stores data in structured JSON files in `reports/ci-data/`
4. Maintains rolling 30-day window of detailed data
5. Generates summary statistics for dashboard consumption

### Implementation Approach
```yaml
# .github/workflows/collect-ci-data.yml
name: Collect CI/CD Data
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:

jobs:
  collect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Collect CI Data
        run: ./scripts/collect-ci-data.sh
        env:
          GITHUB_TOKEN: ${{ secrets.PAT_TOKEN }}
      - name: Commit Data
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add reports/ci-data/
          git commit -m "chore: update CI/CD metrics [skip ci]" || true
          git push
```

Data structure:
```json
{
  "timestamp": "2025-05-27T10:00:00Z",
  "repositories": {
    "logger": {
      "publish_workflow": {
        "last_30_days": {
          "total_runs": 15,
          "successful": 14,
          "failed": 1,
          "success_rate": 93.33
        },
        "last_run": {
          "timestamp": "2025-05-27T08:30:00Z",
          "status": "success",
          "duration_seconds": 180
        }
      },
      "auto_update_workflow": {
        "last_30_days": {
          "total_runs": 8,
          "successful": 8,
          "failed": 0,
          "success_rate": 100
        }
      }
    }
  },
  "summary": {
    "total_publish_runs": 150,
    "total_publish_success": 142,
    "overall_success_rate": 94.67,
    "most_active_repo": "logger",
    "least_active_repo": "prompts"
  }
}
```

## Alternatives Considered

### Option 1: External Monitoring Service
- **Pros**: Professional solution, built-in dashboards, alerting
- **Cons**: Cost, complexity, external dependency
- **Reason for rejection**: Overkill for our needs, adds operational burden

### Option 2: Database Storage
- **Pros**: Efficient queries, scalable, proper time-series support
- **Cons**: Requires database setup, maintenance, backups
- **Reason for rejection**: Too much infrastructure for current scale

### Option 3: Manual Collection
- **Pros**: Simple, no automation needed
- **Cons**: Time-consuming, error-prone, not sustainable
- **Reason for rejection**: Doesn't scale with 12 repositories

## Consequences

### Positive
- ✅ Automated data collection removes manual burden
- ✅ Historical data enables trend analysis
- ✅ JSON format is simple and version-controlled
- ✅ No external dependencies or costs
- ✅ Integrates seamlessly with existing scripts
- ✅ Data is transparent and auditable

### Negative
- ⚠️ JSON files will grow over time
- ⚠️ Limited to GitHub API rate limits
- ⚠️ No real-time updates (6-hour delay)
- ⚠️ Requires PAT_TOKEN with appropriate scopes

### Risks & Mitigations
- **Risk**: JSON files become too large
  - **Mitigation**: Implement data rotation, keep detailed data for 30 days only
  
- **Risk**: GitHub API rate limits
  - **Mitigation**: Cache responses, batch API calls, adjust collection frequency
  
- **Risk**: PAT_TOKEN expiration
  - **Mitigation**: Set calendar reminder, document token requirements

## Validation

### Success Criteria
- [ ] Dashboard shows real metrics instead of "N/A"
- [ ] Can track success rates over past 30 days
- [ ] Data collection runs automatically without intervention
- [ ] Collection completes within 5 minutes
- [ ] Historical trends visible in dashboard

### Testing Approach
1. Implement collection script with single repository
2. Validate JSON structure and calculations
3. Expand to all repositories
4. Run for 1 week and verify data accuracy
5. Update dashboard to consume collected data

## References

- [CI Monitoring Operations Guide](/docs/ci-monitoring-operations-guide.md)
- [Monitor CI Health Script](/scripts/monitor-ci-health.sh)
- [Generate CI Dashboard Script](/scripts/generate-ci-dashboard.sh)
- [GitHub API Workflow Runs](https://docs.github.com/en/rest/actions/workflow-runs)

## Changelog

- **2025-05-27**: Initial draft