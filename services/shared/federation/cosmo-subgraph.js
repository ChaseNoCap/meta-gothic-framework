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
    const fullTypeDefs = `
    ${federationDirectives}
    ${typeDefsWithFederation}
    
    scalar _Any
    scalar _FieldSet
    
    extend type Query {
      _entities(representations: [_Any!]!): [_Entity]!
      _service: _Service!
    }
    
    type _Service {
      sdl: String!
    }
    
    ${entityUnion}
  `;
    const schema = makeExecutableSchema({
        typeDefs: fullTypeDefs,
        resolvers: {
            Query: {
                _entities: async (_parent, { representations }, context, info) => {
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
                },
                _service: () => ({
                    sdl: typeDefsWithFederation
                })
            },
            ...resolvers
        }
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