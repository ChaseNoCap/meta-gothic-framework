# ADR-011: SDLC State Machine for Development Workflow

**Date**: 2025-01-27  
**Status**: Proposed  
**Decision Makers**: metaGOTHIC Framework Team  

## Context

The metaGOTHIC framework aims to guide developers through professional software development lifecycle (SDLC) phases. A formal state machine ensures consistent workflows, proper phase transitions, and quality gates.

### Current State
- No formal SDLC enforcement
- Developers manually manage phases
- Inconsistent development practices
- No automated quality gates
- AI assistants lack phase awareness

### Problem Statement
We need an SDLC management system that:
1. Enforces proper development phases
2. Provides clear transition criteria
3. Integrates with AI assistance
4. Supports both rigid and flexible workflows
5. Tracks progress and metrics
6. Enables rollback when needed

### Requirements
- **Structure**: Clear phases with defined outcomes
- **Flexibility**: Support different project types
- **Validation**: Automated gates between phases
- **Observability**: Progress tracking and metrics
- **Integration**: AI assistants understand current phase
- **Recovery**: Rollback and error handling

## Decision

Implement an **SDLC State Machine** with configurable phases, transitions, and validation rules.

### Chosen Solution

#### State Machine Definition
```typescript
enum SDLCPhase {
  REQUIREMENTS = 'requirements',
  DESIGN = 'design',
  IMPLEMENTATION = 'implementation',
  TESTING = 'testing',
  REVIEW = 'review',
  DEPLOYMENT = 'deployment',
  MAINTENANCE = 'maintenance'
}

interface PhaseDefinition {
  name: SDLCPhase;
  description: string;
  requiredArtifacts: string[];
  validationRules: ValidationRule[];
  allowedTransitions: SDLCPhase[];
  aiGuidance: AIGuidanceConfig;
}

class SDLCStateMachine {
  private currentPhase: SDLCPhase;
  private phaseHistory: PhaseTransition[];
  private config: SDLCConfig;
  
  async transitionTo(
    targetPhase: SDLCPhase,
    context: TransitionContext
  ): Promise<TransitionResult> {
    // Validate transition is allowed
    if (!this.canTransition(targetPhase)) {
      throw new InvalidTransitionError(
        this.currentPhase,
        targetPhase
      );
    }
    
    // Run validation rules
    const validation = await this.validate(targetPhase, context);
    if (!validation.passed) {
      return {
        success: false,
        errors: validation.errors,
        suggestions: validation.suggestions
      };
    }
    
    // Execute transition
    await this.executeTransition(targetPhase, context);
    
    // Emit event
    await this.eventBus.emit('sdlc.phase.changed', {
      from: this.currentPhase,
      to: targetPhase,
      context,
      timestamp: new Date()
    });
    
    return { success: true };
  }
}
```

#### Phase Configurations
```yaml
# sdlc-config.yaml
phases:
  requirements:
    description: "Gather and document system requirements"
    requiredArtifacts:
      - requirements.md
      - user-stories.md
      - acceptance-criteria.md
    validationRules:
      - type: file_exists
        paths: ["docs/requirements.md"]
      - type: content_check
        file: "requirements.md"
        patterns: ["## Functional Requirements", "## Non-Functional"]
    allowedTransitions:
      - design
    aiGuidance:
      promptTemplate: "requirements-gathering"
      contextDepth: 2
      suggestedTools: ["mermaid", "plantuml"]

  design:
    description: "Create system architecture and detailed design"
    requiredArtifacts:
      - architecture.md
      - api-design.md
      - database-schema.sql
    validationRules:
      - type: diagram_exists
        patterns: ["*.puml", "*.mermaid"]
      - type: schema_valid
        files: ["*.graphql", "*.sql"]
    allowedTransitions:
      - implementation
      - requirements  # Can go back
    aiGuidance:
      promptTemplate: "system-design"
      contextDepth: 3
      suggestedTools: ["graphql-schema", "erd-generator"]

  implementation:
    description: "Write code following the design"
    requiredArtifacts:
      - source_code
      - unit_tests
      - documentation
    validationRules:
      - type: tests_exist
        coverage: 80
      - type: linting_pass
      - type: type_check_pass
    allowedTransitions:
      - testing
      - design  # Can go back
    aiGuidance:
      promptTemplate: "code-implementation"
      contextDepth: 4
      enablePairProgramming: true
```

#### Validation Rules Engine
```typescript
interface ValidationRule {
  type: string;
  config: Record<string, any>;
  severity: 'error' | 'warning' | 'info';
}

class ValidationEngine {
  private validators: Map<string, Validator>;
  
  async validate(
    phase: SDLCPhase,
    context: ValidationContext
  ): Promise<ValidationResult> {
    const rules = this.config.getPhaseRules(phase);
    const results = await Promise.all(
      rules.map(rule => this.runValidator(rule, context))
    );
    
    return {
      passed: results.every(r => r.passed || r.severity !== 'error'),
      errors: results.filter(r => !r.passed && r.severity === 'error'),
      warnings: results.filter(r => !r.passed && r.severity === 'warning'),
      suggestions: this.generateSuggestions(results)
    };
  }
}

// Example validators
class FileExistsValidator implements Validator {
  async validate(rule: ValidationRule, context: ValidationContext) {
    const files = rule.config.paths || [];
    const missing = [];
    
    for (const file of files) {
      if (!await context.fileSystem.exists(file)) {
        missing.push(file);
      }
    }
    
    return {
      passed: missing.length === 0,
      message: missing.length > 0 
        ? `Missing required files: ${missing.join(', ')}`
        : 'All required files exist',
      severity: rule.severity
    };
  }
}
```

