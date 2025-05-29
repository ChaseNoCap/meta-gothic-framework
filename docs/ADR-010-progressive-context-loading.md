# ADR-010: Progressive Context Loading for AI Interactions

**Date**: 2025-01-27  
**Status**: Proposed  
**Decision Makers**: metaGOTHIC Framework Team  

## Context

AI language models have token limits and performance characteristics that require careful management of context. The metaGOTHIC framework needs to provide relevant context to AI assistants without overwhelming the token window or degrading performance.

### Current State
- H1B project has XML-based prompt templates
- Claude.md provides static context guidance
- No dynamic context aggregation
- Manual context selection by developers
- Token limits: 200k (Claude), varying for others

### Problem Statement
We need a context loading strategy that:
1. Stays within AI model token limits
2. Provides most relevant context first
3. Adapts based on query complexity
4. Supports different SDLC phases
5. Minimizes token usage costs
6. Maintains coherent context

### Requirements
- **Efficiency**: Minimize tokens while maximizing relevance
- **Intelligence**: Smart selection based on query analysis
- **Flexibility**: Different strategies for different phases
- **Performance**: Fast context assembly (<100ms)
- **Observability**: Token usage tracking
- **Adaptability**: Works with multiple AI models

## Decision

Implement **Progressive Context Loading** with intelligent selection and token optimization.

### Chosen Solution

#### Context Hierarchy
```yaml
Level 1 - Core Context (Always loaded):
  - Current file/function
  - Direct dependencies
  - Active SDLC phase
  - Recent error messages
  Size: ~2-5k tokens

Level 2 - Extended Context (Conditionally loaded):
  - Related files in same module
  - Test files for current code
  - Recent git changes
  - Package documentation
  Size: ~10-20k tokens

Level 3 - Broad Context (On demand):
  - Full package structure
  - Cross-package dependencies
  - Historical changes
  - Knowledge base entries
  Size: ~50-100k tokens

Level 4 - Deep Context (Specific queries):
  - Full codebase analysis
  - All documentation
  - External dependencies
  - Stack Overflow results
  Size: ~100k+ tokens
```

#### Progressive Loading Strategy
```typescript
class ProgressiveContextLoader {
  async loadContext(query: AIQuery): Promise<Context> {
    const analysis = await this.analyzeQuery(query);
    const budget = this.calculateTokenBudget(analysis);
    
    // Always load core context
    const context = new ContextBuilder(budget);
    await context.addCore({
      currentFile: query.file,
      cursorPosition: query.position,
      sdlcPhase: query.phase
    });
    
    // Progressively add based on analysis
    if (analysis.needsTests && context.hasTokensRemaining(5000)) {
      await context.addTestFiles(query.file);
    }
    
    if (analysis.needsDependencies && context.hasTokensRemaining(10000)) {
      await context.addDependencies(query.file);
    }
    
    if (analysis.needsHistory && context.hasTokensRemaining(5000)) {
      await context.addGitHistory(query.file, 10);
    }
    
    return context.build();
  }
}
```

#### Query Analysis
```typescript
interface QueryAnalysis {
  intent: 'debug' | 'implement' | 'refactor' | 'document' | 'test';
  complexity: 'simple' | 'moderate' | 'complex';
  scope: 'function' | 'file' | 'module' | 'package' | 'system';
  needsTests: boolean;
  needsDependencies: boolean;
  needsHistory: boolean;
  needsDocumentation: boolean;
  keywords: string[];
}

class QueryAnalyzer {
  analyze(query: string): QueryAnalysis {
    // Use patterns to determine intent
    const patterns = {
      debug: /fix|error|bug|issue|problem/i,
      implement: /create|add|implement|build/i,
      refactor: /refactor|improve|optimize|clean/i,
      document: /document|explain|describe/i,
      test: /test|spec|coverage/i
    };
    
    // Analyze scope indicators
    const scopeIndicators = {
      function: /function|method|handler/i,
      file: /file|module|component/i,
      module: /package|library|service/i,
      system: /architecture|system|all/i
    };
    
    return this.buildAnalysis(query, patterns, scopeIndicators);
  }
}
```

#### Token Optimization
```typescript
class TokenOptimizer {
  private encoder: TiktokenEncoder;
  
  optimize(content: string, limit: number): string {
    const tokens = this.encoder.encode(content);
    
    if (tokens.length <= limit) {
      return content;
    }
    
    // Intelligent truncation strategies
    return this.applyStrategies(content, limit, {
      removeComments: true,
      removeWhitespace: true,
      summarizeLongFunctions: true,
      prioritizeRecentCode: true
    });
  }
  
  // Content prioritization
  prioritize(contents: ContentItem[]): ContentItem[] {
    return contents
      .map(item => ({
        ...item,
        score: this.calculateRelevance(item)
      }))
      .sort((a, b) => b.score - a.score);
  }
}
```

