import { z } from "zod";

export const ATTACHMENT_KINDS = ["PHOTO", "CERTIFICATE", "KTP", "SKCK"] as const;
export type AttachmentKind = typeof ATTACHMENT_KINDS[number];
export const ATTACHMENT_LABELS = { PHOTO: "Foto", CERTIFICATE: "Sertifikat", KTP: "KTP", SKCK: "SKCK" } as const;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const UPLOAD_LIMITS = { PHOTO: 1, CERTIFICATE: 5, KTP: 1, SKCK: 1 } as const;
export const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];
export const documentMimes = [...IMAGE_MIMES, "application/pdf"];
export const uploadFileSchema = z.object({
  kind: z.enum(ATTACHMENT_KINDS),
  filename: z.string().trim().min(1).max(200).refine(v => !/[\u0000-\u001f\u007f]/.test(v)),
  mime: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
  bytes: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
}).strict().refine(v => v.kind !== "PHOTO" || IMAGE_MIMES.includes(v.mime));
export const signRequestSchema = z.object({
  nonce: z.string().uuid(),
  mode: z.enum(["public", "staff"]),
  volunteerId: z.string().cuid().optional(),
  files: z.array(uploadFileSchema).min(1).max(8),
}).strict().refine(v => v.mode === "staff" || !v.volunteerId)
  .refine(v => ATTACHMENT_KINDS.every(kind => v.files.filter(f => f.kind === kind).length <= UPLOAD_LIMITS[kind]));
export const receiptSchema = z.object({
  ticket: z.string().min(1).max(4000),
  publicId: z.string().min(1).max(300),
  version: z.number().int().positive(),
  signature: z.string().regex(/^[a-f0-9]{40,64}$/),
}).strict();
export const uploadBundleSchema = z.object({
  nonce: z.string().uuid(),
  receipts: z.array(receiptSchema).max(8),
  removeIds: z.array(z.string().cuid()).max(8).default([]),
}).strict();
export const uploadClaimSchema = receiptSchema.pick({ ticket: true, publicId: true });
export type UploadClaim = z.infer<typeof uploadClaimSchema>;
export type UploadReceipt = z.infer<typeof receiptSchema>;
export type UploadBundle = z.infer<typeof uploadBundleSchema>;
export type UploadFileDescription = z.infer<typeof uploadFileSchema>;
export type AttachmentSummary = { id: string; kind: AttachmentKind; filename: string };
export type SignedUpload = { ticket: string; publicId: string; url: string; params: Record<string, string>; expiresAt: number };

export function attachmentUrl(id: string) { return `/api/volunteer-attachments/${encodeURIComponent(id)}`; }
export function validateFile(file: Pick<File, "type" | "size">, kind: AttachmentKind): string | null {
  if (!(kind === "PHOTO" ? IMAGE_MIMES : documentMimes).includes(file.type)) return "Jenis file tidak didukung";
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) return "Ukuran file maksimal 5 MB";
  return null;
}
