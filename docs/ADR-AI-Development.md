# ADR-AI-Development: AI Integration and SDLC Patterns

**Status**: Proposed  
**Date**: Consolidated 2025-01-06  
**Combines**: ADR-010, ADR-011

## Executive Summary

The metaGOTHIC framework implements progressive context loading to optimize AI token usage and uses a state machine pattern for SDLC phase management. This enables intelligent AI assistance while managing costs and maintaining development workflow consistency.

## Context

AI language models have token limits and usage costs. Effective AI integration requires intelligent context management and structured workflows. The framework needs to provide the right context at the right time while guiding developers through consistent SDLC phases.

## Decision

### 1. Progressive Context Loading

**Hierarchical Context Levels**:

```typescript
enum ContextLevel {
  OVERVIEW = 1,    // Project summary (~500 tokens)
  ACTIVE = 2,      // Current task context (~2000 tokens)
  DETAILED = 3,    // Full file contents (~5000 tokens)
  COMPREHENSIVE = 4 // Related systems (~10000 tokens)
}

// Load context based on query needs
async function loadContext(query: string, maxTokens: number) {
  const level = determineContextLevel(query);
  
  return {
    overview: await loadOverview(),
    active: level >= 2 ? await loadActiveContext() : null,
    detailed: level >= 3 ? await loadDetailedFiles() : null,
    comprehensive: level >= 4 ? await loadRelatedSystems() : null
  };
}
```

**Smart Loading Strategies**:
1. **Query Analysis**: Determine required context from query
2. **Token Budgeting**: Allocate tokens across context types
3. **Relevance Scoring**: Prioritize most relevant content
4. **Incremental Loading**: Start small, expand as needed

### 2. SDLC State Machine

**Phase Definitions**:

```yaml
phases:
  planning:
    description: "Requirements gathering and design"
    validations:
      - requirements_documented
      - design_approved
    ai_prompts:
      - "Help me define requirements for..."
      - "Create a design document for..."
    
  implementation:
    description: "Active development"
    validations:
      - tests_passing
      - lint_clean
    ai_prompts:
      - "Implement the following feature..."
      - "Fix this bug..."
    
  review:
    description: "Code review and testing"
    validations:
      - peer_review_complete
      - test_coverage_met
    ai_prompts:
      - "Review this code for..."
      - "Suggest improvements..."
```

**State Transitions**:

```typescript
class SDLCStateMachine {
  async transition(from: Phase, to: Phase) {
    // Validate current phase completion
    const validations = await this.validate(from);
    if (!validations.passed) {
      throw new Error(`Cannot leave ${from}: ${validations.failures}`);
    }
    
    // Execute transition hooks
    await this.executeHooks(from, to);
    
    // Update state
    this.currentPhase = to;
    
    // Load phase-specific context
    return this.loadPhaseContext(to);
  }
}
```

### 3. AI Integration Patterns

**Context-Aware Prompting**:

```typescript
// Generate prompts with SDLC awareness
function generatePrompt(task: Task) {
  const phase = getCurrentPhase();
  const context = loadPhaseContext(phase);
  
  return `
    Current Phase: ${phase.name}
    Phase Goals: ${phase.goals}
    
    Task: ${task.description}
    
    Context:
    ${context.relevant}
    
    Constraints:
    ${phase.constraints}
  `;
}
```

**Token Optimization**:

```typescript
// Compress context while preserving meaning
function optimizeContext(content: string, maxTokens: number) {
  return {
    // Remove comments
    code: removeComments(content),
    // Summarize documentation
    docs: summarizeDocs(content),
    // Extract key identifiers
    symbols: extractSymbols(content),
    // Include recent changes
    diff: getRecentChanges(content)
  };
}
```

## Implementation Examples

### Progressive Loading in Action

```typescript
// Simple query - Level 1
"What is the project structure?"
// Returns: README + directory tree

// Specific task - Level 2  
"Fix the login bug in auth service"
// Returns: Overview + auth service context + recent issues

// Complex implementation - Level 3
"Implement new caching strategy"
// Returns: All above + cache files + architecture docs

// System-wide change - Level 4
"Refactor all services to use new API"
// Returns: All above + all service contexts + dependencies
```

### SDLC Workflow Example

```typescript
// Developer starts new feature
await sdlc.startFeature('add-oauth-support');
// → Enters planning phase

// AI assists with requirements
const requirements = await ai.generateRequirements({
  feature: 'OAuth support',
  context: sdlc.getCurrentContext()
});

// Transition to implementation
await sdlc.transition('implementation');
// → Validates requirements are complete

// AI assists with code
const implementation = await ai.implementFeature({
  requirements,
  patterns: sdlc.getPhasePatterns('implementation')
});
```

## Benefits

### 1. Cost Optimization
- Reduced token usage (up to 70% savings)
- Precise context loading
- Efficient prompt engineering

### 2. Workflow Consistency
- Enforced quality gates
- Standardized phases
- Clear progress tracking

### 3. AI Effectiveness
- Better responses with focused context
- Phase-appropriate assistance
- Reduced hallucination

## Consequences

### Positive
- **Cost Control**: Predictable AI usage costs
- **Quality**: Enforced standards via state machine
- **Productivity**: AI provides phase-specific help
- **Tracking**: Clear visibility into development progress

### Negative
- **Complexity**: Additional abstraction layer
- **Rigidity**: May feel constraining
- **Setup Time**: Initial configuration overhead

### Mitigations
- Configurable phases and validations
- Override mechanisms for exceptions
- Gradual adoption path
- Clear documentation

## Future Enhancements

1. **Learning System**: Improve context selection over time
2. **Multi-Model Support**: Different models for different phases
3. **Automated Validation**: AI-powered gate checks
4. **Team Workflows**: Collaborative SDLC states

## Status

Currently proposed - implementation priorities:
1. Basic context loading (high value, low effort)
2. Simple SDLC states (medium value, medium effort)
3. Full integration (high value, high effort)

## References

- [Token Optimization Strategies](https://platform.openai.com/docs/guides/optimization)
- [State Machine Patterns](https://refactoring.guru/design-patterns/state)
- [SDLC Best Practices](https://www.atlassian.com/software-development)