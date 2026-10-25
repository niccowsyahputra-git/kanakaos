import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";
import { v2 as cloudinary } from "cloudinary";
import type { Session } from "next-auth";
import { getSchemas } from "../lib/validations";
import { createTranslator } from "../lib/i18n/translate";
import { ASSET_LOCATIONS, EMPLOYEE_DEPARTMENTS, EMPLOYEE_POSITIONS, PARTNER_TYPES, VOLUNTEER_FIELD_CODES, VOLUNTEER_EDUCATION, catalogLabel, dateOnlyLabel } from "../lib/option-catalogs";
import { activeAdminWhere, canAccessAccount, validEmployeeChoice } from "../lib/employee-policy";
import { issueUpload, verifyUploads, readUploadTicket, discardOwnedUploads, type VolunteerStorage, type StoredResource, type UploadScope } from "../lib/volunteer-uploads.server";
import { persistVolunteerProfile } from "../lib/volunteer-profile.server";
import { MAX_UPLOAD_BYTES, signRequestSchema, type AttachmentKind, type UploadReceipt } from "../lib/volunteer-upload-contract";

// Framework boundaries only are stubbed. Actions, guards, auth policy and libSQL transactions are real.
const url = `file:${path.resolve(".npm-cache", `module-regression-${randomUUID()}.db`)}`;
const db = new PrismaClient({ adapter: new PrismaLibSQL({ url }) });
let session: Session | null = null;
let notificationFails = false;
const refreshed: string[] = [];
function stub(name: string, exports: object) {
  const id = require.resolve(name);
  require.cache[id] = { id, filename: id, loaded: true, exports } as NodeModule;
}
stub("react", { ...require("react"), cache: <T,>(fn: T) => fn });
stub("../lib/prisma", { prisma: db });
stub("next-auth/next", { getServerSession: async () => session });
stub("next/cache", { revalidatePath: (value: string) => refreshed.push(value) });
stub("../lib/i18n/server", { getT: async () => ({ locale: "en", tr: createTranslator("en"), t: {} }) });
stub("../lib/notify", { notifyRoles: async () => { if (notificationFails) throw new Error("Mock notification outage"); } });
const employee = require("../lib/actions/employee") as typeof import("../lib/actions/employee");
const locations = require("../lib/actions/employee-location") as typeof import("../lib/actions/employee-location");
const inventory = require("../lib/actions/inventory") as typeof import("../lib/actions/inventory");
const accounts = require("../lib/actions/user") as typeof import("../lib/actions/user");
const needs = require("../lib/actions/volunteer-need") as typeof import("../lib/actions/volunteer-need");
const settings = require("../lib/actions/settings") as typeof import("../lib/actions/settings");
const { auth } = require("../auth") as typeof import("../auth");
const { authOptions } = require("../lib/auth-options") as typeof import("../lib/auth-options");
const schemas = getSchemas("en");
let adminId: string;
let actor: { id: string; name: string; public: boolean };
const publicActor = { id: "public", name: "Public applicant", public: true };
const password = `Test-${randomUUID()}`;
function login(id: string, role = "SUPER_ADMIN") {
  session = { user: { id, name: "Test user", email: "test@example.test", role }, expires: "2099-01-01" };
}
const resources = new Map<string, StoredResource>();
const destroyed: string[] = [];
const storage: VolunteerStorage = {
  secret: "isolated-mock-storage-secret", cloudName: "mock", apiKey: "mock",
  resource: async id => { const value = resources.get(id); if (!value) throw new Error("Mock missing upload"); return value; },
  destroy: async id => { destroyed.push(id); resources.delete(id); return { result: "ok" }; },
};
function upload(kind: AttachmentKind, scope: UploadScope, now = Date.now()): UploadReceipt {
  const pdf = kind === "CERTIFICATE";
  const signed = issueUpload({ kind, filename: pdf ? "certificate.pdf" : "photo.png", mime: pdf ? "application/pdf" : "image/png", bytes: 100 }, scope, storage, now);
  const version = Math.floor(now / 1000);
  resources.set(signed.publicId, { public_id: signed.publicId, version, bytes: 100, format: pdf ? "pdf" : "png", resource_type: "image", type: "authenticated", created_at: new Date(now).toISOString() });
  return { ticket: signed.ticket, publicId: signed.publicId, version, signature: cloudinary.utils.api_sign_request({ public_id: signed.publicId, version }, storage.secret) };
}
const profile = (email = `${randomUUID()}@example.test`) => schemas.volunteerSchema.parse({ name: "Test Applicant", skills: ["LEGAL", "IT"], email, highestEducation: "S1", major: "User-authored major", hasSafeguardingCert: true });
const bundle = (scope: UploadScope, receipts: UploadReceipt[], removeIds: string[] = []) => ({ nonce: scope.nonce, receipts, removeIds });

