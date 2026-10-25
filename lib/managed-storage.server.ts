import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { ManagedFile, Prisma, PrismaClient } from "@prisma/client";
import { canAccessAccount } from "./employee-policy";
import { type DriveStorage, hasFileSignature } from "./google-drive.server";
import { DRIVE_SESSION_RETENTION_MS, STORAGE_PURPOSES, StorageError, UPLOAD_TICKET_MS, managedBundleSchema, managedClaimSchema, managedFileUrl, managedStartSchema, storagePurposeSchema, type ManagedBundle, type ManagedClaim, type ManagedStart, type StoragePurpose } from "./storage-contract";

type DB = Prisma.TransactionClient;
export type StorageActor = { id: string | null };
export function storageSigningSecret() {
  const value = process.env.STORAGE_SIGNING_SECRET;
  if (!value || value.length < 32) throw new StorageError("NOT_CONFIGURED");
  return value;
}
const digest = (secret: string, values: unknown[]) => createHmac("sha256", secret).update(JSON.stringify(values)).digest("hex");
export function storageNonceHash(secret: string, actor: StorageActor, nonce: string) { return digest(secret, ["upload-nonce", actor.id, nonce]); }
export function storageIpHash(secret: string, ip: string) { return digest(secret, ["upload-ip", ip]); }
function ticketFor(file: ManagedFile, secret: string) { return digest(secret, ["managed-file-v1", file.id, file.driveFileId, file.uploaderId, file.nonceHash, file.purpose, file.targetType, file.targetId, file.expiresAt.getTime()]); }
function validTicket(actual: string, expected: string) { return /^[0-9a-f]{64}$/.test(actual) && timingSafeEqual(Buffer.from(actual), Buffer.from(expected)); }
export async function lockManagedFiles(tx: DB) { await tx.$executeRaw`UPDATE "ManagedFile" SET "state" = "state" WHERE 1 = 0`; }

export async function storageParent(db: DB, type: string, id: string) {
  switch (type) {
    case "Volunteer": return db.volunteer.findUnique({ where: { id } });
    case "Child": return db.child.findUnique({ where: { id } });
    case "Guardian": return db.guardian.findUnique({ where: { id } });
    case "User": return db.user.findUnique({ where: { id } });
    case "Case": return db.case.findUnique({ where: { id } });
    case "CaseDocument": return db.caseDocument.findUnique({ where: { id } });
    case "CaseIntervention": return db.caseIntervention.findUnique({ where: { id } });
    case "Incident": return db.incident.findUnique({ where: { id } });
    case "HomeVisit": return db.homeVisit.findUnique({ where: { id } });
    case "FinanceExpense": return db.financeExpense.findUnique({ where: { id } });
    case "Program": return db.program.findUnique({ where: { id } });
    case "Donation": return db.donation.findUnique({ where: { id } });
    case "SystemConfig": return db.systemConfig.findUnique({ where: { configKey: id } });
    default: return null;
  }
}

export async function assertStorageAccess(db: DB, actor: StorageActor, purpose: StoragePurpose, targetId?: string, publicUpload = false, reading = false) {
  const policy = STORAGE_PURPOSES[purpose];
  // Receipt creation follows the existing donation action; later downloads remain finance-only.
  const access = reading && "readAccess" in policy ? policy.readAccess : policy.access;
  if (publicUpload) {
    if (actor.id || policy.parent !== "Volunteer" || targetId) throw new StorageError("FORBIDDEN");
    return;
  }
  if (!actor.id) throw new StorageError("FORBIDDEN");
  const user = await db.user.findUnique({ where: { id: actor.id }, include: { employee: { select: { status: true } } } });
  if (!user || !canAccessAccount(user)) throw new StorageError("FORBIDDEN");
  if ((access === "staff" && !["SUPER_ADMIN", "SOCIAL_WORKER"].includes(user.role)) ||
    (access === "finance" && !["SUPER_ADMIN", "FINANCE"].includes(user.role)) ||
    (access === "admin" && user.role !== "SUPER_ADMIN") ||
    (access === "owner" && targetId !== actor.id)) throw new StorageError("FORBIDDEN");
  if (["Case", "HomeVisit", "User"].includes(policy.target) && !targetId) throw new StorageError("INVALID");
  if (policy.target === "SystemConfig" && targetId !== "YAYASAN_LOGO_URL") throw new StorageError("INVALID");
  if (targetId && policy.target !== "SystemConfig" && !await storageParent(db, policy.target, targetId)) throw new StorageError("FORBIDDEN");
}

