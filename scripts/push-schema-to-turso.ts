import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';

// Usage: DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/push-schema-to-turso.ts
const TURSO_URL = process.env.DATABASE_URL as string;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

async function pushSchemaToTurso() {
  console.log('🚀 Pushing schema to Turso...');

  const libsql = createClient({
    url: TURSO_URL,
    authToken: TURSO_TOKEN,
  });

  try {
    // Read SQL file
    const sql = readFileSync('/tmp/turso-schema.sql', 'utf-8');
    
    console.log(`📄 SQL file size: ${sql.length} bytes`);
    
    // Split by semicolons and filter
    const statements = sql
      .split(';\n')
      .map(s => s.trim())
      .filter(s => {
        // Remove lines that are only comments
        const lines = s.split('\n').filter(line => !line.trim().startsWith('--'));
        return lines.join('\n').trim().length > 0;
      })
      .map(s => {
        // Remove comment lines from the statement
        return s.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim();
      })
      .filter(s => s.length > 0);

    console.log(`📦 Found ${statements.length} SQL statements to execute`);

    if (statements.length === 0) {
      console.log('⚠️  No statements found. SQL content:');
      console.log(sql.substring(0, 500));
      return;
    }

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        await libsql.execute({ sql: statement, args: [] });
        if ((i + 1) % 10 === 0) {
          console.log(`✅ Executed ${i + 1}/${statements.length} statements`);
        }
      } catch (error) {
        console.error(`❌ Error executing statement ${i + 1}:`, error instanceof Error ? error.message : error);
        console.error('Statement:', statement.substring(0, 100));
      }
    }

    // Verify tables were created
    const tables = await libsql.execute({
      sql: "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      args: []
    });

    console.log(`\n✅ Schema pushed successfully!`);
    console.log(`📊 Created ${tables.rows.length} tables`);
    console.log('Tables:', tables.rows.map(r => r[0]).join(', '));

  } catch (error) {
    console.error('❌ Failed to push schema:', error);
    throw error;
  } finally {
    await libsql.close();
  }
}

pushSchemaToTurso().catch((e) => {
  console.error(e);
  process.exit(1);
});