before(async () => {
  mkdirSync(path.resolve(".npm-cache"), { recursive: true });
  const sql = execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { encoding: "utf8", env: { ...process.env, DATABASE_URL: url, TURSO_AUTH_TOKEN: "" } });
  const client = createClient({ url });
  try { await client.executeMultiple(sql); } finally { client.close(); }
  const admin = await db.user.create({ data: { name: "Local test admin", email: "admin@example.test", password: await bcrypt.hash(password, 4), role: "SUPER_ADMIN" } });
  adminId = admin.id;
  actor = { id: adminId, name: admin.name, public: false };
  login(adminId);
});
after(async () => { await db.$disconnect(); });

test("catalog values validate identically in both languages without rewriting legacy data", () => {
  assert.equal(ASSET_LOCATIONS.length, 16);
  assert.equal(VOLUNTEER_FIELD_CODES.length, 10);
  assert.equal(EMPLOYEE_DEPARTMENTS.length, 4);
  assert.equal(EMPLOYEE_POSITIONS.length, 6);
  assert.equal(catalogLabel("Simpan", EMPLOYEE_POSITIONS, createTranslator("en")), "Simpan");
  assert.equal(catalogLabel("Teras depan", ASSET_LOCATIONS, createTranslator("en")), "Front porch");
  for (const locale of ["id", "en"] as const) {
    const s = getSchemas(locale);
    for (const location of ASSET_LOCATIONS) assert.equal(s.assetSchema.parse({ name: "Test asset", category: "LAINNYA", acquisitionDate: "2020-01-01", value: 10, location, condition: "BAIK" }).location, location);
    for (const type of PARTNER_TYPES) assert.equal(s.partnerSchema.parse({ name: "Test partner", type }).type, type);
    for (const skill of VOLUNTEER_FIELD_CODES) assert.deepEqual(s.volunteerSchema.parse({ name: "Applicant", skills: [skill] }).skills, [skill]);
    for (const education of VOLUNTEER_EDUCATION) assert.equal(s.volunteerSchema.parse({ name: "Applicant", skills: ["LEGAL"], highestEducation: education }).highestEducation, education);
    assert.equal(s.volunteerSchema.safeParse({ name: "Applicant", skills: ["LEGAL", "LEGAL"] }).success, false);
    assert.equal(s.volunteerSchema.safeParse({ name: "Applicant", skills: ["arbitrary"] }).success, false);
    assert.equal(s.volunteerNeedSchema.safeParse({ field: "OTHER", quantity: 1, startDate: "2026-02-30", endDate: "2026-03-01" }).success, false);
    assert.equal(s.volunteerNeedSchema.safeParse({ field: "LEGAL", quantity: 1, startDate: "2026-03-02", endDate: "2026-03-01" }).success, false);
    assert.equal(s.volunteerNeedSchema.safeParse({ field: "OTHER", quantity: 1, startDate: "2026-03-01", endDate: "2026-03-01" }).success, false);
  }
  assert.ok(validEmployeeChoice("Legacy position", EMPLOYEE_POSITIONS, "Legacy position"));
  assert.ok(!validEmployeeChoice("Forged position", EMPLOYEE_POSITIONS, "Legacy position"));
  assert.match(dateOnlyLabel("2026-03-01", "en"), /1.*Mar|Mar.*1/);
});