function assertOwned(file: ManagedFile | null, claim: ManagedClaim, actor: StorageActor, secret: string, nonce?: string) {
  if (!file || file.uploaderId !== actor.id || !validTicket(claim.ticket, ticketFor(file, secret)) || (nonce && file.nonceHash !== storageNonceHash(secret, actor, nonce))) throw new StorageError("FORBIDDEN");
  return file;
}
const fileSpec = (file: ManagedFile) => ({ id: file.driveFileId, managedId: file.id, purpose: storagePurposeSchema.parse(file.purpose), filename: file.filename, mime: file.mime, bytes: file.expectedBytes });

export async function startManagedUpload(db: PrismaClient, drive: DriveStorage, raw: unknown, actor: StorageActor, secret: string, clientIpHash?: string, now = Date.now(), browserOrigin?: string) {
  const parsed = managedStartSchema.safeParse(raw);
  if (!parsed.success) throw new StorageError("INVALID");
  const input = parsed.data;
  if (input.file.purpose === "DONATION_RECEIPT") throw new StorageError("FORBIDDEN");
  const file = await reserveManagedFile(db, drive, input, actor, secret, clientIpHash, now);
  try {
    const sessionUrl = await drive.start(fileSpec(file), browserOrigin);
    return { id: file.id, ticket: ticketFor(file, secret), sessionUrl, expiresAt: file.expiresAt.getTime() };
  } catch (error) {
    await db.managedFile.updateMany({ where: { id: file.id, state: "PENDING" }, data: { state: "CLEANUP_PENDING" } });
    throw error;
  }
}

async function reserveManagedFile(db: PrismaClient, drive: DriveStorage, input: ManagedStart, actor: StorageActor, secret: string, clientIpHash: string | undefined, now: number) {
  await assertStorageAccess(db, actor, input.file.purpose, input.targetId, input.mode === "public");
  const driveFileId = await drive.generateId();
  const nonceHash = storageNonceHash(secret, actor, input.nonce);
  return db.$transaction(async tx => {
    await lockManagedFiles(tx);
    await assertStorageAccess(tx, actor, input.file.purpose, input.targetId, input.mode === "public");
    if (input.mode === "public") {
      if (!clientIpHash) throw new StorageError("FORBIDDEN");
      const recent = await tx.managedFile.count({ where: { nonceHash, createdAt: { gte: new Date(now - UPLOAD_TICKET_MS) } } });
      const byIp = await tx.managedFile.count({ where: { clientIpHash, createdAt: { gte: new Date(now - 60 * 60 * 1000) } } });
      if (recent >= 10 || byIp >= 30) throw new StorageError("RATE_LIMIT");
    }
    const policy = STORAGE_PURPOSES[input.file.purpose];
    const pending = await tx.managedFile.count({ where: { nonceHash, purpose: input.file.purpose, state: { in: ["PENDING", "UPLOADED"] }, expiresAt: { gt: new Date(now) } } });
    if (pending >= policy.count) throw new StorageError("INVALID");
    return tx.managedFile.create({ data: {
      driveFileId, purpose: input.file.purpose, filename: input.file.filename, mime: input.file.mime, expectedBytes: input.file.bytes,
      uploaderId: actor.id, nonceHash, clientIpHash: input.mode === "public" ? clientIpHash : null,
      targetType: policy.target, targetId: input.targetId ?? null, expiresAt: new Date(now + UPLOAD_TICKET_MS),
      cleanupAfter: new Date(now + DRIVE_SESSION_RETENTION_MS), createdAt: new Date(now),
    } });
  });
}

async function verifyManagedBytes(drive: DriveStorage, file: ManagedFile) {
  const metadata = await drive.metadata(file.driveFileId);
  if (!metadata || metadata.id !== file.driveFileId || metadata.trashed || !metadata.ownedByMe ||
    metadata.parents?.length !== 1 || metadata.parents[0] !== drive.folderId || metadata.mimeType !== file.mime || Number(metadata.size) !== file.expectedBytes ||
    metadata.appProperties?.application !== "kanakaos" || metadata.appProperties.managedId !== file.id || metadata.appProperties.purpose !== file.purpose ||
    !metadata.permissions || metadata.permissions.some(permission => permission.type !== "user" || permission.role !== "owner") ||
    !hasFileSignature(file.mime, await drive.prefix(file.driveFileId))) throw new StorageError("INVALID");
}

