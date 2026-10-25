import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import type { DriveFileSpec, DriveMetadata, DriveStorage } from "../lib/google-drive.server";
import { attachManagedFiles, cleanupManagedFiles, discardManagedUpload, finalizeManagedUpload, loadManagedClaims, lockManagedFiles, startManagedUpload, storageIpHash } from "../lib/managed-storage.server";
import { readManagedFile } from "../lib/managed-file-read.server";
import { saveManagedForm } from "../lib/managed-form.server";
import { persistManagedVolunteerProfile } from "../lib/managed-volunteer-profile.server";
import { getSchemas } from "../lib/validations";
import { MANAGED_FORM_FIELDS, MANAGED_FORM_KEY } from "../lib/storage-contract";
import { DRIVE_SESSION_RETENTION_MS, StorageError, UPLOAD_TICKET_MS, managedFileUrl, type ManagedClaim, type ManagedStart } from "../lib/storage-contract";
import { migrateManagedStorage } from "../scripts/migrate-managed-storage";
import { restoreSnapshot, snapshotDatabase, snapshotHash } from "../scripts/release-database";

const url = `file:${path.resolve(".npm-cache", `storage-test-${randomUUID()}.db`)}`;
const db = new PrismaClient({ adapter: new PrismaLibSQL({ url }) });
const secret = "isolated-storage-test-signing-secret";
const previousSecret = process.env.STORAGE_SIGNING_SECRET;
const publicActor = { id: null };
const resources = new Map<string, DriveMetadata>();
const signatures = new Map<string, Uint8Array>();
const deleted: string[] = [];
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
let admin: { id: string };
let finance: { id: string };
let suspended: { id: string };
const drive: DriveStorage = {
  folderId: "fixture-folder-id", generateId: async () => `fixture-${randomUUID()}`,
  health: async () => {},
  start: async (file: DriveFileSpec) => {
    resources.set(file.id, { id: file.id, mimeType: file.mime, size: String(file.bytes), parents: [drive.folderId], ownedByMe: true, trashed: false,
      appProperties: { application: "kanakaos", managedId: file.managedId, purpose: file.purpose }, permissions: [{ type: "user", role: "owner" }] });
    signatures.set(file.id, png);
    return "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=fixture";
  },
  metadata: async id => resources.get(id) ?? null,
  prefix: async id => signatures.get(id) ?? new Uint8Array(),
  download: async () => new Response(png),
  trash: async id => { deleted.push(id); resources.delete(id); },
  upload: async () => {},
};
const request = (purpose: ManagedStart["file"]["purpose"] = "VOLUNTEER_PHOTO", mode: "public" | "staff" = "public", targetId?: string): ManagedStart => ({ mode, nonce: randomUUID(), targetId, file: { purpose, filename: "fixture.png", mime: "image/png", bytes: png.length } });
const start = (input = request(), actor: { id: string | null } = publicActor, now = Date.now()) => startManagedUpload(db, drive, input, actor, secret, storageIpHash(secret, randomUUID()), now);
const claim = (upload: ManagedClaim) => ({ id: upload.id, ticket: upload.ticket });
const isCode = (code: string) => (error: unknown) => error instanceof StorageError && error.code === code;

before(async () => {
  process.env.STORAGE_SIGNING_SECRET = secret;
  mkdirSync(path.resolve(".npm-cache"), { recursive: true });
  const sql = execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { encoding: "utf8", env: { ...process.env, DATABASE_URL: url, TURSO_AUTH_TOKEN: "" } });
  const client = createClient({ url });
  try { await client.executeMultiple(sql); } finally { client.close(); }
  admin = await db.user.create({ data: { name: "Storage test admin", email: "storage-admin@example.test", password: "unused", role: "SUPER_ADMIN" } });
  finance = await db.user.create({ data: { name: "Storage test finance", email: "storage-finance@example.test", password: "unused", role: "FINANCE" } });
  suspended = await db.user.create({ data: { name: "Suspended fixture", email: "storage-suspended@example.test", password: "unused", role: "SUPER_ADMIN", isActive: false } });
});
after(async () => {
  await db.$disconnect();
  if (previousSecret === undefined) delete process.env.STORAGE_SIGNING_SECRET;
  else process.env.STORAGE_SIGNING_SECRET = previousSecret;
});

