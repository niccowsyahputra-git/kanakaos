import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import type { Session } from "next-auth";
import type { DriveMetadata, DriveStorage } from "../lib/google-drive.server";
import { createTranslator } from "../lib/i18n/translate";
import { MANAGED_FORM_KEY, StorageError, managedFileUrl, publicBrandingUrl, type StoragePurpose } from "../lib/storage-contract";

// Framework, PDF rendering and Google transport are isolated; persistence and access guards are real.
const url = `file:${path.resolve(".npm-cache", `storage-actions-${randomUUID()}.db`)}`;
const db = new PrismaClient({ adapter: new PrismaLibSQL({ url }) });
const sql = createClient({ url });
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const pdf = Buffer.from("%PDF-1.4\nNon-sensitive local receipt fixture\n%%EOF");
const secret = "isolated-actions-storage-signing-secret";
const previousSecret = process.env.STORAGE_SIGNING_SECRET;
const metadata = new Map<string, DriveMetadata>();
const content = new Map<string, Uint8Array>();
const removed: string[] = [];
let session: Session | null = null;
let locale: "en" | "id" = "en";
let failUpload = false;
let adminId: string;
let staffId: string;
let financeId: string;
const drive: DriveStorage = {
  folderId: "local-fixture-folder", health: async () => {},
  generateId: async () => `local-${randomUUID()}`,
  start: async file => {
    metadata.set(file.id, { id: file.id, mimeType: file.mime, size: String(file.bytes), parents: [drive.folderId], ownedByMe: true, trashed: false,
      appProperties: { application: "kanakaos", managedId: file.managedId, purpose: file.purpose }, permissions: [{ type: "user", role: "owner" }] });
    content.set(file.id, file.mime === "application/pdf" ? pdf : png);
    return "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=fixture";
  },
  metadata: async id => metadata.get(id) ?? null,
  prefix: async id => content.get(id) ?? new Uint8Array(),
  download: async id => new Response(new Uint8Array(content.get(id) ?? [])),
  trash: async id => { removed.push(id); metadata.delete(id); content.delete(id); },
  upload: async (file, bytes) => {
    if (failUpload) throw new StorageError("QUOTA");
    await drive.start(file);
    content.set(file.id, bytes);
  },
};
function stub(name: string, exports: object) {
  const id = require.resolve(name);
  require.cache[id] = { id, filename: id, loaded: true, exports } as NodeModule;
}
stub("server-only", {});
stub("react", { ...require("react"), cache: <T,>(fn: T) => fn });
stub("../lib/prisma", { prisma: db });
stub("next-auth/next", { getServerSession: async () => session });
stub("next/cache", { revalidatePath() {} });
stub("../lib/i18n/server", { getT: async () => ({ locale, tr: createTranslator(locale) }) });
stub("../lib/notify", { notifyRoles: async () => {} });
stub("../lib/google-drive.server", { ...require("../lib/google-drive.server"), driveStorage: () => drive });
stub("@react-pdf/renderer", { renderToBuffer: async () => pdf });
stub("../lib/receipt-pdf", { ReceiptPdf: () => null });
const managed = require("../lib/managed-storage.server") as typeof import("../lib/managed-storage.server");
const reader = require("../lib/managed-file-read.server") as typeof import("../lib/managed-file-read.server");
const settings = require("../lib/actions/settings") as typeof import("../lib/actions/settings");
const identity = require("../lib/site-settings") as typeof import("../lib/site-settings");
const brandingRoute = require("../app/api/yayasan-logo/route") as typeof import("../app/api/yayasan-logo/route");
const donation = require("../lib/actions/donation") as typeof import("../lib/actions/donation");
const cases = require("../lib/actions/case") as typeof import("../lib/actions/case");
const visits = require("../lib/actions/homeVisit") as typeof import("../lib/actions/homeVisit");
const incidents = require("../lib/actions/incident") as typeof import("../lib/actions/incident");
function login(id: string) {
  session = { user: { id, name: "Local test", email: "fixture@example.test", role: "SUPER_ADMIN" }, expires: "2099-01-01" };
}
function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
async function prepare(purpose: StoragePurpose, targetId?: string, finalized = true) {
  const nonce = randomUUID();
  const bytes = purpose === "CASE_DOCUMENT" || purpose === "CASE_INTERVENTION" ? pdf : png;
  const upload = await managed.startManagedUpload(db, drive, { nonce, mode: "staff", targetId,
    file: { purpose, filename: bytes === pdf ? "fixture.pdf" : "fixture.png", mime: bytes === pdf ? "application/pdf" : "image/png", bytes: bytes.length },
  }, { id: session!.user.id }, secret);
  const claim = { id: upload.id, ticket: upload.ticket };
  if (finalized) await managed.finalizeManagedUpload(db, drive, claim, { id: session!.user.id }, secret);
  return { claim, bundle: JSON.stringify({ nonce, claims: [claim] }) };
}
const config = async (key: string) => (await db.systemConfig.findUnique({ where: { configKey: key } }))?.configValue;
const isForbidden = (error: unknown) => error instanceof StorageError && error.code === "FORBIDDEN";

