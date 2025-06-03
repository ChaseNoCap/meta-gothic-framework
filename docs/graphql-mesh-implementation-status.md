# GraphQL Mesh Implementation Status

## Summary

We've discovered compatibility challenges between GraphQL Mesh and Mercurius federation implementation. While both claim federation support, there are practical integration issues.

## What We've Done

1. **✅ Created ADR-018** - Documented the decision to adopt GraphQL Mesh
2. **✅ Updated Backlog** - Prioritized GraphQL Mesh as #1 critical task
3. **✅ Installed GraphQL Mesh** - All necessary packages installed
4. **✅ Services Ready** - Both services running with Federation v2.10 schemas
5. **❌ Mesh Gateway** - Introspection failing due to compatibility issues

## The Issue

GraphQL Mesh is failing to introspect Mercurius services with the error:
```
Failed to fetch introspection from http://localhost:3002/graphql: 
TypeError: Cannot read properties of undefined (reading '__schema')
```

This suggests that the introspection query format expected by GraphQL Mesh differs from what Mercurius provides.

## Immediate Options

### Option 1: Direct Federation with Mercurius Gateway (Recommended)
Since our services already support federation, we can use `@mercuriusjs/gateway` directly:

```typescript
import gateway from '@mercuriusjs/gateway'

await app.register(gateway, {
  gateway: {
    services: [
      { name: 'repo-agent', url: 'http://localhost:3004/graphql' },
      { name: 'claude', url: 'http://localhost:3002/graphql' }
    ]
  }
})
```

### Option 2: Fix GraphQL Mesh Compatibility
- Investigate the introspection format mismatch
- Potentially add a compatibility layer
- More complex, uncertain timeline

### Option 3: Simple Proxy with Manual Federation
- Keep the simple gateway
- Manually implement entity resolution
- Loses automatic federation benefits

## Recommendation

**Use Mercurius Gateway** - Since our services are already Mercurius-based with federation support, using the native Mercurius gateway is the path of least resistance. This provides:
- Immediate federation support
- No compatibility issues
- Good performance
- Simpler architecture

## Next Steps

1. Implement Mercurius gateway (30 minutes)
2. Test federation queries
3. Update documentation
4. Consider GraphQL Mesh for future when adding non-GraphQL sources

## Lessons Learned

- "Automatic detection" requires compatible introspection formats
- Mercurius and GraphQL Mesh have different federation implementations
- Native solutions (Mercurius with Mercurius) work better than mixed stacks
- Apollo Router wasn't the only tool with Mercurius compatibility issues