#### SDLC Phase Strategies
```typescript
const phaseStrategies: Record<SDLCPhase, ContextStrategy> = {
  requirements: {
    priority: ['specs', 'userStories', 'acceptance'],
    exclude: ['implementation', 'tests'],
    maxDepth: 2
  },
  
  design: {
    priority: ['interfaces', 'schemas', 'architecture'],
    include: ['requirements', 'constraints'],
    maxDepth: 3
  },
  
  implementation: {
    priority: ['currentCode', 'tests', 'interfaces'],
    include: ['dependencies', 'examples'],
    maxDepth: 4
  },
  
  testing: {
    priority: ['tests', 'implementation', 'coverage'],
    include: ['fixtures', 'mocks'],
    maxDepth: 3
  },
  
  deployment: {
    priority: ['configs', 'scripts', 'documentation'],
    include: ['monitoring', 'rollback'],
    maxDepth: 2
  }
};
```

#### Context Assembly
```xml
<!-- Progressive Context Template -->
<context_request>
  <core_context>
    <current_file path="${file.path}">
      ${file.content}
    </current_file>
    <cursor_context lines_before="10" lines_after="10">
      ${cursor.context}
    </cursor_context>
  </core_context>
  
  <extended_context budget_remaining="${tokens.remaining}">
    <dependencies if="${analysis.needsDependencies}">
      ${dependencies.relevant}
    </dependencies>
    <tests if="${analysis.needsTests}">
      ${tests.related}
    </tests>
  </extended_context>
  
  <metadata>
    <tokens_used>${tokens.used}</tokens_used>
    <tokens_limit>${tokens.limit}</tokens_limit>
    <context_quality>${quality.score}</context_quality>
  </metadata>
</context_request>
```

### Implementation Flow
```
1. Query Received
   ↓
2. Analyze Query Intent
   - Detect SDLC phase
   - Identify scope
   - Extract keywords
   ↓
3. Calculate Token Budget
   - Model limits
   - Response space
   - Safety margin
   ↓
4. Load Core Context
   - Current location
   - Immediate context
   - Active phase
   ↓
5. Progressive Loading
   - Check remaining tokens
   - Load by priority
   - Optimize content
   ↓
6. Assembly & Validation
   - Build XML structure
   - Validate coherence
   - Add metadata
```

## Alternatives Considered

### Option 1: Fixed Context Windows
- **Pros**: Simple, predictable, easy to implement
- **Cons**: Wastes tokens, not adaptive, poor relevance
- **Reason for rejection**: Inefficient use of token budget

### Option 2: Manual Context Selection
- **Pros**: Developer control, explicit, no surprises
- **Cons**: Cognitive load, inconsistent, time-consuming
- **Reason for rejection**: Poor developer experience

### Option 3: Full Context with Summarization
- **Pros**: Complete information, no missing context
- **Cons**: Expensive summarization, quality loss, slow
- **Reason for rejection**: Performance and quality concerns

## Consequences

### Positive
- ✅ **Efficiency**: Optimal token usage, lower costs
- ✅ **Relevance**: Most important context loaded first
- ✅ **Adaptability**: Adjusts to different query types
- ✅ **Performance**: Fast context assembly
- ✅ **Quality**: Better AI responses from relevant context
- ✅ **Scalability**: Works with large codebases

### Negative
- ⚠️ **Complexity**: Sophisticated analysis required
- ⚠️ **Unpredictability**: Context may vary between queries
- ⚠️ **Tuning**: Requires optimization over time

### Risks & Mitigations
- **Risk**: Missing critical context
  - **Mitigation**: Feedback loop, context quality scoring
  
- **Risk**: Token calculation errors
  - **Mitigation**: Conservative budgets, multiple encoders
  
- **Risk**: Performance degradation
  - **Mitigation**: Caching, parallel loading, optimization

## Validation

### Success Criteria
- [ ] 90% of queries stay within token budget
- [ ] <100ms context assembly time
- [ ] 80% relevance score from users
- [ ] 50% reduction in token costs
- [ ] Improved AI response quality

### Testing Approach
- Token counting accuracy tests
- Context relevance scoring
- Performance benchmarking
- A/B testing different strategies
- User satisfaction surveys

## References

- [Tiktoken Library](https://github.com/openai/tiktoken)
- [Claude Context Best Practices](https://docs.anthropic.com/claude/docs/context-window)
- [Prompt Engineering Guide](./prompt-engineering.md)
- [XML Structured Prompts](./prompt-xml-structured-guide.md)

## Changelog

- **2025-01-27**: Initial draft for progressive context loading