test("inventory metadata edits preserve stock, history and purchase relationships; guards reject forged input", async () => {
  const item = await db.inventory.create({ data: { itemName: "Rice", category: "MAKANAN", quantity: 17, unit: "kg", minStock: 5 } });
  const adjustment = await db.stockAdjustment.create({ data: { inventoryId: item.id, delta: 17, reason: "Initial test stock", createdById: adminId } });
  const request = await db.purchaseRequest.create({ data: { inventoryId: item.id, quantity: 3, requestedById: adminId } });
  const values = { itemName: "Updated rice", category: "MAKANAN" as const, unit: "bags", minStock: 8, quantity: 999 };
  assert.equal((await inventory.updateInventoryItem(item.id, values)).success, true);
  const saved = await db.inventory.findUniqueOrThrow({ where: { id: item.id }, include: { adjustments: true, purchaseRequests: true } });
  assert.equal(saved.quantity, 17);
  assert.deepEqual(saved.adjustments, [adjustment]);
  assert.deepEqual(saved.purchaseRequests, [request]);
  assert.equal(saved.itemName, values.itemName);
  assert.equal(await db.auditLog.count({ where: { entityId: item.id, action: "UPDATE" } }), 1);
  assert.equal((await inventory.updateInventoryItem("invalid", values)).success, false);
  assert.equal((await inventory.updateInventoryItem(item.id, { ...values, category: "FORGED" as "MAKANAN" })).success, false);
  session = null;
  assert.equal((await inventory.updateInventoryItem(item.id, values)).success, false);
  login(adminId);
});

test("location add/rename/archive retains employee references and rejects forged or new inactive assignments", async () => {
  assert.equal((await locations.saveEmployeeLocation({ name: " Test Branch ", isActive: true })).success, true);
  const location = await db.employeeLocation.findUniqueOrThrow({ where: { normalizedName: "test branch" } });
  assert.equal((await locations.saveEmployeeLocation({ name: "TEST   BRANCH", isActive: true })).success, false);
  const values = { firstName: "Employee", gender: "MALE" as const, employeeCode: "TEST-1", employmentStatus: "KONTRAK" as const, entityLocationId: location.id, department: EMPLOYEE_DEPARTMENTS[0], position: EMPLOYEE_POSITIONS[0] };
  const created = await employee.createEmployee(values);
  assert.ok(created.success && created.id);
  assert.equal((await locations.saveEmployeeLocation({ id: location.id, name: "Renamed branch", isActive: false })).success, true);
  const current = await db.employee.findUniqueOrThrow({ where: { id: created.id }, include: { location: true } });
  assert.equal(current.location?.name, "Renamed branch");
  assert.equal((await employee.updateEmployee(current.id, values)).success, true);
  assert.equal((await employee.createEmployee({ ...values, employeeCode: "TEST-2" })).success, false);
  assert.equal((await employee.createEmployee({ ...values, employeeCode: "TEST-3", entityLocationId: "c000000000000000000000000" })).success, false);
  assert.equal((await employee.createEmployee({ ...values, employeeCode: "TEST-4", department: "Forged department", entityLocationId: undefined })).success, false);
  await db.employee.update({ where: { id: current.id }, data: { department: "Legacy dept", position: "Legacy position" } });
  assert.equal((await employee.updateEmployee(current.id, { ...values, department: "Legacy dept", position: "Legacy position" })).success, true);
  assert.equal((await locations.saveEmployeeLocation({ id: location.id, name: "Renamed branch", isActive: true })).success, true);
});

test("employee suspension revokes credential login and existing sessions while preserving manual account deactivation", async () => {
  const user = await db.user.create({ data: { name: "Staff test", email: "staff@example.test", password: await bcrypt.hash(password, 4), role: "SOCIAL_WORKER" } });
  const record = await db.employee.create({ data: { firstName: "Staff", gender: "MALE", employeeCode: "ACCESS", userId: user.id, employmentStatus: "KONTRAK" } });
  const provider = authOptions.providers[0] as unknown as { options: { authorize: (value: { email: string; password: string }) => Promise<unknown> } };
  assert.ok(await provider.options.authorize({ email: user.email, password }));
  assert.equal((await employee.setEmployeeStatus(record.id, "SUSPENDED")).success, true);
  assert.equal(await provider.options.authorize({ email: user.email, password }), null);
  login(user.id, "SUPER_ADMIN"); // Deliberately stale token role.
  assert.equal(await auth(), null);
  assert.equal((await locations.saveEmployeeLocation({ name: "Forbidden", isActive: true })).success, false);
  login(adminId);
  await db.user.update({ where: { id: user.id }, data: { isActive: false } });
  assert.equal((await accounts.toggleUserActive(user.id)).success, false);
  assert.equal((await employee.setEmployeeStatus(record.id, "ACTIVE")).success, true);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: user.id } })).isActive, false);
  assert.equal(await provider.options.authorize({ email: user.email, password }), null);
  assert.equal((await accounts.toggleUserActive(user.id)).success, true);
  login(user.id, "SUPER_ADMIN");
  assert.equal((await auth())?.user.role, "SOCIAL_WORKER");
  assert.equal((await employee.setEmployeeStatus(record.id, "INACTIVE")).success, false);
  login(adminId);
  assert.equal((await employee.setEmployeeStatus(record.id, "INACTIVE")).success, true);
  assert.equal(await provider.options.authorize({ email: user.email, password }), null);
  assert.equal((await db.employee.findUniqueOrThrow({ where: { id: record.id } })).employmentStatus, "KONTRAK");
  const unlinked = await db.employee.create({ data: { firstName: "Inactive", gender: "MALE", employeeCode: "UNLINKED", status: "INACTIVE" } });
  assert.equal((await accounts.createUserForEmployee(unlinked.id, { name: "New account", email: "unlinked@example.test", password, role: "SOCIAL_WORKER" })).success, false);
});

