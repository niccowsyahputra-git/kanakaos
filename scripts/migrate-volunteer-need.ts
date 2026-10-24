import { createClient } from '@libsql/client';

// Migrasi aditif (idempoten): tabel VolunteerNeed + kolom Volunteer.needId.
// Usage: DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/migrate-volunteer-need.ts
async function main() {
  const db = createClient({ url: process.env.DATABASE_URL as string, authToken: process.env.TURSO_AUTH_TOKEN });

  const before = await db.execute('SELECT COUNT(*) AS c FROM "Volunteer"');
  console.log(`Volunteer sebelum: ${before.rows[0].c}`);

  await db.execute(`CREATE TABLE IF NOT EXISTS "VolunteerNeed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL,
    "schedule" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`);
  await db.execute('CREATE INDEX IF NOT EXISTS "VolunteerNeed_status_idx" ON "VolunteerNeed"("status")');

  const cols = await db.execute('PRAGMA table_info("Volunteer")');
  if (!cols.rows.some((r) => r.name === 'needId')) {
    await db.execute(
      'ALTER TABLE "Volunteer" ADD COLUMN "needId" TEXT REFERENCES "VolunteerNeed" ("id") ON DELETE SET NULL ON UPDATE CASCADE'
    );
    console.log('Kolom Volunteer.needId ditambahkan');
  }
  await db.execute('CREATE INDEX IF NOT EXISTS "Volunteer_status_idx" ON "Volunteer"("status")');
  await db.execute('CREATE INDEX IF NOT EXISTS "Volunteer_needId_idx" ON "Volunteer"("needId")');

  const after = await db.execute('SELECT COUNT(*) AS c FROM "Volunteer"');
  console.log(`Volunteer sesudah: ${after.rows[0].c}`);
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
