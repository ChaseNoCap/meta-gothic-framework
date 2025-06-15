import { makeExecutableSchema } from '@graphql-tools/schema';
/**
 * Build a Cosmo-compatible federated subgraph schema
 * This replaces @apollo/subgraph's buildSubgraphSchema
 */
export function buildCosmoSubgraphSchema(config) {
    const { typeDefs, resolvers } = config;
    // Parse typeDefs if it's a string to add federation directives
    const typeDefsWithFederation = typeof typeDefs === 'string'
        ? typeDefs
        : typeDefs.loc?.source?.body || typeDefs;
    // Extract entity types from the schema (types with @key directive)
    const entityTypes = [];
    const typeDefLines = typeDefsWithFederation.split('\n');
    for (let i = 0; i < typeDefLines.length; i++) {
        const line = typeDefLines[i];
        if (line.includes('type ') && line.includes('@key')) {
            const match = line.match(/type\s+(\w+)/);
            if (match) {
                entityTypes.push(match[1]);
            }
        }
    }
    // For Cosmo, we need to ensure federation directives are available
    // Cosmo handles these differently than Apollo Federation
    const federationDirectives = `
    directive @key(fields: _FieldSet!, resolvable: Boolean = true) repeatable on OBJECT | INTERFACE
    directive @shareable repeatable on OBJECT | FIELD_DEFINITION
    directive @external on OBJECT | FIELD_DEFINITION
    directive @requires(fields: _FieldSet!) on FIELD_DEFINITION
    directive @provides(fields: _FieldSet!) on FIELD_DEFINITION
    directive @tag(name: String!) repeatable on FIELD_DEFINITION | OBJECT | INTERFACE | UNION | ARGUMENT_DEFINITION | SCALAR | ENUM | ENUM_VALUE | INPUT_OBJECT | INPUT_FIELD_DEFINITION
    directive @override(from: String!) on FIELD_DEFINITION
    directive @inaccessible on FIELD_DEFINITION | OBJECT | INTERFACE | UNION | ARGUMENT_DEFINITION | SCALAR | ENUM | ENUM_VALUE | INPUT_OBJECT | INPUT_FIELD_DEFINITION
    directive @composeDirective(name: String!) repeatable on SCHEMA
    directive @interfaceObject on OBJECT
    directive @link(url: String!, as: String, for: String, import: [String]) repeatable on SCHEMA
  `;
    // Combine original schema with federation additions
    const entityUnion = entityTypes.length > 0
        ? `union _Entity = ${entityTypes.join(' | ')}`
        : '';
    // Only add _entities query if there are actual entities
    const entitiesQuery = entityTypes.length > 0
        ? '_entities(representations: [_Any!]!): [_Entity]!'
        : '';
    const fullTypeDefs = `
    ${federationDirectives}
    ${typeDefsWithFederation}
    
    scalar _Any
    scalar _FieldSet
    
    extend type Query {
      ${entitiesQuery}
      _service: _Service!
    }
    
    type _Service {
      sdl: String!
    }
    
    ${entityUnion}
  `;
    // Build federation Query resolvers
    const federationQueryResolvers = {
        _service: () => ({
            sdl: fullTypeDefs
        })
    };
    // Only add _entities resolver if there are entities
    if (entityTypes.length > 0) {
        federationQueryResolvers._entities = async (_parent, { representations }, context, info) => {
            const results = await Promise.all(representations.map(async (reference) => {
                const typename = reference.__typename;
                // Look for resolver in the original resolvers
                if (resolvers[typename]?.__resolveReference) {
                    return resolvers[typename].__resolveReference(reference, context, info);
                }
                // Default: return the reference itself
                return reference;
            }));
            return results;
        };
    }
    // Merge federation resolvers with user resolvers
    const mergedResolvers = {
        ...resolvers,
        Query: {
            ...resolvers.Query,
            ...federationQueryResolvers
        },
        // Ensure Mutation and Subscription resolvers are preserved
        ...(resolvers.Mutation && { Mutation: resolvers.Mutation }),
        ...(resolvers.Subscription && { Subscription: resolvers.Subscription })
    };
    // Debug log merged resolvers
    console.log('[buildCosmoSubgraphSchema] Merged resolvers:', {
        hasQuery: !!mergedResolvers.Query,
        queryKeys: Object.keys(mergedResolvers.Query || {}),
        hasMutation: !!mergedResolvers.Mutation,
        mutationKeys: Object.keys(mergedResolvers.Mutation || {}),
        hasSubscription: !!mergedResolvers.Subscription,
        subscriptionKeys: Object.keys(mergedResolvers.Subscription || {}),
        subscriptionResolverTypes: mergedResolvers.Subscription ?
            Object.entries(mergedResolvers.Subscription).map(([key, value]) => `${key}: ${typeof value}`) : []
    });
    const schema = makeExecutableSchema({
        typeDefs: fullTypeDefs,
        resolvers: mergedResolvers
    });
    return schema;
}
/**
 * Helper to create reference resolvers
 */
export function createReferenceResolver(fetchFn) {
    return async (reference, context) => {
        const id = reference['id'] || reference['_id'];
        if (!id)
            return null;
        return fetchFn(id, context);
    };
}
//# sourceMappingURL=cosmo-subgraph.js.map