test("self-suspension and last effectively active admin demotion are blocked", async () => {
  const self = await db.employee.create({ data: { firstName: "Admin", gender: "MALE", employeeCode: "ADMIN", userId: adminId } });
  assert.equal((await employee.setEmployeeStatus(self.id, "SUSPENDED")).success, false);
  const inactive = await db.user.create({ data: { name: "Suspended admin", email: "inactive-admin@example.test", password: "unusable-test-hash", role: "SUPER_ADMIN" } });
  await db.employee.create({ data: { firstName: "Inactive", gender: "MALE", employeeCode: "INACTIVE-ADMIN", userId: inactive.id, status: "SUSPENDED" } });
  assert.equal(await db.user.count({ where: activeAdminWhere }), 1);
  assert.equal((await accounts.updateUser({ id: adminId, name: "Admin", role: "SOCIAL_WORKER" })).success, false);
  assert.equal((await accounts.toggleUserActive(adminId)).success, false);
  assert.equal((await accounts.deleteUser(adminId)).success, false);
  for (const status of ["SUSPENDED", "INACTIVE"]) assert.equal(canAccessAccount({ isActive: true, employee: { status } }), false);
});

test("upload tickets reject tampering, foreign ownership, expiry, duplicates, oversize and false metadata", async () => {
  const scope = { actor: "public", nonce: randomUUID() };
  const receipt = upload("PHOTO", scope);
  assert.equal((await verifyUploads([receipt], scope, storage))[0].deliveryType, "authenticated");
  assert.throws(() => readUploadTicket({ ...receipt, signature: "0".repeat(40) }, scope, storage.secret));
  assert.throws(() => readUploadTicket(receipt, { ...scope, actor: "other" }, storage.secret));
  assert.throws(() => readUploadTicket(receipt, { ...scope, nonce: randomUUID() }, storage.secret));
  assert.throws(() => readUploadTicket(receipt, scope, storage.secret, Date.now() + 16 * 60 * 1000));
  assert.throws(() => readUploadTicket({ ...receipt, ticket: receipt.ticket + "x" }, scope, storage.secret));
  await assert.rejects(verifyUploads([receipt, receipt], scope, storage));
  const resource = resources.get(receipt.publicId)!;
  for (const changes of [{ bytes: MAX_UPLOAD_BYTES + 1 }, { bytes: 99 }, { format: "pdf" }, { type: "upload" }, { resource_type: "raw" }, { public_id: "foreign" }]) {
    resources.set(receipt.publicId, { ...resource, ...changes });
    await assert.rejects(verifyUploads([receipt], scope, storage));
  }
  resources.set(receipt.publicId, resource);
  assert.equal(signRequestSchema.safeParse({ mode: "public", nonce: scope.nonce, files: [{ kind: "PHOTO", filename: "photo.pdf", mime: "application/pdf", bytes: 100 }] }).success, false);
  assert.equal(signRequestSchema.safeParse({ mode: "public", nonce: scope.nonce, files: [{ kind: "PHOTO", filename: "photo.png", mime: "image/png", bytes: MAX_UPLOAD_BYTES + 1 }], folder: "forged" }).success, false);
  assert.equal(signRequestSchema.safeParse({ mode: "public", nonce: scope.nonce, files: Array(6).fill({ kind: "CERTIFICATE", filename: "certificate.pdf", mime: "application/pdf", bytes: 100 }) }).success, false);
});

