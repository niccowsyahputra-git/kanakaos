import "server-only";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { driveStorage, type DriveStorage } from "./google-drive.server";
import { assertStorageAccess, storageParent, type StorageActor } from "./managed-storage.server";
import { STORAGE_PURPOSES, StorageError, managedFileIdFromUrl, managedFileUrl, storagePurposeSchema } from "./storage-contract";

export async function readManagedFile(db: PrismaClient, drive: DriveStorage, id: string, actor: StorageActor, publicBranding = false) {
  if (!z.string().cuid().safeParse(id).success) throw new StorageError("FORBIDDEN");
  const file = await db.managedFile.findUnique({ where: { id } });
  if (!file || file.state !== "ATTACHED" || !file.parentId || !file.parentType || file.verifiedBytes !== file.expectedBytes) throw new StorageError("FORBIDDEN");
  const purpose = storagePurposeSchema.safeParse(file.purpose);
  if (!purpose.success) throw new StorageError("FORBIDDEN");
  const policy = STORAGE_PURPOSES[purpose.data];
  if (policy.parent !== file.parentType) throw new StorageError("FORBIDDEN");
  if (publicBranding) {
    if (purpose.data !== "FOUNDATION_LOGO" || file.parentId !== "YAYASAN_LOGO_URL") throw new StorageError("FORBIDDEN");
  } else {
    await assertStorageAccess(db, actor, purpose.data, file.targetId ?? (policy.target === "User" ? file.parentId : undefined), false, true);
  }
  const parent = await storageParent(db, file.parentType, file.parentId);
  if (!parent) throw new StorageError("FORBIDDEN");
  if (file.parentType === "Volunteer") {
    if (file.volunteerId !== file.parentId) throw new StorageError("FORBIDDEN");
  } else {
    const field = file.parentType === "SystemConfig" ? "configValue" : policy.field;
    if ((parent as Record<string, unknown>)[field] !== managedFileUrl(file.id)) throw new StorageError("FORBIDDEN");
  }
  if (policy.target === "Case" && (parent as Record<string, unknown>).caseId !== file.targetId) throw new StorageError("FORBIDDEN");
  const upstream = await drive.download(file.driveFileId);
  const filename = file.filename.replace(/[\r\n\u0000-\u001f\u007f"\\/]/g, "_");
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_");
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return new Response(upstream.body, { status: 200, headers: {
    "Content-Type": file.mime,
    "Content-Length": String(file.verifiedBytes),
    "Content-Disposition": `${file.mime.startsWith("image/") ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encoded}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  } });
}

export async function readCurrentBranding(db: PrismaClient, getDrive: () => DriveStorage = driveStorage): Promise<Response | null> {
  const current = await db.systemConfig.findUnique({ where: { configKey: "YAYASAN_LOGO_URL" } });
  const url = current?.configValue ?? "";
  const id = managedFileIdFromUrl(url);
  if (id) return readManagedFile(db, getDrive(), id, { id: null }, true);
  if (!/^\/api\/yayasan-logo(?:\?|$)/.test(url)) return null;
  const legacy = await db.systemConfig.findUnique({ where: { configKey: "YAYASAN_LOGO_DATA" } });
  const match = legacy?.configValue.match(/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  return new Response(Buffer.from(match[2], "base64"), { headers: {
    "Content-Type": match[1],
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  } });
}
