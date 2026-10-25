import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { applyReleaseMigrations, restoreSnapshot, snapshotDatabase, snapshotHash } from "../scripts/release-database";
import { migrateModuleImprovements, requireLocalDatabase } from "../scripts/migrate-module-improvements";

test("module migration preserves rows, legacy data and foreign keys on repeated runs", async () => {
  const db = createClient({ url: `file:./.npm-cache/module-migration-${randomUUID()}.db` });
  try {
    await db.batch([
      'CREATE TABLE Employee (id TEXT PRIMARY KEY, entityLocation TEXT)',
      'CREATE TABLE Volunteer (id TEXT PRIMARY KEY, skill TEXT)',
      'CREATE TABLE VolunteerNeed (id TEXT PRIMARY KEY, title TEXT)',
      "INSERT INTO Employee VALUES ('e1', ' Kantor  Pusat '), ('e2', 'kantor pusat'), ('e3', NULL)",
      "INSERT INTO Volunteer VALUES ('v1', 'Legal, Olahraga'), ('v2', NULL)",
      "INSERT INTO VolunteerNeed VALUES ('n1', 'Legal'), ('n2', 'Pengajar lama')",
    ], "write");
    const first = await migrateModuleImprovements(db);
    assert.deepEqual(first.before, first.after);
    const snapshot = (await db.execute('SELECT * FROM Employee ORDER BY id')).rows;
    const second = await migrateModuleImprovements(db);
    assert.deepEqual(second.before, second.after);
    assert.deepEqual((await db.execute('SELECT * FROM Employee ORDER BY id')).rows, snapshot);
    assert.equal((await db.execute('SELECT COUNT(*) AS n FROM EmployeeLocation')).rows[0].n, 1);
    assert.equal(snapshot[0].status, "ACTIVE");
    assert.equal(snapshot[0].entityLocation, " Kantor  Pusat ");
    assert.equal(snapshot[0].entityLocationId, snapshot[1].entityLocationId);
    const volunteer = (await db.execute("SELECT * FROM Volunteer WHERE id = 'v1'")).rows[0];
    assert.equal(volunteer.skill, "Legal, Olahraga");
    assert.equal(volunteer.skillsJson, '["LEGAL"]');
    const legacyNeed = (await db.execute("SELECT * FROM VolunteerNeed WHERE id = 'n2'")).rows[0];
    assert.equal(legacyNeed.field, "OTHER");
    assert.equal(legacyNeed.otherField, "Pengajar lama");
    assert.equal(legacyNeed.startDate, null);
    assert.equal((await db.execute("PRAGMA foreign_key_check")).rows.length, 0);
  } finally { db.close(); }
});

test("migration CLI prohibits implicit and remote database targets", () => {
  for (const value of [undefined, "libsql://example.turso.io", "https://db", "file://remote/db"]) {
    assert.throws(() => requireLocalDatabase(value));
  }
  assert.equal(requireLocalDatabase("file:./prisma/dev.db"), "file:./prisma/dev.db");
});

async function releaseFixture(broken = false) {
  const db = createClient({ url: `file:./.npm-cache/release-test-${randomUUID()}.db`, intMode: "bigint" });
  await db.batch([
    'CREATE TABLE Employee (id TEXT PRIMARY KEY, entityLocation TEXT)',
    'CREATE TABLE Volunteer (id TEXT PRIMARY KEY, skill TEXT)',
    'CREATE TABLE VolunteerNeed (id TEXT PRIMARY KEY, title TEXT)',
    'CREATE TABLE User (id TEXT PRIMARY KEY)',
    `CREATE TABLE Program (id TEXT PRIMARY KEY${broken ? "" : ", fundraisingTarget REAL NOT NULL DEFAULT 0"})`,
    'CREATE TABLE FinanceExpense (id TEXT PRIMARY KEY)',
    'CREATE TABLE BinaryFixture (id INTEGER PRIMARY KEY, payload BLOB)',
    "INSERT INTO Employee VALUES ('e1', 'Main office')",
    "INSERT INTO Volunteer VALUES ('v1', 'Legal')",
    "INSERT INTO VolunteerNeed VALUES ('n1', 'Legal')",
    "INSERT INTO User VALUES ('u1')",
    "INSERT INTO Program (id) VALUES ('p1')",
    "INSERT INTO BinaryFixture VALUES (9223372036854775800, X'001122FF')",
  ], "write");
  return db;
}

test("release backup round-trips schema, blobs and large integers; all migrations commit together and rerun safely", async () => {
  const db = await releaseFixture();
  const backup = createClient({ url: `file:./.npm-cache/release-backup-test-${randomUUID()}.db`, intMode: "bigint" });
  try {
    const before = await snapshotDatabase(db);
    const hash = snapshotHash(before);
    await restoreSnapshot(before, backup);
    assert.equal(snapshotHash(await snapshotDatabase(backup)), hash);
    const result = await applyReleaseMigrations(db, hash);
    assert.equal(result.classified, 1);
    assert.equal((await db.execute('SELECT sumberDana FROM Program')).rows[0].sumberDana, 'INTERNAL');
    assert.equal((await db.execute('SELECT entityLocation FROM Employee')).rows[0].entityLocation, 'Main office');
    assert.equal(snapshotHash(await snapshotDatabase(backup)), hash, "the backup is never migrated");
    const migrated = snapshotHash(await snapshotDatabase(db));
    await applyReleaseMigrations(db, migrated);
    assert.equal(snapshotHash(await snapshotDatabase(db)), migrated);
  } finally { db.close(); backup.close(); }
});

test("release rejects data drift and rolls back earlier schema additions when a later migration fails", async () => {
  const db = await releaseFixture();
  const broken = await releaseFixture(true);
  try {
    const hash = snapshotHash(await snapshotDatabase(db));
    await db.execute("INSERT INTO Volunteer VALUES ('v2', NULL)");
    const drifted = snapshotHash(await snapshotDatabase(db));
    await assert.rejects(applyReleaseMigrations(db, hash), /changed since backup/);
    assert.equal(snapshotHash(await snapshotDatabase(db)), drifted);
    const original = snapshotHash(await snapshotDatabase(broken));
    await assert.rejects(applyReleaseMigrations(broken, original));
    assert.equal(snapshotHash(await snapshotDatabase(broken)), original);
  } finally { db.close(); broken.close(); }
});
