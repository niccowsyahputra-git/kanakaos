import { createClient, type Client, type Transaction, type Value } from "@libsql/client";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, chmodSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { migrateModuleImprovements } from "./migrate-module-improvements";
import { migrateProgramFunding } from "./migrate-program-funding";
import { backfillProgramFunding } from "./backfill-program-funding";
import { migrateManagedStorage } from "./migrate-managed-storage";

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
type Reader = Pick<Client, "execute"> | Pick<Transaction, "execute">;
export type DatabaseSnapshot = {
  schema: { type: string; name: string; sql: string }[];
  tables: { name: string; columns: string[]; rows: Value[][] }[];
};
const serialize = (value: unknown) => JSON.stringify(value, (_key, entry) => {
  if (typeof entry === "bigint") return { bigint: String(entry) };
  if (entry instanceof ArrayBuffer) return { blob: Buffer.from(entry).toString("base64") };
  return entry;
});
export const snapshotHash = (snapshot: DatabaseSnapshot) => createHash("sha256").update(serialize(snapshot)).digest("hex");

export async function snapshotDatabase(db: Reader): Promise<DatabaseSnapshot> {
  const schema = (await db.execute("SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY type, name")).rows
    .map(row => ({ type: String(row.type), name: String(row.name), sql: String(row.sql) }));
  const tables = [];
  for (const table of schema.filter(row => row.type === "table")) {
    const result = await db.execute(`SELECT * FROM ${quote(table.name)}`);
    const rows = result.rows.map(row => result.columns.map(column => row[column]));
    rows.sort((a, b) => serialize(a).localeCompare(serialize(b)));
    tables.push({ name: table.name, columns: result.columns, rows });
  }
  return { schema, tables };
}

export async function restoreSnapshot(snapshot: DatabaseSnapshot, db: Client) {
  await db.execute("PRAGMA foreign_keys = OFF");
  const tx = await db.transaction("write");
  try {
    for (const entry of snapshot.schema.filter(row => row.type === "table")) await tx.execute(entry.sql);
    for (const table of snapshot.tables) {
      const sql = `INSERT INTO ${quote(table.name)} (${table.columns.map(quote).join(",")}) VALUES (${table.columns.map(() => "?").join(",")})`;
      for (const row of table.rows) await tx.execute({ sql, args: row });
    }
    for (const entry of snapshot.schema.filter(row => row.type !== "table")) await tx.execute(entry.sql);
    if ((await tx.execute("PRAGMA foreign_key_check")).rows.length) throw new Error("Restored backup has invalid foreign keys");
    await tx.commit();
  } catch (error) { await tx.rollback(); throw error; }
  finally { tx.close(); await db.execute("PRAGMA foreign_keys = ON"); }
}

// All additive migrations share one transaction; only this outer owner commits.
export async function applyReleaseMigrations(db: Client, expectedHash: string) {
  const tx = await db.transaction("write");
  try {
    const before = await snapshotDatabase(tx);
    if (snapshotHash(before) !== expectedHash) throw new Error("Database changed since backup; take a fresh backup and rehearse again");
    const nested = new Proxy(tx, {
      get(target, key) {
        if (key === "commit" || key === "rollback") return async () => {};
        if (key === "close") return () => {};
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const scoped = new Proxy(db, {
      get(target, key) {
        if (key === "transaction") return async () => nested;
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    await migrateModuleImprovements(scoped);
    await migrateProgramFunding(scoped);
    const classification = await backfillProgramFunding(scoped, true);
    await migrateManagedStorage(scoped);
    // Preserve every original column/value except the explicit nullable backfill destinations.
    const backfillFields: Record<string, string[]> = {
      Employee: ["entityLocationId"], Volunteer: ["skillsJson"],
      VolunteerNeed: ["field", "otherField"], Program: ["sumberDana"],
    };
    for (const table of before.tables) {
      const columns = table.columns.filter(name => !backfillFields[table.name]?.includes(name));
      const original = table.rows.map(row => columns.map(name => row[table.columns.indexOf(name)]));
      const result = await tx.execute(`SELECT ${columns.map(quote).join(",")} FROM ${quote(table.name)}`);
      const after = result.rows.map(row => columns.map(name => row[name]));
      const sorted = (rows: Value[][]) => rows.map(row => serialize(row)).sort();
      const actual = sorted(after);
      const expected = sorted(original);
      const preserved = table.name === "EmployeeLocation"
        ? expected.every(row => actual.includes(row))
        : serialize(expected) === serialize(actual);
      if (!preserved) throw new Error(`Original data changed in ${table.name}; migration rolled back`);
    }
    if ((await tx.execute("PRAGMA foreign_key_check")).rows.length) throw new Error("Migration foreign-key check failed");
    await tx.commit();
    return { classified: classification.updated, tablesPreserved: before.tables.length };
  } catch (error) { await tx.rollback(); throw error; }
  finally { tx.close(); }
}

async function main() {
  const expected = process.argv.indexOf("--expected-host");
  const url = process.env.DATABASE_URL;
  if (!url || expected < 0 || !process.env.TURSO_AUTH_TOKEN) throw new Error("Explicit expected host and production database credentials are required");
  const target = new URL(url);
  if (target.protocol !== "libsql:" || target.hostname !== process.argv[expected + 1] || target.username || target.password || target.search || target.hash) throw new Error("Production database target mismatch");
  const directory = path.resolve(".npm-cache", `production-backup-${randomUUID()}`);
  mkdirSync(directory, { mode: 0o700, recursive: true });
  chmodSync(directory, 0o700);
  const remote = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN, intMode: "bigint" });
  try {
    const read = await remote.transaction("read");
    let snapshot: DatabaseSnapshot;
    try { snapshot = await snapshotDatabase(read); await read.commit(); }
    catch (error) { await read.rollback(); throw error; }
    finally { read.close(); }
    const hash = snapshotHash(snapshot);
    for (const name of ["backup", "rehearsal"]) {
      const filename = path.join(directory, `${name}.db`);
      writeFileSync(filename, "", { flag: "wx", mode: 0o600 });
      const local = createClient({ url: `file:${filename}`, intMode: "bigint" });
      try {
        await restoreSnapshot(snapshot, local);
        if (snapshotHash(await snapshotDatabase(local)) !== hash) throw new Error("Backup restoration verification failed");
        if (name === "rehearsal") await applyReleaseMigrations(local, hash);
      } finally { local.close(); }
    }
    writeFileSync(path.join(directory, "manifest.json"), JSON.stringify({ host: target.hostname, sha256: hash, tables: snapshot.tables.map(table => ({ name: table.name, rows: table.rows.length })), createdAt: new Date().toISOString() }, null, 2), { mode: 0o600, flag: "wx" });
    console.log(`Verified backup and migration rehearsal: ${directory}`);
    if (!process.argv.includes("--apply")) { console.log("Preview only: production is unchanged."); return; }
    const result = await applyReleaseMigrations(remote, hash);
    console.log("Production additive migration committed:", result);
  } finally { remote.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    // Database errors can contain private data; retain only the safe migration message.
    const safe = error instanceof Error && /^(Database changed|Production database|Explicit expected|Original data|Backup restoration|Migration foreign-key|Restored backup)/.test(error.message);
    console.error(safe ? error.message : "Database release failed; no successful release is claimed. Inspect the protected backup before retrying.");
    process.exitCode = 1;
  });
}