test("storage migration is additive, repeatable, backup-safe and refuses partial schemas", async () => {
  const client = createClient({ url: `file:./.npm-cache/storage-migration-${randomUUID()}.db` });
  const backup = createClient({ url: `file:./.npm-cache/storage-backup-${randomUUID()}.db` });
  try {
    await client.batch(["CREATE TABLE User (id TEXT PRIMARY KEY)", "CREATE TABLE Volunteer (id TEXT PRIMARY KEY, ktpUrl TEXT)", "INSERT INTO Volunteer VALUES ('legacy', 'https://legacy.invalid/retained.png')"], "write");
    const before = await snapshotDatabase(client);
    await migrateManagedStorage(client);
    const after = await snapshotDatabase(client);
    assert.deepEqual(after.tables.filter(table => table.name !== "ManagedFile"), before.tables);
    await migrateManagedStorage(client);
    assert.equal(snapshotHash(await snapshotDatabase(client)), snapshotHash(after));
    await restoreSnapshot(after, backup);
    assert.equal(snapshotHash(await snapshotDatabase(backup)), snapshotHash(after));
    const malformed = createClient({ url: `file:./.npm-cache/storage-drift-${randomUUID()}.db` });
    try {
      await malformed.batch(["CREATE TABLE User (id TEXT PRIMARY KEY)", "CREATE TABLE Volunteer (id TEXT PRIMARY KEY)", "CREATE TABLE ManagedFile (id TEXT PRIMARY KEY)"], "write");
      const original = snapshotHash(await snapshotDatabase(malformed));
      await assert.rejects(migrateManagedStorage(malformed), /schema drift/);
      assert.equal(snapshotHash(await snapshotDatabase(malformed)), original);
    } finally { malformed.close(); }
  } finally { client.close(); backup.close(); }
});

test("public claims cannot edit existing entities, access private documents, or cross registration nonces", async () => {
  const input = request();
  const upload = await start(input);
  await assert.rejects(start({ ...input, targetId: admin.id }), isCode("INVALID"));
  await assert.rejects(start(request("PROFILE_PHOTO")), isCode("INVALID"));
  await assert.rejects(finalizeManagedUpload(db, drive, claim(upload), admin, secret), isCode("FORBIDDEN"));
  await finalizeManagedUpload(db, drive, claim(upload), publicActor, secret);
  await assert.rejects(readManagedFile(db, drive, upload.id, publicActor), isCode("FORBIDDEN"));
  await assert.rejects(db.$transaction(tx => loadManagedClaims(tx, { nonce: randomUUID(), claims: [claim(upload)] }, publicActor, undefined, ["VOLUNTEER_PHOTO"], secret)), isCode("FORBIDDEN"));
  await assert.rejects(db.$transaction(tx => loadManagedClaims(tx, { nonce: input.nonce, claims: [claim(upload), claim(upload)] }, publicActor, undefined, ["VOLUNTEER_PHOTO"], secret)), isCode("INVALID"));
});

test("independent finalize verification rejects wrong metadata, sharing, size, MIME and signatures", async () => {
  for (const variation of ["parent", "owner", "size", "mime", "purpose", "shared", "signature"] as const) {
    const upload = await start();
    const file = await db.managedFile.findUniqueOrThrow({ where: { id: upload.id } });
    const metadata = resources.get(file.driveFileId)!;
    if (variation === "parent") metadata.parents = ["foreign-folder"];
    if (variation === "owner") metadata.ownedByMe = false;
    if (variation === "size") metadata.size = "999";
    if (variation === "mime") metadata.mimeType = "text/html";
    if (variation === "purpose") metadata.appProperties!.purpose = "VOLUNTEER_KTP";
    if (variation === "shared") metadata.permissions = [{ type: "anyone", role: "reader" }];
    if (variation === "signature") signatures.set(file.driveFileId, new Uint8Array([60, 104, 116, 109, 108]));
    await assert.rejects(finalizeManagedUpload(db, drive, claim(upload), publicActor, secret), isCode("INVALID"));
    assert.equal((await db.managedFile.findUniqueOrThrow({ where: { id: upload.id } })).state, "PENDING");
  }
});

