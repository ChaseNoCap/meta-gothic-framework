#!/usr/bin/env node

/**
 * Test GraphQL Mesh introspection to see available GitHub operations
 */

// Use built-in fetch (Node 18+)

const GATEWAY_URL = 'http://localhost:3000/graphql';

const introspectionQuery = `
  query IntrospectionQuery {
    __schema {
      queryType {
        fields {
          name
          description
        }
      }
      mutationType {
        fields {
          name
          description
        }
      }
    }
  }
`;

async function checkGitHubOperations() {
  console.log('🔍 Checking GraphQL Mesh Gateway for GitHub Operations');
  console.log('=' .repeat(60));
  console.log(`Gateway URL: ${GATEWAY_URL}`);
  
  try {
    const response = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: introspectionQuery })
    });

    const data = await response.json();
    
    if (data.errors) {
      console.error('❌ GraphQL Errors:', JSON.stringify(data.errors, null, 2));
      return;
    }

    // Extract GitHub operations
    const queries = data.data.__schema.queryType.fields;
    const mutations = data.data.__schema.mutationType?.fields || [];
    
    const githubQueries = queries.filter(f => f.name.startsWith('GitHub_'));
    const githubMutations = mutations.filter(f => f.name.startsWith('GitHub_'));
    
    console.log('\n📊 GitHub Query Operations Available:');
    console.log('━'.repeat(50));
    if (githubQueries.length > 0) {
      githubQueries.forEach(q => {
        console.log(`✅ ${q.name}`);
        if (q.description) console.log(`   ${q.description}`);
      });
    } else {
      console.log('❌ No GitHub query operations found!');
    }
    
    console.log('\n📝 GitHub Mutation Operations Available:');
    console.log('━'.repeat(50));
    if (githubMutations.length > 0) {
      githubMutations.forEach(m => {
        console.log(`✅ ${m.name}`);
        if (m.description) console.log(`   ${m.description}`);
      });
    } else {
      console.log('❌ No GitHub mutation operations found!');
    }
    
    // Summary
    console.log('\n📈 Summary:');
    console.log(`   Total GitHub Queries: ${githubQueries.length}`);
    console.log(`   Total GitHub Mutations: ${githubMutations.length}`);
    
    if (githubQueries.length === 0 && githubMutations.length === 0) {
      console.log('\n⚠️  No GitHub operations found in the schema!');
      console.log('\nPossible issues:');
      console.log('1. The GitHub OpenAPI source might not be configured');
      console.log('2. The mesh gateway might need to be restarted');
      console.log('3. Check .meshrc.yaml for the GitHub REST source configuration');
    } else {
      console.log('\n🎉 GitHub operations are available through the federation gateway!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\n⚠️  Make sure the GraphQL Mesh gateway is running:');
    console.error('   cd services/meta-gothic-app');
    console.error('   npm run dev:mesh');
  }
}

// Run the check
checkGitHubOperations().catch(console.error);