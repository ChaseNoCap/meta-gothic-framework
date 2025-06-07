import { GraphQLSchema } from 'graphql';
interface SubgraphConfig {
    typeDefs: string | any;
    resolvers: any;
}
interface EntityReference {
    __typename: string;
    [key: string]: any;
}
/**
 * Build a Cosmo-compatible federated subgraph schema
 * This replaces @apollo/subgraph's buildSubgraphSchema
 */
export declare function buildCosmoSubgraphSchema(config: SubgraphConfig): GraphQLSchema;
/**
 * Helper to create reference resolvers
 */
export declare function createReferenceResolver<T>(fetchFn: (id: string, context: any) => Promise<T | null>): (reference: EntityReference, context: any) => Promise<T | null>;
export {};
//# sourceMappingURL=cosmo-subgraph.d.ts.map