before(async () => {
  process.env.STORAGE_SIGNING_SECRET = secret;
  mkdirSync(path.resolve(".npm-cache"), { recursive: true });
  await sql.executeMultiple(execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { encoding: "utf8", env: { ...process.env, DATABASE_URL: url, TURSO_AUTH_TOKEN: "" } }));
  for (const role of ["SUPER_ADMIN", "SOCIAL_WORKER", "FINANCE"] as const) {
    const user = await db.user.create({ data: { name: `Local ${role}`, email: `${role}@example.test`, password: "unused", role } });
    if (role === "SUPER_ADMIN") adminId = user.id;
    else if (role === "SOCIAL_WORKER") staffId = user.id;
    else financeId = user.id;
  }
  login(adminId);
});
after(async () => {
  await db.$disconnect();
  sql.close();
  if (previousSecret === undefined) delete process.env.STORAGE_SIGNING_SECRET;
  else process.env.STORAGE_SIGNING_SECRET = previousSecret;
});

test("branding saves verified claims atomically, preserves untouched legacy data, and publicly serves only the current logo", async () => {
  login(adminId);
  const legacy = `data:image/png;base64,${png.toString("base64")}`;
  await db.systemConfig.createMany({ data: [{ configKey: "YAYASAN_LOGO_URL", configValue: "/api/yayasan-logo?v=legacy" }, { configKey: "YAYASAN_LOGO_DATA", configValue: legacy }] });
  const data = form({ yayasanName: "Local foundation" });
  assert.equal((await settings.saveGeneralSettings(data)).success, true);
  assert.equal(await config("YAYASAN_LOGO_DATA"), legacy);
  assert.equal((await identity.getReceiptYayasan()).logoSrc, legacy);
  assert.deepEqual(Buffer.from(await (await brandingRoute.GET()).arrayBuffer()), png);
  const first = await prepare("FOUNDATION_LOGO", "YAYASAN_LOGO_URL", false);
  data.set(MANAGED_FORM_KEY, first.bundle);
  data.set("yayasanName", "Must not save yet");
  assert.equal((await settings.saveGeneralSettings(data)).success, false);
  assert.equal(await config("YAYASAN_NAME"), "Local foundation");
  assert.equal(await config("YAYASAN_LOGO_DATA"), legacy);
  await managed.finalizeManagedUpload(db, drive, first.claim, { id: adminId }, secret);
  await sql.execute("CREATE TRIGGER fail_branding BEFORE INSERT ON SystemConfig WHEN NEW.configKey = 'YAYASAN_NAME' BEGIN SELECT RAISE(ABORT, 'fixture rollback'); END");
  try { assert.equal((await settings.saveGeneralSettings(data)).success, false); }
  finally { await sql.execute("DROP TRIGGER fail_branding"); }
  assert.equal(await config("YAYASAN_LOGO_DATA"), legacy);
  assert.equal((await db.managedFile.findUniqueOrThrow({ where: { id: first.claim.id } })).state, "UPLOADED");
  assert.equal((await settings.saveGeneralSettings(data)).success, true);
  const attached = await db.managedFile.findUniqueOrThrow({ where: { id: first.claim.id } });
  assert.equal(attached.parentId, "YAYASAN_LOGO_URL");
  assert.equal(await config("YAYASAN_LOGO_URL"), managedFileUrl(attached.id));
  assert.equal((await identity.getSiteSettings()).identity.logoUrl, publicBrandingUrl(managedFileUrl(attached.id)));
  assert.equal((await identity.getReceiptYayasan()).logoSrc, legacy);
  session = null;
  const publicResponse = await brandingRoute.GET();
  assert.equal(publicResponse.status, 200);
  assert.equal(publicResponse.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(Buffer.from(await publicResponse.arrayBuffer()), png);
  await assert.rejects(reader.readManagedFile(db, drive, attached.id, { id: null }), isForbidden);
  login(adminId);
  const next = await prepare("FOUNDATION_LOGO", "YAYASAN_LOGO_URL");
  data.set(MANAGED_FORM_KEY, next.bundle);
  assert.equal((await settings.saveGeneralSettings(data)).success, true);
  await assert.rejects(reader.readManagedFile(db, drive, attached.id, { id: null }, true), isForbidden);
  data.delete(MANAGED_FORM_KEY);
  data.set("removeLogo", "true");
  assert.equal((await settings.saveGeneralSettings(data)).success, true);
  assert.equal((await brandingRoute.GET()).status, 404);
  assert.equal((await db.managedFile.findUniqueOrThrow({ where: { id: attached.id } })).state, "ATTACHED");
  login(staffId);
  assert.equal((await settings.saveGeneralSettings(data)).success, false);
  assert.equal((await settings.cleanUnclaimedStorage()).success, false);
});

test("receipt upload and attachment failures preserve saved donations, PDF fallback and one ledger entry in both languages", async () => {
  login(financeId);
  for (const language of ["en", "id"] as const) {
    locale = language;
    for (const failure of ["upload", "attach"] as const) {
      failUpload = failure === "upload";
      if (failure === "attach") await sql.execute("CREATE TRIGGER fail_receipt BEFORE UPDATE OF receiptPdfUrl ON Donation BEGIN SELECT RAISE(ABORT, 'fixture rollback'); END");
      try {
        const result = await donation.processDonation({ donaturName: "Local fallback donor", donorType: "PERORANGAN", type: "CASH", amount: 123000, items: [] });
        assert.ok(result.success, JSON.stringify(result));
        assert.equal(result.receiptPdfUrl, null);
        assert.deepEqual(Buffer.from(result.pdfBase64, "base64"), pdf);
        assert.match(result.warning ?? "", language === "en" ? /receipt remains valid/i : /kwitansi tetap sah/);
        const saved = await db.donation.findUniqueOrThrow({ where: { receiptNumber: result.receiptNumber } });
        assert.equal(saved.receiptPdfUrl, null);
        assert.equal(Number(saved.amount), 123000);
        assert.equal(await db.transaction.count({ where: { donationId: saved.id } }), 1);
        assert.equal(await db.managedFile.count({ where: { targetId: saved.id, state: "ATTACHED" } }), 0);
      } finally {
        failUpload = false;
        if (failure === "attach") await sql.execute("DROP TRIGGER fail_receipt");
      }
    }
  }
  locale = "en";
});

test("server-generated receipts preserve donation creation permissions while private downloads remain finance-only", async () => {
  login(staffId);
  const result = await donation.processDonation({ donaturName: "Local saved donor", donorType: "PERORANGAN", type: "CASH", amount: 45000, items: [] });
  assert.ok(result.success, JSON.stringify(result));
  assert.ok(result.receiptPdfUrl?.startsWith("/api/files/"));
  assert.equal(result.warning, undefined);
  const saved = await db.donation.findUniqueOrThrow({ where: { receiptNumber: result.receiptNumber } });
  const file = await db.managedFile.findFirstOrThrow({ where: { parentId: saved.id, state: "ATTACHED" } });
  assert.equal(file.purpose, "DONATION_RECEIPT");
  await assert.rejects(reader.readManagedFile(db, drive, file.id, { id: staffId }), isForbidden);
  await assert.rejects(reader.readManagedFile(db, drive, file.id, { id: null }), isForbidden);
  assert.deepEqual(Buffer.from(await (await reader.readManagedFile(db, drive, file.id, { id: financeId })).arrayBuffer()), pdf);
  await assert.rejects(managed.startManagedUpload(db, drive, { nonce: randomUUID(), mode: "staff", targetId: saved.id, file: { purpose: "DONATION_RECEIPT", filename: "forged.pdf", mime: "application/pdf", bytes: pdf.length } }, { id: financeId }, secret), isForbidden);
  const stock = await db.inventory.create({ data: { itemName: "Local donated rice", category: "MAKANAN", unit: "kg", quantity: 5 } });
  const inKind = await donation.processDonation({ donaturName: "Local goods donor", donorType: "PERORANGAN", type: "IN_KIND", amount: 0, items: [{ itemName: stock.itemName, quantity: 2, unit: "KG" }] });
  assert.ok(inKind.success, JSON.stringify(inKind));
  const goods = await db.donation.findUniqueOrThrow({ where: { receiptNumber: inKind.receiptNumber } });
  assert.equal((await db.inventory.findUniqueOrThrow({ where: { id: stock.id } })).quantity, 7);
  assert.equal(await db.transaction.count({ where: { donationId: goods.id } }), 0);
  assert.equal(await db.donationItem.count({ where: { donationId: goods.id } }), 1);
});

test("case documents and interventions reject wrong targets and closed cases while attaching under their original case", async () => {
  login(staffId);
  const child = await db.child.create({ data: { fullName: "Local case child", dob: new Date("2010-01-01"), gender: "MALE" } });
  const parent = await db.case.create({ data: { childId: child.id, caseType: "OTHER", description: "Local case fixture", assignedToId: staffId } });
  const other = await db.case.create({ data: { childId: child.id, caseType: "OTHER", description: "Other local case fixture", assignedToId: staffId } });
  const doc = await prepare("CASE_DOCUMENT", parent.id);
  const data = form({ caseId: other.id, [MANAGED_FORM_KEY]: doc.bundle });
  assert.equal((await cases.uploadCaseDocument(data)).success, false);
  data.set("caseId", parent.id);
  const result = await cases.uploadCaseDocument(data);
  assert.ok(result.success && result.id, JSON.stringify(result));
  assert.equal((await db.caseDocument.findUniqueOrThrow({ where: { id: result.id } })).fileUrl, managedFileUrl(doc.claim.id));
  const intervention = await prepare("CASE_INTERVENTION", parent.id);
  const activity = form({ caseId: parent.id, date: "2026-01-01", interventionType: "Local support", notes: "Non-sensitive local notes", [MANAGED_FORM_KEY]: intervention.bundle });
  assert.equal((await cases.addIntervention(activity)).success, true);
  assert.equal((await db.case.findUniqueOrThrow({ where: { id: parent.id } })).status, "IN_PROGRESS");
  const closedDoc = await prepare("CASE_DOCUMENT", parent.id);
  await db.case.update({ where: { id: parent.id }, data: { status: "CLOSED" } });
  data.set(MANAGED_FORM_KEY, closedDoc.bundle);
  assert.equal((await cases.uploadCaseDocument(data)).success, false);
  assert.equal(await db.caseDocument.count({ where: { caseId: parent.id } }), 1);
  await db.caseDocument.update({ where: { id: result.id }, data: { caseId: other.id } });
  await assert.rejects(reader.readManagedFile(db, drive, doc.claim.id, { id: staffId }), isForbidden);
});

test("home-visit completion and guardian assessment roll back together; incidents require verified selected photos", async () => {
  login(staffId);
  const guardian = await db.guardian.create({ data: { name: "Local guardian", vulnerabilityScore: 1 } });
  const child = await db.child.create({ data: { fullName: "Local visit child", dob: new Date("2010-01-01"), gender: "MALE", guardianId: guardian.id } });
  const visit = await db.homeVisit.create({ data: { childId: child.id, scheduledDate: new Date(), purpose: "Local fixture visit", createdById: staffId, photoUrl: "https://legacy.example/visit.png" } });
  const photo = await prepare("HOME_VISIT_PHOTO", visit.id);
  const data = form({ visitId: visit.id, vulnerabilityScore: "3", visitNotes: "Local visit observations", [MANAGED_FORM_KEY]: photo.bundle });
  await sql.execute("CREATE TRIGGER fail_assessment BEFORE UPDATE OF vulnerabilityScore ON Guardian BEGIN SELECT RAISE(ABORT, 'fixture rollback'); END");
  try { assert.equal((await visits.completeHomeVisit(data)).success, false); }
  finally { await sql.execute("DROP TRIGGER fail_assessment"); }
  assert.deepEqual(await db.homeVisit.findUniqueOrThrow({ where: { id: visit.id } }), visit);
  assert.equal((await db.managedFile.findUniqueOrThrow({ where: { id: photo.claim.id } })).state, "UPLOADED");
  assert.equal((await visits.completeHomeVisit(data)).success, true);
  assert.equal((await db.guardian.findUniqueOrThrow({ where: { id: guardian.id } })).vulnerabilityScore, 3);
  assert.equal((await db.homeVisit.findUniqueOrThrow({ where: { id: visit.id } })).photoUrl, managedFileUrl(photo.claim.id));
  const image = await prepare("INCIDENT_PHOTO", undefined, false);
  const report = form({ childId: child.id, incidentType: "OTHER", urgency: "LOW", description: "Non-sensitive local incident", [MANAGED_FORM_KEY]: image.bundle });
  assert.equal((await incidents.reportIncident(report)).success, false);
  assert.equal(await db.incident.count({ where: { childId: child.id } }), 0);
  await managed.finalizeManagedUpload(db, drive, image.claim, { id: staffId }, secret);
  assert.equal((await incidents.reportIncident(report)).success, true);
  assert.equal((await db.incident.findFirstOrThrow({ where: { childId: child.id } })).photoUrl, managedFileUrl(image.claim.id));
});

test("backup and CSV include attached Drive metadata but no pending uploads, nonce hashes, IP hashes or tickets; cleanup retains history", async () => {
  login(adminId);
  const pending = await prepare("FOUNDATION_LOGO", "YAYASAN_LOGO_URL");
  const result = await settings.backupDatabase();
  assert.ok(result.success);
  const data = JSON.parse(Buffer.from(result.contentBase64, "base64").toString()).data;
  assert.ok(data.managedFiles.length > 0);
  assert.ok(data.managedFiles.every((file: { state: string }) => file.state === "ATTACHED"));
  assert.ok(!data.managedFiles.some((file: { id: string }) => file.id === pending.claim.id));
  const serialized = JSON.stringify(data.managedFiles);
  for (const key of ["nonceHash", "clientIpHash", "ticket", "sessionUrl", "refreshToken"]) assert.ok(!serialized.includes(key));
  const csv = await settings.exportDataCsv();
  assert.ok(csv.success);
  assert.ok(Buffer.from(csv.contentBase64, "base64").toString().includes(data.managedFiles[0].driveFileId));
  const retained = data.managedFiles.map((file: { driveFileId: string }) => file.driveFileId);
  assert.equal((await settings.cleanUnclaimedStorage()).success, true);
  assert.ok(retained.every((id: string) => !removed.includes(id)));
  const raw = form({ yayasanName: "Raw bytes are forbidden" });
  raw.set("logo", new Blob([png], { type: "image/png" }), "logo.png");
  assert.equal((await settings.saveGeneralSettings(raw)).success, false);
});
