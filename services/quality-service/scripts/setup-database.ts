import { Client } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function setupDatabase(): Promise<void> {
  const connectionString = process.env.DATABASE_URL || 
    'postgresql://josh@localhost:5432/quality_service';

  console.log('🔧 Setting up TimescaleDB for Quality Service...');
  console.log(`📍 Connection: ${connectionString.replace(/:[^:]*@/, ':****@')}`);

  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Read and execute schema
    const schemaSQL = readFileSync(
      join(__dirname, '../database/schema.sql'), 
      'utf-8'
    );
    
    // Split by semicolons but preserve those within quotes
    const statements = schemaSQL
      .split(/;(?=(?:[^']*'[^']*')*[^']*$)/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Executing ${statements.length} SQL statements...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        await client.query(statement);
        console.log(`  ✓ Statement ${i + 1}/${statements.length} executed`);
      } catch (error) {
        console.error(`  ✗ Statement ${i + 1}/${statements.length} failed:`);
        console.error(`    ${statement.substring(0, 100)}...`);
        console.error(`    Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Continue with other statements even if one fails
        if (error instanceof Error && error.message.includes('already exists')) {
          console.log('    ℹ️  Object already exists, continuing...');
        } else {
          throw error;
        }
      }
    }

    console.log('✅ Database schema created successfully');

    // Verify TimescaleDB is installed
    const timescaleCheck = await client.query(`
      SELECT default_version, installed_version 
      FROM pg_available_extensions 
      WHERE name = 'timescaledb'
    `);
    
    if (timescaleCheck.rows.length > 0) {
      const { installed_version } = timescaleCheck.rows[0];
      console.log(`✅ TimescaleDB version ${installed_version || 'available'}`);
    } else {
      console.warn('⚠️  TimescaleDB extension not available. Please install TimescaleDB.');
    }

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

    // List hypertables
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

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🎉 Database setup complete!');
  }
}

// Run the setup
setupDatabase().catch(console.error);