import { Client } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function checkTimescaleDB(client: Client): Promise<boolean> {
  try {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_available_extensions 
        WHERE name = 'timescaledb'
      ) as available
    `);
    return result.rows[0].available;
  } catch {
    return false;
  }
}

async function setupDatabase(): Promise<void> {
  const connectionString = process.env.DATABASE_URL || 
    'postgresql://josh@localhost:5432/quality_service';

  console.log('🔧 Setting up database for Quality Service...');
  console.log(`📍 Connection: ${connectionString.replace(/:[^:]*@/, ':****@')}`);

  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check if TimescaleDB is available
    const hasTimescaleDB = await checkTimescaleDB(client);
    
    let schemaFile: string;
    if (hasTimescaleDB) {
      console.log('✅ TimescaleDB extension available - using full schema');
      schemaFile = 'schema.sql';
    } else {
      console.log('ℹ️  TimescaleDB not available - using PostgreSQL-only schema');
      console.log('   For full functionality, install TimescaleDB:');
      console.log('   - Docker: docker run -d --name timescaledb -p 5432:5432 -e POSTGRES_PASSWORD=postgres timescale/timescaledb:latest-pg15');
      console.log('   - Or visit: https://docs.timescale.com/self-hosted/latest/install/');
      schemaFile = 'schema-postgres.sql';
    }

    // Read and execute schema
    const schemaSQL = readFileSync(
      join(__dirname, '../database', schemaFile), 
      'utf-8'
    );
    
    // Split by semicolons but preserve those within quotes
    const statements = schemaSQL
      .split(/;(?=(?:[^']*'[^']*')*[^']*$)/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Executing ${statements.length} SQL statements...`);

    let successCount = 0;
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        await client.query(statement);
        successCount++;
        if ((i + 1) % 10 === 0 || i === statements.length - 1) {
          console.log(`  ✓ Progress: ${i + 1}/${statements.length} statements executed`);
        }
      } catch (error) {
        console.error(`  ✗ Statement ${i + 1}/${statements.length} failed:`);
        console.error(`    ${statement.substring(0, 100)}...`);
        console.error(`    Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Continue with other statements even if one fails
        if (error instanceof Error && error.message.includes('already exists')) {
          console.log('    ℹ️  Object already exists, continuing...');
          successCount++;
        } else if (error instanceof Error && error.message.includes('does not exist')) {
          console.log('    ℹ️  Skipping TimescaleDB-specific statement...');
        } else {
          throw error;
        }
      }
    }

    console.log(`✅ Database schema created successfully (${successCount}/${statements.length} statements)`);

    // List created tables
    const tables = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    
    console.log('\n📊 Created tables:');
    tables.rows.forEach(row => {
      console.log(`  - ${row.tablename}`);
    });

    // Check for hypertables if TimescaleDB is installed
    if (hasTimescaleDB) {
      try {
        const hypertables = await client.query(`
          SELECT hypertable_name 
          FROM timescaledb_information.hypertables 
          WHERE hypertable_schema = 'public'
        `);
        
        if (hypertables.rows.length > 0) {
          console.log('\n⏱️  TimescaleDB hypertables:');
          hypertables.rows.forEach(row => {
            console.log(`  - ${row.hypertable_name}`);
          });
        }
      } catch {
        // TimescaleDB views might not be available
      }
    }

    console.log('\n🎉 Database setup complete!');
    console.log(`   Mode: ${hasTimescaleDB ? 'TimescaleDB (full features)' : 'PostgreSQL (basic features)'}`);

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the setup
setupDatabase().catch(console.error);