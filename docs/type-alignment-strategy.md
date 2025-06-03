# TypeScript Type Alignment Strategy for meta-gothic-framework

## Executive Summary

This document outlines a comprehensive strategy for achieving and maintaining perfect type alignment across the meta-gothic-framework monorepo. Based on analysis of current state and industry best practices, we recommend a phased approach to standardize TypeScript configurations, consolidate shared types, and implement automated type checking.

## Current State Analysis

### TypeScript Configuration Inconsistencies
- **Module Resolution**: Mixed strategies (node, bundler, NodeNext)
- **Strict Mode**: One package (context-aggregator) has strict mode disabled
- **Target Versions**: Mix of ES2020 and ES2022
- **Additional Checks**: Inconsistent use of advanced strict options

### Type Duplication Issues
- **Context Interfaces**: Duplicated across 3 services
- **Status Enums**: RunStatus appears in multiple locations
- **Result Patterns**: Similar error/success patterns reimplemented
- **Plugin Types**: Repeated option interfaces

## Recommended Tools and Techniques

### 1. **Project References Architecture**
Configure TypeScript project references for better type isolation and faster builds:

```json
// Root tsconfig.json
{
  "references": [
    { "path": "./services/claude-service" },
    { "path": "./services/repo-agent-service" },
    { "path": "./services/meta-gothic-app" },
    { "path": "./services/shared" }
  ]
}
```

### 2. **Shared Types Package Structure**
Create a centralized type package:

```
services/shared/
├── types/
│   ├── index.ts           # Main export
│   ├── context.ts         # Base context interfaces
│   ├── common.ts          # Common enums and utility types
│   ├── results.ts         # Standard result/error patterns
│   ├── metadata.ts        # Shared metadata types
│   └── guards.ts          # Type guard utilities
├── tsconfig.json
└── package.json
```

### 3. **Base TypeScript Configuration** ✅ IMPLEMENTED
Standardize with a root `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  }
}
```

**Implementation Notes** (January 2025):
- Created `tsconfig.base.json` with all strict checks enabled
- Added additional code quality checks (`noUnusedLocals`, `noUnusedParameters`, etc.)
- Configured proper emit options for better debugging (`declarationMap`, `sourceMap`)
- Set up consistent formatting options (`newLine: "lf"`)
- Updated root `tsconfig.json` to extend base configuration
- Added project references for all services in root config

### 4. **Module Resolution Strategy**
- **Node Services**: Use `"moduleResolution": "NodeNext"`
- **UI/Browser Packages**: Use `"moduleResolution": "bundler"`
- **Shared Packages**: Use `"moduleResolution": "NodeNext"`

### 5. **Type Import/Export Best Practices**

#### Use Type-Only Imports
```typescript
import type { Context, Logger } from '@meta-gothic/shared-types';
```

#### Explicit Type Exports
```typescript
export type { Context, Logger, EventBus };
export { createContext, isValidContext };
```

## Implementation Plan

### Phase 1: Foundation (Week 1)
1. Create `tsconfig.base.json` with strict settings
2. Set up `services/shared/types` package
3. Define base interfaces (Context, Logger, EventBus)
4. Configure project references

### Phase 2: Migration (Week 2-3)
1. Update all `tsconfig.json` files to extend base
2. Replace duplicated context interfaces with shared types
3. Consolidate status enums and result patterns
4. Update imports to use shared types

### Phase 3: Automation (Week 4)
1. Add type checking to CI/CD pipeline
2. Implement pre-commit hooks for type validation
3. Set up automated dependency updates
4. Create type coverage reports

## Type Alignment Tools

### 1. **TypeScript Compiler**
```bash
# Check all projects
tsc --build --clean
tsc --build

# Type check without emit
tsc --noEmit
```

### 2. **API Extractor**
For maintaining public API surface:
```bash
npm install -D @microsoft/api-extractor
```

### 3. **Type Coverage**
Monitor type safety progress:
```bash
npm install -D type-coverage
npx type-coverage --detail
```

### 4. **Knip**
Find unused exports and dependencies:
```bash
npm install -D knip
npx knip
```

### 5. **syncpack**
Keep dependencies in sync:
```bash
npm install -D syncpack
npx syncpack list-mismatches
```

## Type Safety Guidelines

### 1. **Avoid `any` Types**
```typescript
// ❌ Bad
function process(data: any) { }

// ✅ Good
function process(data: unknown) { }
```

### 2. **Use Discriminated Unions**
```typescript
// ✅ Good
type Result<T> = 
  | { success: true; data: T }
  | { success: false; error: Error };
```

### 3. **Leverage Type Guards**
```typescript
// ✅ Good
function isContext(obj: unknown): obj is Context {
  return typeof obj === 'object' && 
         obj !== null && 
         'logger' in obj;
}
```

### 4. **Use Template Literal Types**
```typescript
// ✅ Good
type EventType = `${ServiceName}:${EventName}`;
```

## Monitoring and Maintenance

### Type Health Metrics
1. **Type Coverage**: Target >95%
2. **Any Usage**: Target 0 explicit `any`
3. **Build Time**: Monitor for regressions
4. **Type Errors**: Zero tolerance in CI

### Regular Audits
- Weekly: Check for new type duplications
- Monthly: Review and update shared types
- Quarterly: Assess TypeScript version updates

## Common Pitfalls to Avoid

1. **Over-abstraction**: Don't create types for single-use cases
2. **Circular Dependencies**: Use interface segregation
3. **Type Assertion Abuse**: Prefer type guards
4. **Ignoring Errors**: Fix root causes, don't suppress

## Benefits of This Approach

1. **Developer Experience**: Consistent IntelliSense across packages
2. **Maintainability**: Single source of truth for types
3. **Performance**: Faster builds with project references
4. **Safety**: Catch errors at compile time
5. **Documentation**: Types serve as living documentation

## Next Steps

1. Review and approve this strategy
2. Create implementation tickets
3. Assign ownership for each phase
4. Set up monitoring dashboards
5. Schedule regular type health reviews

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [API Extractor](https://api-extractor.com/)
- [Type Coverage](https://github.com/plantain-00/type-coverage)