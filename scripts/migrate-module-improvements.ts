import { createClient, type Client, type Transaction } from "@libsql/client";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { normalizeLocationName, recognizedLegacySkills, VOLUNTEER_FIELDS, VOLUNTEER_FIELD_CODES } from "../lib/option-catalogs";

const id = () => `c${randomBytes(12).toString("hex")}`;
async function addColumn(db: Transaction, table: string, name: string, definition: string) {
  const columns = await db.execute(`PRAGMA table_info("${table}")`);
  if (!columns.rows.some(column => column.name === name)) {
    await db.execute(`ALTER TABLE "${table}" ADD COLUMN "${name}" ${definition}`);
  }
}

export function requireLocalDatabase(url: string | undefined): string {
  if (!url?.startsWith("file:") || url.startsWith("file://")) {
    throw new Error("Supply an explicit local database: --database file:./prisma/dev.db. Remote targets are prohibited.");
  }
  return url;
}

export async function migrateModuleImprovements(db: Client) {
  const tx = await db.transaction("write");
  try {
    const counts = async () => {
      const result: Record<string, number> = {};
      for (const table of ["Employee", "Volunteer", "VolunteerNeed"]) {
        result[table] = Number((await tx.execute(`SELECT COUNT(*) AS n FROM "${table}"`)).rows[0].n);
      }
      return result;
    };
    const before = await counts();
    await tx.execute(`CREATE TABLE IF NOT EXISTS "EmployeeLocation" (
      "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "normalizedName" TEXT NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`);
    await tx.execute('CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeLocation_normalizedName_key" ON "EmployeeLocation"("normalizedName")');
    await addColumn(tx, "Employee", "entityLocationId", 'TEXT REFERENCES "EmployeeLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE');
    await addColumn(tx, "Employee", "status", "TEXT NOT NULL DEFAULT 'ACTIVE'");
    await tx.execute('CREATE INDEX IF NOT EXISTS "Employee_entityLocationId_idx" ON "Employee"("entityLocationId")');
    await tx.execute('CREATE INDEX IF NOT EXISTS "Employee_status_idx" ON "Employee"("status")');
    for (const name of ["skillsJson", "highestEducation", "major", "submissionKey"]) {
      await addColumn(tx, "Volunteer", name, "TEXT");
    }
    await tx.execute('CREATE UNIQUE INDEX IF NOT EXISTS "Volunteer_submissionKey_key" ON "Volunteer"("submissionKey")');
    for (const name of ["field", "otherField"]) await addColumn(tx, "VolunteerNeed", name, "TEXT");
    for (const name of ["startDate", "endDate"]) await addColumn(tx, "VolunteerNeed", name, "DATETIME");
    await tx.execute(`CREATE TABLE IF NOT EXISTS "VolunteerAttachment" (
      "id" TEXT NOT NULL PRIMARY KEY, "volunteerId" TEXT NOT NULL, "kind" TEXT NOT NULL,
      "filename" TEXT NOT NULL, "publicId" TEXT NOT NULL, "resourceType" TEXT NOT NULL,
      "deliveryType" TEXT NOT NULL DEFAULT 'authenticated', "format" TEXT NOT NULL,
      "bytes" INTEGER NOT NULL, "version" INTEGER NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await tx.execute('CREATE UNIQUE INDEX IF NOT EXISTS "VolunteerAttachment_publicId_key" ON "VolunteerAttachment"("publicId")');
    await tx.execute('CREATE INDEX IF NOT EXISTS "VolunteerAttachment_volunteerId_kind_idx" ON "VolunteerAttachment"("volunteerId", "kind")');

    const employees = await tx.execute('SELECT id, entityLocation FROM "Employee" WHERE "entityLocationId" IS NULL AND "entityLocation" IS NOT NULL');
    for (const employee of employees.rows) {
      const name = String(employee.entityLocation).trim().replace(/\s+/g, " ");
      if (!name) continue;
      const normalized = normalizeLocationName(name);
      await tx.execute({ sql: 'INSERT OR IGNORE INTO "EmployeeLocation" (id, name, normalizedName, updatedAt) VALUES (?, ?, ?, ?)', args: [id(), name, normalized, Date.now()] });
      const location = await tx.execute({ sql: 'SELECT id FROM "EmployeeLocation" WHERE normalizedName = ?', args: [normalized] });
      await tx.execute({ sql: 'UPDATE "Employee" SET entityLocationId = ? WHERE id = ?', args: [location.rows[0].id, employee.id] });
    }
    const volunteers = await tx.execute('SELECT id, skill FROM "Volunteer" WHERE skillsJson IS NULL');
    for (const volunteer of volunteers.rows) {
      const recognized = recognizedLegacySkills(volunteer.skill == null ? null : String(volunteer.skill));
      await tx.execute({ sql: 'UPDATE "Volunteer" SET skillsJson = ? WHERE id = ?', args: [JSON.stringify(recognized), volunteer.id] });
    }
    const needs = await tx.execute('SELECT id, title FROM "VolunteerNeed" WHERE field IS NULL');
    for (const need of needs.rows) {
      const field = VOLUNTEER_FIELD_CODES.find(code => VOLUNTEER_FIELDS[code] === String(need.title).trim());
      await tx.execute({ sql: 'UPDATE "VolunteerNeed" SET field = ?, otherField = ? WHERE id = ?', args: [field ?? "OTHER", field ? null : need.title, need.id] });
    }
    const after = await counts();
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Migration changed source row counts");
    const violations = await tx.execute("PRAGMA foreign_key_check");
    if (violations.rows.length) throw new Error("Foreign-key integrity check failed");
    await tx.commit();
    return { before, after };
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally { tx.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const index = process.argv.indexOf("--database");
  const url = requireLocalDatabase(index === -1 ? undefined : process.argv[index + 1]);
  const db = createClient({ url });
  migrateModuleImprovements(db).then(result => console.log("Local migration completed:", result))
    .catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.close());
}