export async function finalizeManagedUpload(db: PrismaClient, drive: DriveStorage, raw: unknown, actor: StorageActor, secret: string, now = Date.now()) {
  const parsed = managedClaimSchema.safeParse(raw);
  if (!parsed.success) throw new StorageError("INVALID");
  const file = assertOwned(await db.managedFile.findUnique({ where: { id: parsed.data.id } }), parsed.data, actor, secret);
  await assertStorageAccess(db, actor, storagePurposeSchema.parse(file.purpose), file.targetId ?? undefined, !actor.id);
  if (file.state === "ATTACHED") return parsed.data;
  if (file.expiresAt.getTime() <= now) throw new StorageError("EXPIRED");
  if (!["PENDING", "UPLOADED"].includes(file.state)) throw new StorageError("INVALID");
  await verifyManagedBytes(drive, file);
  const updated = await db.managedFile.updateMany({ where: { id: file.id, state: { in: ["PENDING", "UPLOADED"] }, expiresAt: { gt: new Date(now) } }, data: { state: "UPLOADED", verifiedBytes: file.expectedBytes, verifiedAt: new Date(now) } });
  if (!updated.count) throw new StorageError("INVALID");
  return parsed.data;
}

export async function loadManagedClaims(tx: DB, raw: unknown, actor: StorageActor, targetId: string | undefined, allowed: readonly StoragePurpose[], secret: string, now = Date.now()) {
  const parsed = managedBundleSchema.safeParse(raw);
  if (!parsed.success) throw new StorageError("INVALID");
  const files: ManagedFile[] = [];
  for (const claim of parsed.data.claims) {
    const file = assertOwned(await tx.managedFile.findUnique({ where: { id: claim.id } }), claim, actor, secret, parsed.data.nonce);
    const purpose = storagePurposeSchema.parse(file.purpose);
    if (!allowed.includes(purpose) || file.targetId !== (targetId ?? null) || file.targetType !== STORAGE_PURPOSES[purpose].target) throw new StorageError("FORBIDDEN");
    await assertStorageAccess(tx, actor, purpose, targetId, !actor.id);
    if (file.state !== "ATTACHED" && file.expiresAt.getTime() <= now) throw new StorageError("EXPIRED");
    if (!["UPLOADED", "ATTACHED"].includes(file.state) || file.verifiedBytes !== file.expectedBytes || !file.verifiedAt) throw new StorageError("INVALID");
    files.push(file);
  }
  for (const purpose of allowed) if (files.filter(file => file.purpose === purpose).length > STORAGE_PURPOSES[purpose].count) throw new StorageError("INVALID");
  return files;
}

export async function attachManagedFiles(tx: DB, files: ManagedFile[], parentType: string, parentId: string, now = Date.now()) {
  for (const file of files) {
    const policy = STORAGE_PURPOSES[storagePurposeSchema.parse(file.purpose)];
    if (policy.parent !== parentType || (file.state === "ATTACHED" && (file.parentType !== parentType || file.parentId !== parentId))) throw new StorageError("FORBIDDEN");
    const parent = await storageParent(tx, parentType, parentId);
    if (!parent) throw new StorageError("INVALID");
    if (parentType !== "Volunteer") {
      const field = parentType === "SystemConfig" ? "configValue" : policy.field;
      if ((parent as Record<string, unknown>)[field] !== managedFileUrl(file.id)) throw new StorageError("INVALID");
    }
    if (file.state === "ATTACHED") continue;
    const updated = await tx.managedFile.updateMany({ where: { id: file.id, state: "UPLOADED", expiresAt: { gt: new Date(now) } }, data: {
      state: "ATTACHED", parentType, parentId, volunteerId: parentType === "Volunteer" ? parentId : null, attachedAt: new Date(now),
    } });
    if (updated.count !== 1) throw new StorageError("INVALID");
  }
}

export async function managedFileIsReferenced(tx: DB, file: ManagedFile) {
  if (file.state === "ATTACHED" || file.parentId || file.volunteerId) return true;
  const url = managedFileUrl(file.id);
  for (const policy of Object.values(STORAGE_PURPOSES)) {
    if (policy.parent === "Volunteer") continue;
    const column = policy.parent === "SystemConfig" ? "configValue" : policy.field;
    // Identifiers come exclusively from the fixed storage-purpose catalog, never a request.
    const rows = await tx.$queryRawUnsafe<unknown[]>(`SELECT 1 FROM "${policy.parent}" WHERE "${column}" = ? LIMIT 1`, url);
    if (rows.length) return true;
  }
  return false;
}

