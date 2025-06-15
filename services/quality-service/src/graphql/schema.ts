import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildCosmoSubgraphSchema } from '../../../shared/federation/cosmo-subgraph.js';
import { resolvers } from '../resolvers/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the GraphQL schema
const typeDefs = readFileSync(
  join(__dirname, '../../schema/schema-federated.graphql'),
  'utf-8'
);

// Build the federated schema
export const schema = buildCosmoSubgraphSchema({
  typeDefs,
  resolvers
});