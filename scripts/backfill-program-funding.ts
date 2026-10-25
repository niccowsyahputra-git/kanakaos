import { createClient, type Client } from "@libsql/client";
import { pathToFileURL } from "node:url";
import {
  assertFundingForeignKeys,
  fundingRowCounts,
  requireLocalFundingDatabase,
} from "./migrate-program-funding";

// Preview by default. Only the newly added, unset Program.sumberDana is updated.
export async function backfillProgramFunding(db: Client, apply = false) {
  const tx = await db.transaction(apply ? "write" : "read");
  try {
    const before = await fundingRowCounts(tx);
    await assertFundingForeignKeys(tx);
    const classification = `CASE WHEN "fundraisingTarget" > 0
      THEN 'PENGGALANGAN' ELSE 'INTERNAL' END`;
    const pending = await tx.execute(`SELECT ${classification} AS source, COUNT(*) AS count
      FROM "Program" WHERE "sumberDana" IS NULL GROUP BY ${classification}`);
    const planned = { PENGGALANGAN: 0, INTERNAL: 0 };
    for (const row of pending.rows) {
      planned[row.source as keyof typeof planned] = Number(row.count);
    }
    const updated = apply
      ? (await tx.execute(`UPDATE "Program" SET "sumberDana" = ${classification}
          WHERE "sumberDana" IS NULL`)).rowsAffected
      : 0;
    const after = await fundingRowCounts(tx, Object.keys(before));
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Existing row counts changed; no changes committed.");
    await assertFundingForeignKeys(tx);
    await tx.commit();
    return { dryRun: !apply, planned, updated, before, after };
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
      console.log("Local program funding backfill:", await backfillProgramFunding(db, process.argv.includes("--apply")));
    } finally {
      db.close();
    }
  };
  run().catch(error => { console.error(error); process.exitCode = 1; });
}
