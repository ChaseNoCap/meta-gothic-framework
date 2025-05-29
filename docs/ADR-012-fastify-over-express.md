# ADR-012: Choose Fastify Over Express for Web Framework

**Date**: 2025-01-27  
**Status**: Accepted  
**Decision Makers**: metaGOTHIC Framework Team  

## Context

The metaGOTHIC platform requires a Node.js web framework for all three core services. The framework must support high performance, modern development patterns, and excellent GraphQL integration.

### Current State
- No existing web framework choice for metaGOTHIC services
- H1B project uses simple function calls without web framework
- Need consistent technology stack across all services
- Performance is critical for AI and GitHub API operations

### Problem Statement
We need a web framework that:
1. Provides high performance and low latency
2. Offers excellent TypeScript support
3. Integrates seamlessly with GraphQL servers
4. Has modern async/await patterns
5. Provides rich plugin ecosystem
6. Enables consistent development experience

### Requirements
- **Performance**: Must handle high concurrent connections efficiently
- **TypeScript**: Native TypeScript support with excellent type inference
- **GraphQL**: Seamless integration with GraphQL servers
- **Ecosystem**: Rich plugin system for common functionality
- **Maintainability**: Clean, modern API design
- **Consistency**: Same framework across all services

## Decision

Adopt **Fastify** as the web framework for all metaGOTHIC services.

### Chosen Solution

#### Performance Advantages
- **2.5x faster** than Express in benchmarks (50,000 vs 20,000 req/s)
- **Low overhead**: Minimal abstraction over Node.js HTTP
- **Efficient routing**: Fast route matching and parameter extraction
- **Schema-based validation**: Built-in JSON schema validation

#### TypeScript Excellence
```typescript
// Native TypeScript support with excellent inference
import Fastify from 'fastify';

const server = Fastify({ logger: true });

// Type-safe route handlers
server.get<{
  Params: { id: string };
  Reply: { user: User };
}>('/users/:id', async (request, reply) => {
  // request.params.id is typed as string
  // reply type is enforced
});
```

#### Plugin Architecture
```typescript
// Rich plugin ecosystem with dependency injection
await server.register(require('@fastify/cors'));
await server.register(require('@fastify/websocket'));
await server.register(require('mercurius'), {
  schema,
  resolvers
});

// Custom plugins with encapsulation
await server.register(async function (fastify) {
  fastify.decorate('db', dbConnection);
});
```

#### GraphQL Integration
```typescript
// Seamless Mercurius integration
await server.register(require('mercurius'), {
  schema: buildFederationSchema(typeDefs),
  resolvers,
  subscription: true,
  graphiql: true
});

// Federation support
await server.register(require('@mercuriusjs/federation'), {
  schema: buildFederationSchema(typeDefs)
});
```

### Implementation Standards

#### Service Structure
```typescript
// Standard Fastify service structure
class MetaGothicService {
  private server: FastifyInstance;
  
  constructor() {
    this.server = Fastify({
      logger: {
        level: process.env.LOG_LEVEL || 'info'
      }
    });
  }
  
  async initialize() {
    // Register plugins
    await this.registerPlugins();
    
    // Setup routes
    await this.setupRoutes();
    
    // Start server
    await this.server.listen({
      port: process.env.PORT || 3000,
      host: '0.0.0.0'
    });
  }
}
```

#### Plugin Registration Pattern
```typescript
// Consistent plugin registration across services
async function registerPlugins(server: FastifyInstance) {
  // Core plugins
  await server.register(require('@fastify/cors'));
  await server.register(require('@fastify/helmet'));
  await server.register(require('@fastify/rate-limit'));
  
  // GraphQL plugin
  await server.register(require('mercurius'), config);
  
  // Service-specific plugins
  await server.register(require('@fastify/websocket')); // For real-time
  await server.register(require('@fastify/redis')); // For caching
}
```

## Alternatives Considered

### Option 1: Express.js
- **Pros**: Most popular, mature ecosystem, extensive documentation
- **Cons**: Slower performance, callback-based, poor TypeScript support
- **Reason for rejection**: Performance requirements and TypeScript experience

### Option 2: Koa.js
- **Pros**: Modern async/await, lightweight, clean middleware
- **Cons**: Smaller ecosystem, requires more setup, no built-in GraphQL support
- **Reason for rejection**: Less comprehensive than Fastify for our needs

### Option 3: NestJS
- **Pros**: Enterprise-ready, decorator-based, excellent TypeScript
- **Cons**: Heavy framework, opinionated architecture, learning curve
- **Reason for rejection**: Overkill for microservices, prefers different patterns

## Consequences

### Positive
- ✅ **Superior Performance**: 2.5x faster than Express enables better scalability
- ✅ **TypeScript Native**: Excellent developer experience with type safety
- ✅ **Plugin System**: Rich ecosystem with proper encapsulation
- ✅ **GraphQL Integration**: Mercurius provides optimal GraphQL performance
- ✅ **Modern Patterns**: Built-in async/await, schema validation
- ✅ **Consistency**: Same framework across all services

### Negative
- ⚠️ **Learning Curve**: Team needs to learn Fastify patterns
- ⚠️ **Smaller Community**: Less Stack Overflow content than Express
- ⚠️ **Fewer Resources**: Less third-party tutorials and examples

### Risks & Mitigations
- **Risk**: Team unfamiliarity with Fastify
  - **Mitigation**: Comprehensive documentation, training sessions
  
- **Risk**: Limited third-party plugins
  - **Mitigation**: Active ecosystem, easy to create custom plugins
  
- **Risk**: Performance claims unproven in our context
  - **Mitigation**: Benchmark testing in our specific use cases

## Validation

### Success Criteria
- [ ] All services achieve <50ms response times
- [ ] Support 1000+ concurrent connections per service
- [ ] Developer satisfaction >4/5 for TypeScript experience
- [ ] Memory usage <512MB per service instance
- [ ] Successful GraphQL federation implementation

### Testing Approach
- Load testing with realistic GraphQL queries
- Memory usage profiling under load
- Developer experience surveys
- Performance comparison benchmarks

## References

- [Fastify Performance Benchmarks](https://fastify.io/benchmarks/)
- [Fastify TypeScript Documentation](https://fastify.io/docs/latest/Reference/TypeScript/)
- [Mercurius Fastify Integration](https://mercurius.dev/)
- [Fastify Plugin Development](https://fastify.io/docs/latest/Guides/Plugins-Guide/)

## Changelog

- **2025-01-27**: Initial decision for Fastify adoption