test("public profile commits one PENDING volunteer, photo and certificates; duplicate retries are idempotent", async () => {
  const scope = { actor: "public", nonce: randomUUID() };
  const receipts = [upload("PHOTO", scope), upload("CERTIFICATE", scope), upload("CERTIFICATE", scope)];
  const values = profile(" Mixed.Case@Example.test ");
  const saved = await persistVolunteerProfile(db, storage, values, bundle(scope, receipts), publicActor);
  const retry = await persistVolunteerProfile(db, storage, values, bundle(scope, receipts), publicActor);
  assert.equal(retry.id, saved.id);
  assert.equal(retry.created, false);
  const record = await db.volunteer.findUniqueOrThrow({ where: { id: saved.id }, include: { attachments: true } });
  assert.equal(record.status, "PENDING");
  assert.equal(record.hasSafeguardingCert, false);
  assert.equal(record.email, "mixed.case@example.test");
  assert.equal(record.highestEducation, "S1");
  assert.equal(record.skillsJson, '["LEGAL","IT"]');
  assert.equal(record.attachments.length, 3);
  assert.equal(await db.auditLog.count({ where: { entityId: saved.id } }), 1);
  const otherScope = { actor: "public", nonce: randomUUID() };
  await assert.rejects(persistVolunteerProfile(db, storage, profile("MIXED.CASE@example.test"), bundle(otherScope, [upload("PHOTO", otherScope)]), publicActor));
  await discardOwnedUploads(db, storage, receipts, scope);
  assert.ok(receipts.every(r => resources.has(r.publicId)));
});

test("missing photos and partial storage failures never create records; successful uploads remain retryable", async () => {
  const scope = { actor: "public", nonce: randomUUID() };
  const values = profile();
  await assert.rejects(persistVolunteerProfile(db, storage, values, bundle(scope, []), publicActor), /Foto/);
  const photo = upload("PHOTO", scope);
  const certificate = upload("CERTIFICATE", scope);
  const resource = resources.get(certificate.publicId)!;
  resources.delete(certificate.publicId);
  await assert.rejects(persistVolunteerProfile(db, storage, values, bundle(scope, [photo, certificate]), publicActor));
  assert.equal(await db.volunteer.count({ where: { email: values.email } }), 0);
  assert.ok(resources.has(photo.publicId));
  resources.set(certificate.publicId, resource);
  assert.ok((await persistVolunteerProfile(db, storage, values, bundle(scope, [photo, certificate]), publicActor)).created);
});

test("edits preserve legacy fields and attachments on failure; replace photo and remove certificates explicitly", async () => {
  const createScope = { actor: adminId, nonce: randomUUID() };
  const saved = await persistVolunteerProfile(db, storage, profile(), bundle(createScope, [upload("PHOTO", createScope), upload("CERTIFICATE", createScope)]), actor);
  await db.volunteer.update({ where: { id: saved.id }, data: { skill: "Legacy unrecognized skill", ktpUrl: "https://example.test/legacy", status: "APPROVED" } });
  const before = await db.volunteerAttachment.findMany({ where: { volunteerId: saved.id } });
  const scope = { actor: adminId, nonce: randomUUID(), volunteerId: saved.id };
  const replacement = upload("PHOTO", scope);
  await assert.rejects(persistVolunteerProfile(db, storage, profile(), bundle(scope, [{ ...replacement, signature: "0".repeat(40) }]), actor, saved.id));
  assert.deepEqual(await db.volunteerAttachment.findMany({ where: { volunteerId: saved.id } }), before);
  const removeIds = before.filter(a => a.kind === "CERTIFICATE").map(a => a.id);
  await persistVolunteerProfile(db, storage, profile(), bundle(scope, [replacement], removeIds), actor, saved.id);
  await persistVolunteerProfile(db, storage, profile(), bundle(scope, [replacement], removeIds), actor, saved.id);
  const current = await db.volunteer.findUniqueOrThrow({ where: { id: saved.id }, include: { attachments: true } });
  assert.equal(current.attachments.length, 1);
  assert.equal(current.attachments[0].publicId, replacement.publicId);
  assert.equal(current.skill, "Legacy unrecognized skill");
  assert.equal(current.ktpUrl, "https://example.test/legacy");
  assert.equal(current.status, "APPROVED");
});