#### AI Integration
```typescript
class SDLCAIIntegration {
  constructor(
    private stateMachine: SDLCStateMachine,
    private aiService: AIService
  ) {}
  
  async getPhaseGuidance(): Promise<AIGuidance> {
    const phase = this.stateMachine.getCurrentPhase();
    const config = this.config.getPhaseConfig(phase);
    
    // Load phase-specific prompt template
    const template = await this.loadTemplate(
      config.aiGuidance.promptTemplate
    );
    
    // Build context based on phase
    const context = await this.buildPhaseContext(phase, {
      depth: config.aiGuidance.contextDepth,
      includeHistory: true,
      includeValidation: true
    });
    
    return {
      template,
      context,
      tools: config.aiGuidance.suggestedTools,
      examples: await this.loadPhaseExamples(phase)
    };
  }
  
  async suggestNextSteps(): Promise<Suggestion[]> {
    const phase = this.stateMachine.getCurrentPhase();
    const validation = await this.stateMachine.validateCurrent();
    
    if (!validation.passed) {
      // Suggest fixes for validation errors
      return this.generateFixSuggestions(validation.errors);
    }
    
    // Suggest next phase activities
    return this.generatePhaseSuggestions(phase);
  }
}
```

#### Progress Tracking
```typescript
interface PhaseMetrics {
  phase: SDLCPhase;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  validationAttempts: number;
  errors: ValidationError[];
  rollbacks: number;
}

class SDLCProgressTracker {
  async getProgress(): Promise<SDLCProgress> {
    const completed = this.getCompletedPhases();
    const current = this.stateMachine.getCurrentPhase();
    const remaining = this.getRemainingPhases();
    
    return {
      completedPhases: completed,
      currentPhase: current,
      remainingPhases: remaining,
      overallProgress: this.calculateProgress(),
      estimatedCompletion: this.estimateCompletion(),
      metrics: await this.gatherMetrics()
    };
  }
  
  generateReport(): SDLCReport {
    return {
      timeline: this.generateTimeline(),
      bottlenecks: this.identifyBottlenecks(),
      recommendations: this.generateRecommendations()
    };
  }
}
```

### State Transition Flow
```
Requirements
    ↓ (validation passed)
Design
    ↓ (validation passed)
Implementation
    ↓ (validation passed)
Testing
    ↓ (validation passed)
Review
    ↓ (approval received)
Deployment
    ↓ (deployment successful)
Maintenance

Note: Backward transitions allowed for iteration
```

## Alternatives Considered

### Option 1: Linear Waterfall Process
- **Pros**: Simple, clear progression, easy to understand
- **Cons**: No iteration, rigid, doesn't match reality
- **Reason for rejection**: Modern development is iterative

### Option 2: Kanban Board Only
- **Pros**: Flexible, visual, familiar to developers
- **Cons**: No enforcement, no quality gates, no structure
- **Reason for rejection**: Lacks formal validation and guidance

### Option 3: Git Flow Integration
- **Pros**: Developer familiar, branch-based, proven
- **Cons**: Only covers version control, no phase validation
- **Reason for rejection**: Insufficient for full SDLC management

## Consequences

### Positive
- ✅ **Quality**: Enforced validation improves output quality
- ✅ **Consistency**: Standard process across projects
- ✅ **Guidance**: Clear next steps for developers
- ✅ **AI Integration**: Phase-aware assistance
- ✅ **Metrics**: Measurable process improvements
- ✅ **Flexibility**: Configurable for different projects

### Negative
- ⚠️ **Overhead**: Additional process steps
- ⚠️ **Learning Curve**: Developers must learn the system
- ⚠️ **Rigidity**: May feel constraining initially

### Risks & Mitigations
- **Risk**: Developers bypass the system
  - **Mitigation**: Make it helpful not hindrance, good UX
  
- **Risk**: Validation rules too strict
  - **Mitigation**: Configurable rules, warning vs error
  
- **Risk**: Slows down development
  - **Mitigation**: Automation, smart defaults, fast validation

## Validation

### Success Criteria
- [ ] 90% of projects complete all phases
- [ ] 50% reduction in production bugs
- [ ] 80% developer satisfaction
- [ ] <30s phase transition time
- [ ] Measurable quality improvements

### Testing Approach
- State machine unit tests
- Validation rule testing
- Integration tests with AI
- User acceptance testing
- Performance benchmarking

## References

- [State Pattern](https://refactoring.guru/design-patterns/state)
- [SDLC Best Practices](https://www.atlassian.com/software-development)
- [Workflow Engines](https://github.com/node-workflow)
- [Phase Gate Process](https://www.pmi.org/learning/library/phase-gate-process-9274)

## Changelog

- **2025-01-27**: Initial draft for SDLC state machine