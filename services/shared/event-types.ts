import type { BaseEvent } from '@chasenocap/event-system';

// Event naming convention: service.entity.action
// Examples: claude.session.started, repo.commit.created, github.workflow.triggered

// Claude Service Events
export interface ClaudeSessionStartedEvent extends BaseEvent {
  type: 'claude.session.started';
  payload: {
    sessionId: string;
    workingDirectory: string;
    correlationId: string;
    userId?: string;
    timestamp: number;
  };
}

export interface ClaudeSessionCompletedEvent extends BaseEvent {
  type: 'claude.session.completed';
  payload: {
    sessionId: string;
    duration: number;
    exitCode: number;
    correlationId: string;
  };
}

export interface ClaudeSessionFailedEvent extends BaseEvent {
  type: 'claude.session.failed';
  payload: {
    sessionId: string;
    error: string;
    correlationId: string;
  };
}

export interface ClaudeCommandExecutedEvent extends BaseEvent {
  type: 'claude.command.executed';
  payload: {
    sessionId: string;
    command: string;
    tokenCount: {
      input: number;
      output: number;
    };
    duration: number;
    success: boolean;
    correlationId: string;
  };
}

export interface ClaudeAgentRunProgressEvent extends BaseEvent {
  type: 'claude.agentRun.progress';
  payload: {
    runId: string;
    sessionId: string;
    progress: number;
    message: string;
    correlationId: string;
  };
}

// Repo Agent Service Events
export interface GitStatusQueriedEvent extends BaseEvent {
  type: 'repo.status.queried';
  payload: {
    path: string;
    duration: number;
    fileCount: number;
    correlationId: string;
  };
}

export interface GitCommitCreatedEvent extends BaseEvent {
  type: 'repo.commit.created';
  payload: {
    path: string;
    commitHash: string;
    message: string;
    fileCount: number;
    correlationId: string;
  };
}

export interface GitPushCompletedEvent extends BaseEvent {
  type: 'repo.push.completed';
  payload: {
    path: string;
    branch: string;
    commitCount: number;
    remote: string;
    correlationId: string;
  };
}

export interface RepositoryScanCompletedEvent extends BaseEvent {
  type: 'repo.scan.completed';
  payload: {
    path: string;
    repositoryCount: number;
    duration: number;
    correlationId: string;
  };
}

// Gateway Events
export interface GraphQLQueryStartedEvent extends BaseEvent {
  type: 'graphql.query.started';
  payload: {
    operationName?: string;
    query: string;
    variables?: Record<string, any>;
    correlationId: string;
  };
}

export interface GraphQLQueryCompletedEvent extends BaseEvent {
  type: 'graphql.query.completed';
  payload: {
    operationName?: string;
    duration: number;
    dataSize: number;
    correlationId: string;
  };
}

export interface GraphQLMutationStartedEvent extends BaseEvent {
  type: 'graphql.mutation.started';
  payload: {
    operationName?: string;
    mutation: string;
    variables?: Record<string, any>;
    correlationId: string;
  };
}

export interface GraphQLMutationCompletedEvent extends BaseEvent {
  type: 'graphql.mutation.completed';
  payload: {
    operationName?: string;
    duration: number;
    success: boolean;
    correlationId: string;
  };
}

export interface GraphQLSubscriptionStartedEvent extends BaseEvent {
  type: 'graphql.subscription.started';
  payload: {
    operationName?: string;
    subscription: string;
    correlationId: string;
  };
}

export interface GraphQLSubscriptionCompletedEvent extends BaseEvent {
  type: 'graphql.subscription.completed';
  payload: {
    operationName?: string;
    duration: number;
    messageCount: number;
    correlationId: string;
  };
}

// GitHub API Events
export interface GitHubAPIRequestStartedEvent extends BaseEvent {
  type: 'github.api.started';
  payload: {
    endpoint: string;
    method: string;
    correlationId: string;
  };
}

export interface GitHubAPIRequestCompletedEvent extends BaseEvent {
  type: 'github.api.completed';
  payload: {
    endpoint: string;
    method: string;
    statusCode: number;
    duration: number;
    rateLimitRemaining?: number;
    correlationId: string;
  };
}

export interface GitHubWorkflowTriggeredEvent extends BaseEvent {
  type: 'github.workflow.triggered';
  payload: {
    owner: string;
    repo: string;
    workflowId: string;
    ref: string;
    correlationId: string;
  };
}

// Performance Events
export interface SlowOperationDetectedEvent extends BaseEvent {
  type: 'performance.slowOperation.detected';
  payload: {
    service: string;
    operation: string;
    duration: number;
    threshold: number;
    correlationId: string;
  };
}


// Union type for all events
export type MetaGothicEvent =
  | ClaudeSessionStartedEvent
  | ClaudeSessionCompletedEvent
  | ClaudeSessionFailedEvent
  | ClaudeCommandExecutedEvent
  | ClaudeAgentRunProgressEvent
  | GitStatusQueriedEvent
  | GitCommitCreatedEvent
  | GitPushCompletedEvent
  | RepositoryScanCompletedEvent
  | GraphQLQueryStartedEvent
  | GraphQLQueryCompletedEvent
  | GraphQLMutationStartedEvent
  | GraphQLMutationCompletedEvent
  | GraphQLSubscriptionStartedEvent
  | GraphQLSubscriptionCompletedEvent
  | GitHubAPIRequestStartedEvent
  | GitHubAPIRequestCompletedEvent
  | GitHubWorkflowTriggeredEvent
  | SlowOperationDetectedEvent;

// Event type guards
export function isClaudeEvent(event: BaseEvent): event is ClaudeSessionStartedEvent | ClaudeSessionCompletedEvent | ClaudeSessionFailedEvent | ClaudeCommandExecutedEvent | ClaudeAgentRunProgressEvent {
  return event.type.startsWith('claude.');
}

export function isRepoEvent(event: BaseEvent): event is GitStatusQueriedEvent | GitCommitCreatedEvent | GitPushCompletedEvent | RepositoryScanCompletedEvent {
  return event.type.startsWith('repo.');
}

export function isGraphQLEvent(event: BaseEvent): event is GraphQLQueryStartedEvent | GraphQLQueryCompletedEvent | GraphQLMutationStartedEvent | GraphQLMutationCompletedEvent | GraphQLSubscriptionStartedEvent | GraphQLSubscriptionCompletedEvent {
  return event.type.startsWith('graphql.');
}

export function isGitHubEvent(event: BaseEvent): event is GitHubAPIRequestStartedEvent | GitHubAPIRequestCompletedEvent | GitHubWorkflowTriggeredEvent {
  return event.type.startsWith('github.');
}

export function isPerformanceEvent(event: BaseEvent): event is SlowOperationDetectedEvent {
  return event.type.startsWith('performance.');
}