// Event type guards
export function isClaudeEvent(event) {
    return event.type.startsWith('claude.');
}
export function isRepoEvent(event) {
    return event.type.startsWith('repo.');
}
export function isGraphQLEvent(event) {
    return event.type.startsWith('graphql.');
}
export function isGitHubEvent(event) {
    return event.type.startsWith('github.');
}
export function isPerformanceEvent(event) {
    return event.type.startsWith('performance.');
}