test("all need states preserve applicant history and reject stale new assignments after upload", async () => {
  const created = await needs.createVolunteerNeed({ field: "OTHER", otherField: "User-authored activity", quantity: 2, startDate: "2027-01-01", endDate: "2027-02-01", schedule: "Legacy notes" });
  assert.ok(created.success && created.id);
  const scope = { actor: "public", nonce: randomUUID() };
  const receipt = upload("PHOTO", scope);
  await needs.setVolunteerNeedStatus(created.id, "SUSPENDED");
  await assert.rejects(persistVolunteerProfile(db, storage, { ...profile(), needId: created.id }, bundle(scope, [receipt]), publicActor));
  await needs.setVolunteerNeedStatus(created.id, "OPEN");
  const saved = await persistVolunteerProfile(db, storage, { ...profile(), needId: created.id }, bundle(scope, [receipt]), publicActor);
  for (const status of ["CLOSED", "SUSPENDED", "OPEN"] as const) {
    assert.equal((await needs.setVolunteerNeedStatus(created.id, status)).success, true);
    const need: import("@prisma/client").VolunteerNeed & { volunteers: import("@prisma/client").Volunteer[] } = await db.volunteerNeed.findUniqueOrThrow({ where: { id: created.id }, include: { volunteers: true } });
    assert.equal(Boolean(need.closedAt), status === "CLOSED");
    assert.equal(need.volunteers[0].id, saved.id);
    assert.equal(need.volunteers[0].status, "PENDING");
    assert.equal(need.schedule, "Legacy notes");
    const editScope = { actor: adminId, nonce: randomUUID(), volunteerId: saved.id };
    await persistVolunteerProfile(db, storage, { ...profile(), needId: created.id }, bundle(editScope, []), actor, saved.id);
  }
  assert.equal((await needs.deleteVolunteerNeed(created.id)).success, false);
});

test("cleanup rejects foreign receipts, deletes only unclaimed owned uploads and reports storage errors", async () => {
  const scope = { actor: "public", nonce: randomUUID() };
  const expired = upload("PHOTO", scope, Date.now() - 20 * 60 * 1000);
  await assert.rejects(discardOwnedUploads(db, storage, [expired], { ...scope, nonce: randomUUID() }));
  assert.ok(resources.has(expired.publicId));
  await discardOwnedUploads(db, storage, [expired], scope);
  assert.ok(destroyed.includes(expired.publicId));
  const receipt = upload("PHOTO", scope);
  await assert.rejects(discardOwnedUploads(db, { ...storage, destroy: async () => { throw new Error("Mock cleanup failure"); } }, [receipt], scope));
  assert.ok(resources.has(receipt.publicId));
  const lostResponse = { ticket: receipt.ticket, publicId: receipt.publicId };
  await assert.rejects(discardOwnedUploads(db, storage, [{ ...lostResponse, publicId: "arbitrary-client-id" }], scope));
  await discardOwnedUploads(db, storage, [lostResponse], scope);
  assert.equal(resources.has(receipt.publicId), false);
});

test("concurrent saves and cleanup cannot leave committed attachment references missing", async () => {
  for (let index = 0; index < 3; index++) {
    const scope = { actor: "public", nonce: randomUUID() };
    const receipt = upload("PHOTO", scope);
    const values = profile();
    await Promise.allSettled([
      persistVolunteerProfile(db, storage, values, bundle(scope, [receipt]), publicActor),
      persistVolunteerProfile(db, storage, values, bundle(scope, [receipt]), publicActor),
      discardOwnedUploads(db, storage, [receipt], scope),
    ]);
    const rows = await db.volunteer.findMany({ where: { email: values.email }, include: { attachments: true } });
    assert.ok(rows.length <= 1);
    for (const row of rows) {
      assert.equal(row.attachments.length, 1);
      assert.ok(resources.has(row.attachments[0].publicId));
    }
  }
});