test("claims attach atomically, reject reuse on another record, and preserve private role boundaries", async () => {
  const input = request();
  const upload = await start(input);
  await finalizeManagedUpload(db, drive, claim(upload), publicActor, secret);
  const bundle = { nonce: input.nonce, claims: [claim(upload)] };
  const volunteer = await db.$transaction(async tx => {
    await lockManagedFiles(tx);
    const files = await loadManagedClaims(tx, bundle, publicActor, undefined, ["VOLUNTEER_PHOTO"], secret);
    const parent = await tx.volunteer.create({ data: { name: "Non-production fixture", status: "PENDING" } });
    await attachManagedFiles(tx, files, "Volunteer", parent.id);
    return parent;
  });
  const repeat = await db.$transaction(async tx => {
    await lockManagedFiles(tx);
    const files = await loadManagedClaims(tx, bundle, publicActor, undefined, ["VOLUNTEER_PHOTO"], secret);
    await attachManagedFiles(tx, files, "Volunteer", volunteer.id);
    return files;
  });
  const other = await db.volunteer.create({ data: { name: "Other fixture" } });
  await assert.rejects(db.$transaction(tx => attachManagedFiles(tx, repeat, "Volunteer", other.id)), isCode("FORBIDDEN"));
  await discardManagedUpload(db, claim(upload), publicActor, secret);
  assert.equal((await db.managedFile.findUniqueOrThrow({ where: { id: upload.id } })).state, "ATTACHED");
  for (const actor of [publicActor, finance, suspended]) await assert.rejects(readManagedFile(db, drive, upload.id, actor), isCode("FORBIDDEN"));
  const response = await readManagedFile(db, drive, upload.id, admin);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), png);
});

test("expired tickets, discard/finalize races, and failed parent saves cannot attach files", async () => {
  const expired = await start(request(), publicActor, Date.now() - UPLOAD_TICKET_MS - 1000);
  await assert.rejects(finalizeManagedUpload(db, drive, claim(expired), publicActor, secret), isCode("EXPIRED"));
  const input = request("PROFILE_PHOTO", "staff", admin.id);
  const upload = await start(input, admin);
  await finalizeManagedUpload(db, drive, claim(upload), admin, secret);
  await assert.rejects(db.$transaction(async tx => {
    await lockManagedFiles(tx);
    const files = await loadManagedClaims(tx, { nonce: input.nonce, claims: [claim(upload)] }, admin, admin.id, ["PROFILE_PHOTO"], secret);
    await tx.user.update({ where: { id: admin.id }, data: { photoUrl: managedFileUrl(upload.id) } });
    await attachManagedFiles(tx, files, "User", admin.id);
    throw new Error("Simulated parent failure");
  }), /Simulated parent/);
  assert.equal((await db.managedFile.findUniqueOrThrow({ where: { id: upload.id } })).state, "UPLOADED");
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: admin.id } })).photoUrl, null);
  await discardManagedUpload(db, claim(upload), admin, secret);
  await assert.rejects(finalizeManagedUpload(db, drive, claim(upload), admin, secret), isCode("INVALID"));
});

