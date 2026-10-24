import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';

// Usage: DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/sync-indexes.ts <file berisi CREATE INDEX>
async function main() {
  const db = createClient({ url: process.env.DATABASE_URL as string, authToken: process.env.TURSO_AUTH_TOKEN });
  const { rows } = await db.execute("SELECT name FROM sqlite_master WHERE type='index'");
  const existing = new Set(rows.map((r) => String(r.name)));
  const statements = readFileSync(process.argv[2], 'utf-8').split('\n').filter(Boolean);
  for (const stmt of statements) {
    const name = stmt.match(/INDEX "([^"]+)"/)?.[1];
    if (!name || existing.has(name)) continue;
    await db.execute(stmt);
    console.log(`Dibuat: ${name}`);
  }
  console.log(`Total index di schema: ${statements.length}`);
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
