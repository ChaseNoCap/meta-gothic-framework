#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'fs';

interface FieldConfiguration {
  typeName: string;
  fieldName: string;
  disableDefaultMapping: boolean;
}

interface RootNode {
  typeName: string;
  fieldNames: string[];
}

interface ChildNode {
  typeName: string;
}

interface CustomGraphQLConfig {
  fetch: {
    url: {
      staticVariableContent: string;
    };
    method: string;
  };
  subscription?: {
    enabled: boolean;
    protocol: string;
    url: {
      staticVariableContent: string;
    };
  };
  federation: {
    enabled: boolean;
    serviceSdl: string;
  };
}

interface DatasourceConfiguration {
  id: string;
  kind: string;
  name: string;
  rootNodes: RootNode[];
  childNodes: ChildNode[];
  customGraphql: CustomGraphQLConfig;
}

interface Subgraph {
  id: string;
  name: string;
  routingUrl: string;
}

interface RouterConfig {
  version: string;
  engineConfig: {
    defaultFlushInterval: number;
    datasourceConfigurations: DatasourceConfiguration[];
    fieldConfigurations: FieldConfiguration[];
  };
  subgraphs: Subgraph[];
}

// Generate a proper Cosmo router execution config for local federation
const routerConfig: RouterConfig = {
  "version": "1", 
  "engineConfig": {
    "defaultFlushInterval": 500000000,
    "datasourceConfigurations": [
      {
        "id": "0",
        "kind": "GRAPHQL",
        "name": "claude-service",
        "rootNodes": [
          {
            "typeName": "Query",
            "fieldNames": [
              "sessions", "session", "sessionAnalytics", "performanceMetrics", 
              "claudeHealth", "agentRuns"
            ]
          },
          {
            "typeName": "Mutation", 
            "fieldNames": [
              "executeCommand", "generateCommitMessages", "createHandoff", 
              "continueSession", "killSession", "createAgentRun", 
              "updateAgentRun", "cleanupOldRuns"
            ]
          },
          {
            "typeName": "Subscription",
            "fieldNames": ["commandOutput", "agentRunProgress"]
          }
        ],
        "childNodes": [
          {"typeName": "ClaudeSession"},
          {"typeName": "SessionAnalytics"},
          {"typeName": "PerformanceMetrics"},
          {"typeName": "ClaudeHealth"},
          {"typeName": "CommandResult"},
          {"typeName": "CommitMessageResult"},
          {"typeName": "HandoffResult"},
          {"typeName": "ContinueSessionResult"},
          {"typeName": "KillSessionResult"},
          {"typeName": "AgentRun"},
          {"typeName": "CommandEvent"},
          {"typeName": "AgentRunUpdate"},
          {"typeName": "CleanupResult"}
        ],
        "customGraphql": {
          "fetch": {
            "url": {
              "staticVariableContent": "http://localhost:3002/graphql"
            },
            "method": "POST"
          },
          "subscription": {
            "enabled": true,
            "protocol": "SSE",
            "url": {
              "staticVariableContent": "http://localhost:3002/graphql"
            }
          },
          "federation": {
            "enabled": true,
            "serviceSdl": readFileSync('./claude-schema-federated.graphql', 'utf-8')
          }
        }
      },
      {
        "id": "1",
        "kind": "GRAPHQL",
        "name": "git-service",
        "rootNodes": [
          {
            "typeName": "Query",
            "fieldNames": [
              "gitStatus", "gitHealth", "latestCommit", "repositoryDetails",
              "scanAllRepositories", "scanAllDetailed", "submodules",
              "isRepositoryClean"
            ]
          },
          {
            "typeName": "Mutation",
            "fieldNames": [
              "commitChanges", "pushChanges", "executeGitCommand",
              "batchCommit", "hierarchicalCommit", "hierarchicalCommitAndPush"
            ]
          }
        ],
        "childNodes": [
          {"typeName": "GitStatus"},
          {"typeName": "GitHealth"},
          {"typeName": "GitCommit"},
          {"typeName": "RepositoryDetails"},
          {"typeName": "RepositoryScanResult"},
          {"typeName": "DetailedRepositoryScan"},
          {"typeName": "SubmoduleInfo"},
          {"typeName": "PushResult"},
          {"typeName": "ExecuteGitCommandResult"},
          {"typeName": "BatchCommitResult"},
          {"typeName": "HierarchicalCommitResult"}
        ],
        "customGraphql": {
          "fetch": {
            "url": {
              "staticVariableContent": "http://localhost:3004/graphql"
            },
            "method": "POST"
          },
          "subscription": {
            "enabled": true,
            "protocol": "SSE",
            "url": {
              "staticVariableContent": "http://localhost:3003/graphql"
            }
          },
          "federation": {
            "enabled": true,
            "serviceSdl": readFileSync('./git-schema-federated.graphql', 'utf-8')
          }
        }
      },
      {
        "id": "2",
        "kind": "GRAPHQL",
        "name": "github-adapter",
        "rootNodes": [
          {
            "typeName": "Query",
            "fieldNames": [
              "githubUser", "githubRepository", "githubRepositories"
            ]
          }
        ],
        "childNodes": [
          {"typeName": "GitHubUser"},
          {"typeName": "GitHubRepository"}
        ],
        "customGraphql": {
          "fetch": {
            "url": {
              "staticVariableContent": "http://localhost:3005/graphql"
            },
            "method": "POST"
          },
          "federation": {
            "enabled": true,
            "serviceSdl": readFileSync('./github-schema.graphql', 'utf-8')
          }
        }
      }
    ],
    "fieldConfigurations": [
      {
        "typeName": "Query",
        "fieldName": "_service",
        "disableDefaultMapping": true
      },
      {
        "typeName": "Query", 
        "fieldName": "_entities",
        "disableDefaultMapping": true
      }
    ]
  },
  "subgraphs": [
    {
      "id": "0",
      "name": "claude-service",
      "routingUrl": "http://localhost:3002/graphql"
    },
    {
      "id": "1", 
      "name": "git-service",
      "routingUrl": "http://localhost:3003/graphql"
    },
    {
      "id": "2",
      "name": "github-adapter", 
      "routingUrl": "http://localhost:3005/graphql"
    }
  ]
};

// Write the config
writeFileSync('./router-execution-config.json', JSON.stringify(routerConfig, null, 2));

console.log('✅ Generated router execution config');
console.log('📁 Output: router-execution-config.json');
console.log('\n🚀 To use this config:');
console.log('1. Make sure all services are running');
console.log('2. Start the gateway with: pm2 start ecosystem.config.cjs --only gateway');