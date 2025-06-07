# 🚨 CRITICAL: Federation v2 Migration Required

## Current Status: BROKEN

The Cosmo Router cannot start due to missing `supergraphSdl` in the configuration. Services are still using legacy Yoga/Apollo/Mesh implementations that MUST be removed.

## Error
```
"could not load GraphQL schema for data source 0: no string found for key """
```

## Requirements

- ✅ Use **Cosmo Router** exclusively (no cloud)
- ✅ Implement **Federation v2** for all services
- ✅ Use **Federated SSE** for subscriptions
- ❌ **NO** Yoga, Apollo Server, or GraphQL Mesh
- ❌ **NO** cloud dependencies

## Migration Status

- [ ] Claude Service - Still using Yoga
- [ ] Git Service - Still using Yoga  
- [ ] GitHub Adapter - Still using Mesh
- [ ] Gateway - Cosmo Router not working

## See Migration Plan

Refer to `/docs/cosmo-federation-v2-migration.md` for the complete migration plan.

## DO NOT USE

The following are DEPRECATED and must be removed:
- Any Yoga server configurations
- Apollo Server (except Apollo Client in UI)
- GraphQL Mesh
- All experimental gateway files