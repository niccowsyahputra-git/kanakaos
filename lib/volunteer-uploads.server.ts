import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";
import { z } from "zod";
import { isCloudinaryConfigured } from "./cloudinary";
import { ATTACHMENT_KINDS, MAX_UPLOAD_BYTES, UPLOAD_LIMITS, receiptSchema, uploadClaimSchema, uploadFileSchema, type SignedUpload, type UploadClaim, type UploadFileDescription, type UploadReceipt } from "./volunteer-upload-contract";

export class VolunteerSaveError extends Error {}
export type UploadScope = { actor: string; nonce: string; volunteerId?: string };
const ticketSchema = z.object({
  actor: z.string(), nonce: z.string().uuid(), volunteerId: z.string().optional(),
  file: uploadFileSchema, publicId: z.string(), issuedAt: z.number().int(), expiresAt: z.number().int(),
});
export type VerifiedAttachment = {
  kind: typeof ATTACHMENT_KINDS[number]; filename: string; publicId: string;
  resourceType: string; deliveryType: string; format: string; bytes: number; version: number;
};
export type StoredResource = { public_id: string; version: number; bytes: number; format: string; resource_type: string; type: string; created_at: string };
export interface VolunteerStorage {
  secret: string;
  cloudName: string;
  apiKey: string;
  resource(publicId: string): Promise<StoredResource>;
  destroy(publicId: string): Promise<unknown>;
}
export function volunteerStorage(): VolunteerStorage {
  if (!isCloudinaryConfigured()) throw new VolunteerSaveError("Penyimpanan belum dikonfigurasi. Hubungi pengelola sebelum mendaftar.");
  return {
    secret: process.env.CLOUDINARY_API_SECRET!, cloudName: process.env.CLOUDINARY_CLOUD_NAME!, apiKey: process.env.CLOUDINARY_API_KEY!,
    resource: publicId => cloudinary.api.resource(publicId, { resource_type: "image", type: "authenticated" }),
    destroy: async publicId => {
      const result = await cloudinary.uploader.destroy(publicId, { resource_type: "image", type: "authenticated", invalidate: true });
      if (result.result !== "ok" && result.result !== "not found") throw new VolunteerSaveError("Gagal membersihkan unggahan. Hubungi pengelola.");
      return result;
    },
  };
}
const mac = (value: string, secret: string) => createHmac("sha256", secret).update(value).digest("hex");
function equal(a: string, b: string) {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
export function submissionKey(scope: UploadScope, secret: string) {
  return mac(JSON.stringify(["volunteer-submission", scope.actor, scope.nonce, scope.volunteerId ?? "new"]), secret);
}
export function issueUpload(file: UploadFileDescription, scope: UploadScope, storage: VolunteerStorage, now = Date.now()): SignedUpload {
  file = uploadFileSchema.parse(file);
  const publicId = `yayasan/volunteer-private/${submissionKey(scope, storage.secret)}/${randomUUID()}`;
  const issuedAt = Math.floor(now / 1000);
  const expiresAt = issuedAt + 15 * 60;
  const payload = Buffer.from(JSON.stringify({ ...scope, file, publicId, issuedAt, expiresAt })).toString("base64url");
  const params = {
    timestamp: String(issuedAt), public_id: publicId, type: "authenticated", overwrite: "false",
    allowed_formats: file.kind === "PHOTO" ? "jpg,jpeg,png,webp" : "jpg,jpeg,png,webp,pdf",
  };
  return {
    ticket: `${payload}.${mac(payload, storage.secret)}`, publicId, expiresAt,
    url: `https://api.cloudinary.com/v1_1/${encodeURIComponent(storage.cloudName)}/image/upload`,
    params: { ...params, api_key: storage.apiKey, signature: cloudinary.utils.api_sign_request(params, storage.secret) },
  };
}
function readOwnedTicket(claim: UploadClaim, scope: UploadScope, secret: string, now: number, cleanupOnly = false) {
  try {
    uploadClaimSchema.parse({ ticket: claim.ticket, publicId: claim.publicId });
    const [payload, signature, extra] = claim.ticket.split(".");
    if (!payload || !signature || extra || !equal(mac(payload, secret), signature)) throw new Error();
    const ticket = ticketSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString()));
    if (ticket.actor !== scope.actor || ticket.nonce !== scope.nonce || ticket.volunteerId !== scope.volunteerId || ticket.publicId !== claim.publicId) throw new Error();
    if ((!cleanupOnly && ticket.expiresAt <= now / 1000) || ticket.issuedAt > now / 1000 + 30) throw new Error();
    return ticket;
  } catch { throw new VolunteerSaveError("Bukti unggahan tidak valid atau kedaluwarsa. Unggah ulang file."); }
}
export function readUploadTicket(receipt: UploadReceipt, scope: UploadScope, secret: string, now = Date.now()) {
  const ticket = readOwnedTicket(receipt, scope, secret, now);
  try {
    receiptSchema.parse(receipt);
    const expected = cloudinary.utils.api_sign_request({ public_id: receipt.publicId, version: receipt.version }, secret);
    if (!equal(expected, receipt.signature)) throw new Error();
    return ticket;
  } catch { throw new VolunteerSaveError("Bukti unggahan tidak valid atau kedaluwarsa. Unggah ulang file."); }
}
export async function verifyUploads(receipts: UploadReceipt[], scope: UploadScope, storage: VolunteerStorage, now = Date.now()): Promise<VerifiedAttachment[]> {
  const tickets = receipts.map(receipt => readUploadTicket(receipt, scope, storage.secret, now));
  if (new Set(tickets.map(t => t.publicId)).size !== tickets.length || ATTACHMENT_KINDS.some(kind => tickets.filter(t => t.file.kind === kind).length > UPLOAD_LIMITS[kind])) {
    throw new VolunteerSaveError("Jumlah lampiran tidak valid");
  }
  return Promise.all(tickets.map(async (ticket, index) => {
    const resource = await storage.resource(ticket.publicId);
    const allowed = ticket.file.kind === "PHOTO" ? ["jpg", "jpeg", "png", "webp"] : ["jpg", "jpeg", "png", "webp", "pdf"];
    const expectedFormat = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" }[ticket.file.mime];
    if (resource.public_id !== ticket.publicId || resource.type !== "authenticated" || resource.resource_type !== "image" ||
        resource.version !== receipts[index].version || resource.bytes <= 0 || resource.bytes > MAX_UPLOAD_BYTES ||
        resource.bytes !== ticket.file.bytes || !allowed.includes(resource.format) ||
        resource.format.replace("jpeg", "jpg") !== expectedFormat ||
        !Number.isFinite(Date.parse(resource.created_at)) || Date.parse(resource.created_at) < (ticket.issuedAt - 30) * 1000) {
      throw new VolunteerSaveError("File unggahan tidak sesuai. Periksa jenis dan ukuran file.");
    }
    return { kind: ticket.file.kind, filename: ticket.file.filename, publicId: resource.public_id, resourceType: resource.resource_type, deliveryType: resource.type, format: resource.format, bytes: resource.bytes, version: resource.version };
  }));
}
export async function discardOwnedUploads(db: PrismaClient, storage: VolunteerStorage, claims: UploadClaim[], scope: UploadScope) {
  // The server-signed intent proves ownership even if the upload response was lost.
  // It authorizes cleanup only; persistence still requires a verified Cloudinary receipt.
  const tickets = claims.map(claim => readOwnedTicket(claim, scope, storage.secret, Date.now(), true));
  for (const ticket of tickets) {
    await db.$transaction(async tx => {
      // Serialize with profile persistence. Never delete an attachment claimed by any profile.
      if (await tx.volunteerAttachment.findUnique({ where: { publicId: ticket.publicId }, select: { id: true } })) return;
      await storage.destroy(ticket.publicId);
    }, { timeout: 30000 });
  }
}

export function privateAttachmentLink(attachment: VerifiedAttachment) {
  volunteerStorage();
  return cloudinary.utils.private_download_url(attachment.publicId, attachment.format, {
    resource_type: attachment.resourceType, type: attachment.deliveryType,
    expires_at: Math.floor(Date.now() / 1000) + 60, attachment: false,
  });
}
