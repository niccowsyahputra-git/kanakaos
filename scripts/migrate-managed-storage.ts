import { createClient, type Client } from "@libsql/client";
import { pathToFileURL } from "node:url";
import { assertFundingForeignKeys, fundingRowCounts, requireLocalFundingDatabase } from "./migrate-program-funding";

export async function migrateManagedStorage(db: Client) {
  const tx = await db.transaction("write");
  try {
    const before = await fundingRowCounts(tx);
    for (const table of ["User", "Volunteer"]) {
      if (!(table in before)) throw new Error(`Required existing table is missing: ${table}`);
    }
    await assertFundingForeignKeys(tx);
    await tx.execute(`CREATE TABLE IF NOT EXISTS "ManagedFile" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "driveFileId" TEXT NOT NULL,
      "purpose" TEXT NOT NULL,
      "filename" TEXT NOT NULL,
      "mime" TEXT NOT NULL,
      "expectedBytes" INTEGER NOT NULL CHECK ("expectedBytes" > 0 AND "expectedBytes" <= 10485760),
      "verifiedBytes" INTEGER,
      "uploaderId" TEXT,
      "nonceHash" TEXT NOT NULL,
      "clientIpHash" TEXT,
      "targetType" TEXT NOT NULL,
      "targetId" TEXT,
      "parentType" TEXT,
      "parentId" TEXT,
      "volunteerId" TEXT,
      "state" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("state" IN ('PENDING','UPLOADED','ATTACHED','CLEANUP_PENDING','CLEANED')),
      "expiresAt" DATETIME NOT NULL,
      "cleanupAfter" DATETIME NOT NULL,
      "verifiedAt" DATETIME,
      "attachedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "ManagedFile_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "ManagedFile_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`);
    // Refuse a partially deployed or incompatible table instead of hiding schema drift.
    const columns = (await tx.execute('PRAGMA table_info("ManagedFile")')).rows.map(row => row.name);
    for (const name of ["id", "driveFileId", "purpose", "filename", "mime", "expectedBytes", "verifiedBytes", "uploaderId", "nonceHash", "clientIpHash", "targetType", "targetId", "parentType", "parentId", "volunteerId", "state", "expiresAt", "cleanupAfter", "verifiedAt", "attachedAt", "createdAt", "updatedAt"]) {
      if (!columns.includes(name)) throw new Error("Managed storage schema drift; migration rolled back");
    }
    await tx.execute('CREATE UNIQUE INDEX IF NOT EXISTS "ManagedFile_driveFileId_key" ON "ManagedFile"("driveFileId")');
    for (const fields of [["parentType", "parentId"], ["volunteerId", "purpose"], ["state", "expiresAt"], ["nonceHash", "createdAt"], ["clientIpHash", "createdAt"]]) {
      await tx.execute(`CREATE INDEX IF NOT EXISTS "ManagedFile_${fields.join("_")}_idx" ON "ManagedFile"(${fields.map(field => `"${field}"`).join(",")})`);
    }
    const after = await fundingRowCounts(tx, Object.keys(before));
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Existing row counts changed; no changes committed.");
    await assertFundingForeignKeys(tx);
    await tx.commit();
    return { before, after };
  } catch (error) { await tx.rollback(); throw error; }
  finally { tx.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const run = async () => {
    const index = process.argv.indexOf("--database");
    const db = createClient({ url: requireLocalFundingDatabase(index < 0 ? undefined : process.argv[index + 1]) });
    try { await migrateManagedStorage(db); console.log("Local additive storage migration completed."); }
    finally { db.close(); }
  };
  run().catch(() => { console.error("Storage migration failed; no successful migration is claimed."); process.exitCode = 1; });
}