test("foreign attachment removals and upload reuse cannot alter another profile", async () => {
  const foreign = await db.volunteerAttachment.findFirstOrThrow({ where: { kind: "CERTIFICATE" } });
  const scope = { actor: adminId, nonce: randomUUID() };
  const saved = await persistVolunteerProfile(db, storage, profile(), bundle(scope, [upload("PHOTO", scope)]), actor);
  const editScope = { actor: adminId, nonce: randomUUID(), volunteerId: saved.id };
  await assert.rejects(persistVolunteerProfile(db, storage, profile(), bundle(editScope, [], [foreign.id]), actor, saved.id));
  assert.ok(await db.volunteerAttachment.findUnique({ where: { id: foreign.id } }));
  const receipt = upload("CERTIFICATE", editScope);
  await assert.rejects(persistVolunteerProfile(db, storage, profile(), bundle(editScope, [receipt]), actor, foreign.volunteerId));
});

test("backup and CSV include new profile and master data without account passwords", async () => {
  const backup = await settings.backupDatabase();
  assert.ok(backup.success);
  const data = JSON.parse(Buffer.from(backup.contentBase64, "base64").toString()).data;
  assert.ok(data.employees.length);
  assert.ok(data.employeeLocations.length);
  assert.ok(data.volunteerAttachments.length);
  assert.ok(data.users.every((u: object) => !("password" in u)));
  const csv = await settings.exportDataCsv();
  assert.ok(csv.success);
  const content = Buffer.from(csv.contentBase64, "base64").toString();
  assert.match(content, /User-authored major/);
  assert.match(content, /Legacy unrecognized skill/);
  assert.ok(refreshed.includes("/dashboard"));
});

test("public action is dashboard-visible and notification failure cannot create a duplicate", async () => {
  const actual = require("../lib/volunteer-uploads.server") as typeof import("../lib/volunteer-uploads.server");
  stub("../lib/volunteer-uploads.server", { ...actual, volunteerStorage: () => storage });
  const { applyVolunteer } = require("../lib/actions/public") as typeof import("../lib/actions/public");
  const scope = { actor: "public", nonce: randomUUID() };
  const values = { ...profile(), email: "public-action@example.test", phone: "081234567890", dob: "1995-01-01", address: "Isolated test address", occupation: "Teacher", motivation: "I want to support the children's education.", agreePolicy: true as const, availability: ["Fleksibel" as const], status: "APPROVED", role: "SUPER_ADMIN" };
  const uploads = bundle(scope, [upload("PHOTO", scope), upload("CERTIFICATE", scope), upload("CERTIFICATE", scope)]);
  notificationFails = true;
  try {
    const result = await applyVolunteer(values, uploads);
    assert.ok(result.success && result.id);
    const retry = await applyVolunteer(values, uploads);
    assert.ok(retry.success && retry.id === result.id);
    const record = await db.volunteer.findUniqueOrThrow({ where: { id: result.id }, include: { attachments: true } });
    assert.equal(record.status, "PENDING");
    assert.equal(record.hasSafeguardingCert, false);
    assert.equal(record.userId, null);
    assert.equal(record.attachments.length, 3);
    assert.equal(await db.volunteer.count({ where: { email: values.email } }), 1);
  } finally { notificationFails = false; }
});

test("signing and attachment routes enforce origin and staff authorization", async () => {
  const { POST } = require("../app/api/volunteer-uploads/sign/route") as typeof import("../app/api/volunteer-uploads/sign/route");
  const { GET } = require("../app/api/volunteer-attachments/[id]/route") as typeof import("../app/api/volunteer-attachments/[id]/route");
  process.env.NEXTAUTH_URL = "http://localhost:3100";
  const body = { mode: "public", nonce: randomUUID(), files: [{ kind: "PHOTO", filename: "photo.png", mime: "image/png", bytes: 100 }] };
  const request = (data: object, origin = "http://localhost:3100") => new Request("http://localhost:3100/api/volunteer-uploads/sign", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(data) });
  session = null;
  assert.equal((await POST(request(body, "https://foreign.test"))).status, 403);
  assert.equal((await POST(request({ ...body, folder: "forged" }))).status, 400);
  assert.equal((await POST(request({ ...body, mode: "staff" }))).status, 403);
  assert.equal((await POST(request(body))).status, 200);
  const attachment = await db.volunteerAttachment.findFirstOrThrow();
  assert.equal((await GET(new Request("http://localhost:3100"), { params: { id: attachment.id } })).status, 403);
  login(adminId);
});
