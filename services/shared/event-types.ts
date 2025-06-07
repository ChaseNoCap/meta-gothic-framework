// Event interface
export interface Event {
    type: string;
    payload: any;
    timestamp?: string;
}

// Event type guards
export function isClaudeEvent(event: Event): boolean {
    return event.type.startsWith('claude.');
}

export function isRepoEvent(event: Event): boolean {
    return event.type.startsWith('repo.');
}

export function isGraphQLEvent(event: Event): boolean {
    return event.type.startsWith('graphql.');
}

export function isGitHubEvent(event: Event): boolean {
    return event.type.startsWith('github.');
}

export function isPerformanceEvent(event: Event): boolean {
    return event.type.startsWith('performance.');
}