export async function discardManagedUpload(db: PrismaClient, raw: unknown, actor: StorageActor, secret: string) {
  const parsed = managedClaimSchema.safeParse(raw);
  if (!parsed.success) throw new StorageError("INVALID");
  await db.$transaction(async tx => {
    await lockManagedFiles(tx);
    const file = assertOwned(await tx.managedFile.findUnique({ where: { id: parsed.data.id } }), parsed.data, actor, secret);
    if (await managedFileIsReferenced(tx, file)) return;
    if (file.state !== "CLEANED") await tx.managedFile.update({ where: { id: file.id }, data: { state: "CLEANUP_PENDING" } });
  });
}

export async function cleanupManagedFiles(db: PrismaClient, drive: DriveStorage, now = Date.now(), limit = 20) {
  const files = await db.managedFile.findMany({ where: { OR: [{ state: "CLEANUP_PENDING" }, { state: { in: ["PENDING", "UPLOADED"] }, expiresAt: { lte: new Date(now) } }] }, orderBy: { updatedAt: "asc" }, take: Math.min(limit, 100) });
  let cleaned = 0;
  for (const candidate of files) {
    const reserved = await db.$transaction(async tx => {
      await lockManagedFiles(tx);
      const file = await tx.managedFile.findUnique({ where: { id: candidate.id } });
      if (!file || await managedFileIsReferenced(tx, file)) return null;
      if (file.state !== "CLEANUP_PENDING" && file.expiresAt.getTime() > now) return null;
      return tx.managedFile.update({ where: { id: file.id }, data: { state: "CLEANUP_PENDING" } });
    });
    if (!reserved) continue;
    const metadata = await drive.metadata(reserved.driveFileId);
    if (metadata) {
      if (!metadata.ownedByMe || metadata.parents?.length !== 1 || metadata.parents[0] !== drive.folderId || metadata.appProperties?.application !== "kanakaos" || metadata.appProperties.managedId !== reserved.id || metadata.appProperties.purpose !== reserved.purpose) continue;
      await drive.trash(reserved.driveFileId);
    }
    // A still-live resumable session can recreate an absent file: retain its tombstone for eight days.
    await db.managedFile.updateMany({ where: { id: reserved.id, state: "CLEANUP_PENDING", parentId: null, volunteerId: null }, data: { state: now >= reserved.cleanupAfter.getTime() ? "CLEANED" : "CLEANUP_PENDING" } });
    cleaned++;
  }
  return cleaned;
}

export async function storeGeneratedFile(db: PrismaClient, drive: DriveStorage, input: ManagedStart, bytes: Uint8Array, actor: StorageActor, secret: string) {
  if (input.file.purpose !== "DONATION_RECEIPT" || input.mode !== "staff" || bytes.length !== input.file.bytes) throw new StorageError("INVALID");
  const parsed = managedStartSchema.safeParse(input);
  if (!parsed.success || !hasFileSignature(input.file.mime, bytes)) throw new StorageError("INVALID");
  const file = await reserveManagedFile(db, drive, parsed.data, actor, secret, undefined, Date.now());
  const claim = { id: file.id, ticket: ticketFor(file, secret) };
  try {
    await drive.upload(fileSpec(file), bytes);
    await finalizeManagedUpload(db, drive, claim, actor, secret);
    return { nonce: input.nonce, claims: [claim] } satisfies ManagedBundle;
  } catch (error) {
    await discardManagedUpload(db, claim, actor, secret).catch(() => {});
    throw error;
  }
}

export async function storeDonationReceipt(db: PrismaClient, drive: DriveStorage, donationId: string, bytes: Uint8Array, filename: string, actor: StorageActor, secret: string) {
  const bundle = await storeGeneratedFile(db, drive, {
    nonce: randomUUID(), mode: "staff", targetId: donationId,
    file: { purpose: "DONATION_RECEIPT", filename, mime: "application/pdf", bytes: bytes.length },
  }, bytes, actor, secret);
  try {
    return await db.$transaction(async tx => {
      await lockManagedFiles(tx);
      const files = await loadManagedClaims(tx, bundle, actor, donationId, ["DONATION_RECEIPT"], secret);
      if (files.length !== 1) throw new StorageError("INVALID");
      const url = managedFileUrl(files[0].id);
      await tx.donation.update({ where: { id: donationId }, data: { receiptPdfUrl: url } });
      await attachManagedFiles(tx, files, "Donation", donationId);
      return url;
    });
  } catch (error) {
    await discardManagedUpload(db, bundle.claims[0], actor, secret).catch(() => {});
    throw error;
  }
}