test("anonymous limits use durable nonce/IP hashes and count discarded attempts", async () => {
  const input = request();
  const ip = storageIpHash(secret, "fixture-shared-ip");
  for (let i = 0; i < 10; i++) {
    const upload = await startManagedUpload(db, drive, input, publicActor, secret, ip);
    await discardManagedUpload(db, claim(upload), publicActor, secret);
  }
  await assert.rejects(startManagedUpload(db, drive, input, publicActor, secret, ip), isCode("RATE_LIMIT"));
  for (let i = 0; i < 20; i++) {
    const upload = await startManagedUpload(db, drive, request(), publicActor, secret, ip);
    await discardManagedUpload(db, claim(upload), publicActor, secret);
  }
  await assert.rejects(startManagedUpload(db, drive, request(), publicActor, secret, ip), isCode("RATE_LIMIT"));
  const stored = await db.managedFile.findFirstOrThrow({ where: { clientIpHash: ip } });
  assert.notEqual(stored.nonceHash, input.nonce);
  assert.notEqual(stored.clientIpHash, "fixture-shared-ip");
});

test("cleanup retains attached and foreign files and revisits missing files until resumable sessions expire", async () => {
  const upload = await start();
  const file = await db.managedFile.findUniqueOrThrow({ where: { id: upload.id } });
  const metadata = resources.get(file.driveFileId)!;
  await discardManagedUpload(db, claim(upload), publicActor, secret);
  resources.delete(file.driveFileId);
  const now = Date.now();
  await cleanupManagedFiles(db, drive, now, 100);
  assert.equal((await db.managedFile.findUniqueOrThrow({ where: { id: file.id } })).state, "CLEANUP_PENDING");
  resources.set(file.driveFileId, metadata);
  await cleanupManagedFiles(db, drive, now + DRIVE_SESSION_RETENTION_MS + 1000, 100);
  assert.ok(deleted.includes(file.driveFileId));
  assert.equal((await db.managedFile.findUniqueOrThrow({ where: { id: file.id } })).state, "CLEANED");
  const attached = await db.managedFile.findFirstOrThrow({ where: { state: "ATTACHED" } });
  assert.ok(!deleted.includes(attached.driveFileId));
});

test("managed volunteer registration requires every selected file to finalize and concurrent retries create one PENDING profile", async () => {
  const actor = { id: "public", name: "Public fixture", public: true };
  const profile = getSchemas("en").volunteerSchema.parse({ name: "Managed applicant", email: `${randomUUID()}@example.test`, skills: ["LEGAL"], hasSafeguardingCert: true });
  const input = request();
  const photo = await start(input);
  const certificate = await start({ ...input, file: { ...input.file, purpose: "VOLUNTEER_CERTIFICATE" } });
  const bundle = { nonce: input.nonce, claims: [claim(photo), claim(certificate)], removeIds: [] };
  const count = await db.volunteer.count();
  await assert.rejects(persistManagedVolunteerProfile(db, secret, profile, { ...bundle, claims: [] }, actor), /Foto relawan/);
  await assert.rejects(persistManagedVolunteerProfile(db, secret, profile, bundle, actor), isCode("INVALID"));
  await finalizeManagedUpload(db, drive, claim(photo), publicActor, secret);
  await assert.rejects(persistManagedVolunteerProfile(db, secret, profile, bundle, actor), isCode("INVALID"));
  assert.equal(await db.volunteer.count(), count);
  await finalizeManagedUpload(db, drive, claim(certificate), publicActor, secret);
  const results = await Promise.all([
    persistManagedVolunteerProfile(db, secret, profile, bundle, actor),
    persistManagedVolunteerProfile(db, secret, profile, bundle, actor),
  ]);
  assert.equal(results[0].id, results[1].id);
  assert.equal(await db.volunteer.count(), count + 1);
  const saved = await db.volunteer.findUniqueOrThrow({ where: { id: results[0].id }, include: { managedFiles: true } });
  assert.equal(saved.status, "PENDING");
  assert.equal(saved.hasSafeguardingCert, false);
  assert.equal(saved.managedFiles.length, 2);
  assert.ok(saved.managedFiles.every(file => file.state === "ATTACHED"));
  assert.equal((await persistManagedVolunteerProfile(db, secret, profile, bundle, actor)).created, false);
  const foreignNonce = { ...bundle, nonce: randomUUID() };
  await assert.rejects(persistManagedVolunteerProfile(db, secret, { ...profile, email: `${randomUUID()}@example.test` }, foreignNonce, actor), isCode("FORBIDDEN"));
});

