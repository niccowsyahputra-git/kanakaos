import { createClient, type Client, type Transaction } from "@libsql/client";
import { realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// No environment-file loading or implicit database target. This CLI is local-only.
export function requireLocalFundingDatabase(url: string | undefined): string {
  if (!url?.startsWith("file:") || url.startsWith("file://")) {
    throw new Error("Supply --database file:./prisma/dev.db; remote targets are prohibited.");
  }
  const filename = url.slice(5);
  if (!filename || /[?#\0]/.test(filename) || filename === ":memory:") {
    throw new Error("Supply an existing local database file, without URL parameters.");
  }
  const absolute = realpathSync(resolve(filename));
  if (!statSync(absolute).isFile()) throw new Error("Database target must be an existing file.");
  return `file:${absolute}`;
}

export async function fundingRowCounts(tx: Transaction, tables?: string[]) {
  const names = tables ?? (await tx.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  )).rows.map(row => String(row.name));
  const counts: Record<string, number> = {};
  for (const table of names) {
    const quoted = table.replaceAll('"', '""');
    counts[table] = Number((await tx.execute(`SELECT COUNT(*) AS n FROM "${quoted}"`)).rows[0].n);
  }
  return counts;
}

export async function assertFundingForeignKeys(tx: Transaction) {
  if ((await tx.execute("PRAGMA foreign_key_check")).rows.length) {
    throw new Error("Foreign-key integrity check failed; no changes committed.");
  }
}

async function addColumn(tx: Transaction, table: string, name: string, definition: string) {
  const columns = (await tx.execute(`PRAGMA table_info("${table}")`)).rows;
  if (!columns.length) throw new Error(`Required existing table is missing: ${table}`);
  if (!columns.some(column => column.name === name)) {
    await tx.execute(`ALTER TABLE "${table}" ADD COLUMN "${name}" ${definition}`);
  }
}

// Schema only. Program classification belongs to backfill-program-funding.ts.
export async function migrateProgramFunding(db: Client) {
  const tx = await db.transaction("write");
  try {
    const before = await fundingRowCounts(tx);
    for (const table of ["Program", "FinanceExpense", "User"]) {
      if (!(table in before)) throw new Error(`Required existing table is missing: ${table}`);
    }
    await assertFundingForeignKeys(tx);
    await addColumn(tx, "Program", "sumberDana", "TEXT CHECK (\"sumberDana\" IN ('PENGGALANGAN', 'INTERNAL', 'CAMPURAN'))");
    await addColumn(tx, "Program", "porsiPenggalangan", 'REAL CHECK ("porsiPenggalangan" >= 0 AND "porsiPenggalangan" <= 100)');
    await addColumn(tx, "FinanceExpense", "sumberDana", "TEXT CHECK (\"sumberDana\" IN ('PENGGALANGAN', 'INTERNAL'))");
    await tx.execute(`CREATE TABLE IF NOT EXISTS "ProgramInternalAllocation" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "programId" TEXT NOT NULL,
      "amount" REAL NOT NULL CHECK ("amount" > 0),
      "createdById" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProgramInternalAllocation_programId_fkey" FOREIGN KEY ("programId")
        REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "ProgramInternalAllocation_createdById_fkey" FOREIGN KEY ("createdById")
        REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`);
    await tx.execute('CREATE INDEX IF NOT EXISTS "ProgramInternalAllocation_programId_idx" ON "ProgramInternalAllocation"("programId")');
    await tx.execute('CREATE INDEX IF NOT EXISTS "ProgramInternalAllocation_createdById_idx" ON "ProgramInternalAllocation"("createdById")');
    const after = await fundingRowCounts(tx, Object.keys(before));
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Existing row counts changed; no changes committed.");
    await assertFundingForeignKeys(tx);
    await tx.commit();
    return { before, after };
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const run = async () => {
    const index = process.argv.indexOf("--database");
    const url = requireLocalFundingDatabase(index < 0 ? undefined : process.argv[index + 1]);
    const db = createClient({ url });
    try {
      console.log("Local funding schema migration completed:", await migrateProgramFunding(db));
      console.log("Program sources are unchanged. Run the separate backfill next.");
    } finally {
      db.close();
    }
  };
  run().catch(error => { console.error(error); process.exitCode = 1; });
}
