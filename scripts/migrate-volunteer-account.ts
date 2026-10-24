import { createClient } from '@libsql/client';

// Migrasi aditif (idempoten): kolom Volunteer.userId + index unik (akun login relawan).
// Usage: DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/migrate-volunteer-account.ts
async function main() {
  const db = createClient({ url: process.env.DATABASE_URL as string, authToken: process.env.TURSO_AUTH_TOKEN });

  const before = await db.execute('SELECT COUNT(*) AS c FROM "Volunteer"');
  console.log(`Volunteer sebelum: ${before.rows[0].c}`);

  const cols = await db.execute('PRAGMA table_info("Volunteer")');
  if (!cols.rows.some((r) => r.name === 'userId')) {
    await db.execute(
      'ALTER TABLE "Volunteer" ADD COLUMN "userId" REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE'
    );
    console.log('Kolom Volunteer.userId ditambahkan');
  }
  await db.execute(
    'CREATE UNIQUE INDEX IF NOT EXISTS "Volunteer_userId_key" ON "Volunteer"("userId")'
  );

  const after = await db.execute('SELECT COUNT(*) AS c FROM "Volunteer"');
  console.log(`Volunteer sesudah: ${after.rows[0].c}`);
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