test("managed volunteer edits enforce combined legacy counts and preserve detached Drive history", async () => {
  const volunteer = await db.volunteer.create({ data: { name: "Legacy volunteer", status: "APPROVED", skill: "Legacy custom skill", ktpUrl: "https://legacy.example/ktp" } });
  const legacy = [];
  for (let index = 0; index < 6; index++) legacy.push(await db.volunteerAttachment.create({ data: {
    volunteerId: volunteer.id, kind: index === 0 ? "PHOTO" : "CERTIFICATE", filename: "Legacy fixture.png", publicId: `legacy-${randomUUID()}`,
    resourceType: "image", format: "png", bytes: 8, version: 1,
  } }));
  const actor = { id: admin.id, name: "Staff fixture", public: false };
  const profile = getSchemas("en").volunteerSchema.parse({ name: "Updated legacy volunteer", skills: ["IT"] });
  const input = request("VOLUNTEER_CERTIFICATE", "staff", volunteer.id);
  const certificate = await start(input, admin);
  await finalizeManagedUpload(db, drive, claim(certificate), admin, secret);
  const bundle = { nonce: input.nonce, claims: [claim(certificate)], removeIds: [] as string[] };
  await assert.rejects(persistManagedVolunteerProfile(db, secret, profile, bundle, actor, volunteer.id), /Jumlah lampiran/);
  assert.equal((await db.volunteer.findUniqueOrThrow({ where: { id: volunteer.id } })).name, volunteer.name);
  await persistManagedVolunteerProfile(db, secret, profile, { ...bundle, removeIds: [legacy[1].id] }, actor, volunteer.id);
  const retained = await db.volunteer.findUniqueOrThrow({ where: { id: volunteer.id } });
  assert.equal(retained.skill, volunteer.skill);
  assert.equal(retained.ktpUrl, volunteer.ktpUrl);
  assert.equal(retained.status, "APPROVED");
  assert.deepEqual(await db.volunteerAttachment.findUniqueOrThrow({ where: { id: legacy[0].id } }), legacy[0]);
  const photoInput = request("VOLUNTEER_PHOTO", "staff", volunteer.id);
  const photo = await start(photoInput, admin);
  await finalizeManagedUpload(db, drive, claim(photo), admin, secret);
  await persistManagedVolunteerProfile(db, secret, profile, { nonce: photoInput.nonce, claims: [claim(photo)], removeIds: [certificate.id] }, actor, volunteer.id);
  const historical = await db.managedFile.findUniqueOrThrow({ where: { id: certificate.id } });
  assert.equal(historical.state, "ATTACHED");
  assert.equal(historical.parentId, volunteer.id);
  assert.equal(historical.volunteerId, null);
  await assert.rejects(readManagedFile(db, drive, historical.id, admin), isCode("FORBIDDEN"));
  await cleanupManagedFiles(db, drive, Date.now() + DRIVE_SESSION_RETENTION_MS, 100);
  assert.ok(!deleted.includes(historical.driveFileId));
  assert.equal(await db.volunteerAttachment.count({ where: { volunteerId: volunteer.id, kind: "PHOTO" } }), 0);
  assert.equal(await db.managedFile.count({ where: { volunteerId: volunteer.id, purpose: "VOLUNTEER_PHOTO" } }), 1);
});

test("closed needs and foreign removal IDs cannot be consumed by managed volunteer saves", async () => {
  const need = await db.volunteerNeed.create({ data: { title: "Fixture need", quantity: 1 } });
  const profile = getSchemas("en").volunteerSchema.parse({ name: "Closed need applicant", skills: ["IT"], needId: need.id });
  const input = request();
  const photo = await start(input);
  await finalizeManagedUpload(db, drive, claim(photo), publicActor, secret);
  const bundle = { nonce: input.nonce, claims: [claim(photo)], removeIds: [] };
  const actor = { id: "public", name: "Public fixture", public: true };
  await db.volunteerNeed.update({ where: { id: need.id }, data: { status: "CLOSED" } });
  await assert.rejects(persistManagedVolunteerProfile(db, secret, profile, bundle, actor), /ditutup/);
  assert.equal(await db.volunteer.count({ where: { needId: need.id } }), 0);
  assert.equal((await db.managedFile.findUniqueOrThrow({ where: { id: photo.id } })).state, "UPLOADED");
  const owner = await db.volunteer.findFirstOrThrow({ where: { managedFiles: { some: { purpose: "VOLUNTEER_CERTIFICATE" } } }, include: { managedFiles: true } });
  const other = await db.volunteer.create({ data: { name: "Foreign removal target" } });
  await assert.rejects(persistManagedVolunteerProfile(db, secret, { ...profile, needId: undefined }, { nonce: randomUUID(), claims: [], removeIds: [owner.managedFiles[0].id] }, { id: admin.id, name: "Staff", public: false }, other.id), /Lampiran/);
});

test("generic form persistence atomically attaches verified claims, preserves legacy URLs, and rolls back parent changes", async () => {
  const child = await db.child.create({ data: { fullName: "Local fixture child", dob: new Date("2010-01-01"), gender: "MALE", photoUrl: "https://legacy.example/photo", aktaLahirUrl: "https://legacy.example/birth" } });
  const input = request("CHILD_PHOTO", "staff", child.id);
  const photo = await start(input, admin);
  const form = new FormData();
  form.set(MANAGED_FORM_KEY, JSON.stringify({ nonce: input.nonce, claims: [claim(photo)] }));
  const save = (formData: FormData) => saveManagedForm(db, formData, admin, child.id, MANAGED_FORM_FIELDS.child, (tx, urls) => tx.child.update({ where: { id: child.id }, data: { fullName: "Updated fixture", ...urls } }));
  await assert.rejects(save(form), isCode("INVALID"));
  assert.deepEqual(await db.child.findUniqueOrThrow({ where: { id: child.id } }), child);
  await finalizeManagedUpload(db, drive, claim(photo), admin, secret);
  await assert.rejects(saveManagedForm(db, form, admin, child.id, MANAGED_FORM_FIELDS.child, async (tx, urls) => {
    await tx.child.update({ where: { id: child.id }, data: { fullName: "Must roll back", ...urls } });
    throw new Error("Fixture dependent write failure");
  }), /dependent write/);
  assert.deepEqual(await db.child.findUniqueOrThrow({ where: { id: child.id } }), child);
  assert.equal((await db.managedFile.findUniqueOrThrow({ where: { id: photo.id } })).state, "UPLOADED");
  await save(form);
  await save(new FormData());
  const saved = await db.child.findUniqueOrThrow({ where: { id: child.id } });
  assert.equal(saved.photoUrl, managedFileUrl(photo.id));
  assert.equal(saved.aktaLahirUrl, child.aktaLahirUrl);
  assert.equal((await db.managedFile.findUniqueOrThrow({ where: { id: photo.id } })).parentId, child.id);
  const rawBytes = new FormData();
  rawBytes.set("photo", new Blob([png], { type: "image/png" }), "fixture.png");
  await assert.rejects(save(rawBytes), isCode("INVALID"));
  const foreignParent = await db.child.create({ data: { fullName: "Other local fixture", dob: child.dob, gender: "MALE" } });
  await assert.rejects(saveManagedForm(db, form, admin, foreignParent.id, MANAGED_FORM_FIELDS.child, (tx, urls) => tx.child.update({ where: { id: foreignParent.id }, data: urls })), isCode("FORBIDDEN"));
  await assert.rejects(saveManagedForm(db, new FormData(), suspended, child.id, MANAGED_FORM_FIELDS.child, (tx, urls) => tx.child.update({ where: { id: child.id }, data: urls })), isCode("FORBIDDEN"));
});
