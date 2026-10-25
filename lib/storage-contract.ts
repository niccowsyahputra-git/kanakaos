import { z } from "zod";

const MB = 1024 * 1024;
const images = ["image/jpeg", "image/png", "image/webp"];
const docs = ["image/jpeg", "image/png", "application/pdf"];
const policy = (parent: string, field: string, maxMB: number, mimes: string[], access: "session" | "staff" | "finance" | "owner" | "admin", count = 1) => ({ parent, target: parent, field, maxBytes: maxMB * MB, mimes, access, count });
export const STORAGE_PURPOSES = {
  VOLUNTEER_PHOTO: policy("Volunteer", "PHOTO", 5, images, "staff"),
  VOLUNTEER_CERTIFICATE: policy("Volunteer", "CERTIFICATE", 5, [...images, "application/pdf"], "staff", 5),
  VOLUNTEER_KTP: policy("Volunteer", "KTP", 5, [...images, "application/pdf"], "staff"),
  VOLUNTEER_SKCK: policy("Volunteer", "SKCK", 5, [...images, "application/pdf"], "staff"),
  CHILD_PHOTO: policy("Child", "photoUrl", 5, images, "session"),
  CHILD_DIPLOMA: policy("Child", "ijazahUrl", 2, docs, "session"),
  CHILD_BIRTH_CERTIFICATE: policy("Child", "aktaLahirUrl", 2, docs, "session"),
  CHILD_CONSENT: policy("Child", "consentUrl", 2, docs, "session"),
  CHILD_SUPPORTING_DOCUMENT: policy("Child", "supportingDocUrl", 2, docs, "session"),
  CHILD_FAMILY_CARD: policy("Child", "otherDocUrl", 2, docs, "session"),
  GUARDIAN_KTP: policy("Guardian", "ktpDocUrl", 2, docs, "staff"),
  GUARDIAN_KK: policy("Guardian", "kkDocUrl", 2, docs, "staff"),
  GUARDIAN_SELFIE: policy("Guardian", "selfieUrl", 5, images, "staff"),
  GUARDIAN_OTHER_DOCUMENT: policy("Guardian", "otherDocUrl", 2, docs, "staff"),
  PROFILE_PHOTO: policy("User", "photoUrl", 3, images, "owner"),
  CASE_DOCUMENT: { ...policy("CaseDocument", "fileUrl", 5, [...images, "application/pdf"], "staff"), target: "Case" },
  CASE_INTERVENTION: { ...policy("CaseIntervention", "attachmentUrl", 5, [...images, "application/pdf"], "staff"), target: "Case" },
  INCIDENT_PHOTO: policy("Incident", "photoUrl", 5, images, "session"),
  HOME_VISIT_PHOTO: policy("HomeVisit", "photoUrl", 5, images, "staff"),
  EXPENSE_PROOF: policy("FinanceExpense", "proofUrl", 5, docs, "finance"),
  PROGRAM_PROPOSAL: policy("Program", "proposalUrl", 10, ["application/pdf"], "finance"),
  DONATION_RECEIPT: { ...policy("Donation", "receiptPdfUrl", 5, ["application/pdf"], "session"), readAccess: "finance" as const },
  FOUNDATION_LOGO: policy("SystemConfig", "YAYASAN_LOGO_URL", 3, ["image/png", "image/jpeg"], "admin"),
} as const;
export type StoragePurpose = keyof typeof STORAGE_PURPOSES;
export type ManagedFormFields = Readonly<Record<string, StoragePurpose>>;
export const MANAGED_FORM_FIELDS = {
  child: { photo: "CHILD_PHOTO", ijazah: "CHILD_DIPLOMA", aktaLahir: "CHILD_BIRTH_CERTIFICATE", consent: "CHILD_CONSENT", supportingDoc: "CHILD_SUPPORTING_DOCUMENT", otherDoc: "CHILD_FAMILY_CARD" },
  guardian: { ktpDoc: "GUARDIAN_KTP", kkDoc: "GUARDIAN_KK", selfie: "GUARDIAN_SELFIE", otherDoc: "GUARDIAN_OTHER_DOCUMENT" },
  profile: { photo: "PROFILE_PHOTO" },
  incident: { photo: "INCIDENT_PHOTO" },
  homeVisit: { photo: "HOME_VISIT_PHOTO" },
  caseIntervention: { attachment: "CASE_INTERVENTION" },
  caseDocument: { file: "CASE_DOCUMENT" },
  expense: { proof: "EXPENSE_PROOF" },
  program: { proposal: "PROGRAM_PROPOSAL" },
  branding: { logo: "FOUNDATION_LOGO" },
} as const satisfies Record<string, ManagedFormFields>;
export const MANAGED_FORM_KEY = "managedUploads";
export const storagePurposeSchema = z.enum(Object.keys(STORAGE_PURPOSES) as [StoragePurpose, ...StoragePurpose[]]);
export const managedFileDescriptionSchema = z.object({
  purpose: storagePurposeSchema,
  filename: z.string().trim().min(1).max(200).refine(value => !/[\u0000-\u001f\u007f]/.test(value)),
  mime: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
  bytes: z.number().int().positive(),
}).strict().superRefine((file, ctx) => {
  const limits = STORAGE_PURPOSES[file.purpose];
  if (!limits.mimes.includes(file.mime)) ctx.addIssue({ code: "custom", message: "Unsupported file format" });
  if (file.bytes > limits.maxBytes) ctx.addIssue({ code: "custom", message: "File exceeds the upload limit" });
});
export const managedStartSchema = z.object({
  nonce: z.string().uuid(),
  mode: z.enum(["public", "staff"]),
  targetId: z.string().min(1).max(100).optional(),
  file: managedFileDescriptionSchema,
}).strict().refine(value => value.mode !== "public" || (!value.targetId && value.file.purpose.startsWith("VOLUNTEER_")));
export const managedClaimSchema = z.object({ id: z.string().cuid(), ticket: z.string().min(1).max(2048) }).strict();
export const managedBundleSchema = z.object({
  nonce: z.string().uuid(), claims: z.array(managedClaimSchema).max(8),
}).strict().refine(value => new Set(value.claims.map(claim => claim.id)).size === value.claims.length);
export type ManagedClaim = z.infer<typeof managedClaimSchema>;
export type ManagedBundle = z.infer<typeof managedBundleSchema>;
export type ManagedStart = z.infer<typeof managedStartSchema>;
export const managedUploadSchema = managedClaimSchema.extend({ sessionUrl: z.string().url(), expiresAt: z.number().int().positive() }).strict();
export type ManagedUpload = z.infer<typeof managedUploadSchema>;
export function validDriveSession(value: string) {
  try {
    const url = new URL(value);
    return url.origin === "https://www.googleapis.com" && url.pathname === "/upload/drive/v3/files" &&
      !url.username && !url.password && !url.hash && url.searchParams.get("uploadType") === "resumable" && !!url.searchParams.get("upload_id");
  } catch { return false; }
}
export const UPLOAD_CHUNK_BYTES = MB;
export const UPLOAD_TICKET_MS = 15 * 60 * 1000;
export const DRIVE_SESSION_RETENTION_MS = 8 * 24 * 60 * 60 * 1000;
export function managedFileUrl(id: string) { return `/api/files/${encodeURIComponent(id)}`; }
export function managedFileIdFromUrl(value: string) {
  const match = /^\/api\/files\/(c[a-z0-9]+)$/.exec(value);
  return match && z.string().cuid().safeParse(match[1]).success ? match[1] : null;
}
export function publicBrandingUrl(value: string) {
  const id = managedFileIdFromUrl(value);
  return id ? `/api/yayasan-logo?v=${encodeURIComponent(id)}` : value;
}

export type StorageErrorCode = "NOT_CONFIGURED" | "RECONNECT" | "WRONG_OWNER" | "QUOTA" | "UNAVAILABLE" | "INVALID" | "EXPIRED" | "FORBIDDEN" | "RATE_LIMIT";
const messages: Record<StorageErrorCode, { en: string; id: string }> = {
  NOT_CONFIGURED: { en: "Storage is not configured. Please contact the administrator.", id: "Penyimpanan belum dikonfigurasi. Hubungi pengelola." },
  RECONNECT: { en: "Google Drive authorization expired or was revoked. Ask the administrator to reconnect storage.", id: "Otorisasi Google Drive kedaluwarsa atau dicabut. Minta pengelola menghubungkan ulang penyimpanan." },
  WRONG_OWNER: { en: "Storage is connected to the wrong Google account. Please contact the administrator.", id: "Penyimpanan terhubung ke akun Google yang salah. Hubungi pengelola." },
  QUOTA: { en: "Google Drive storage or request quota is exhausted. Please contact the administrator or try again later.", id: "Kapasitas atau kuota permintaan Google Drive telah habis. Hubungi pengelola atau coba lagi nanti." },
  UNAVAILABLE: { en: "Storage is temporarily unavailable. Your selected files are retained; please retry.", id: "Penyimpanan sementara tidak tersedia. File pilihan tetap tersimpan; silakan coba lagi." },
  INVALID: { en: "The upload could not be verified. Check the file format and size, then retry.", id: "Unggahan tidak dapat diverifikasi. Periksa format dan ukuran file, lalu coba lagi." },
  EXPIRED: { en: "The upload has expired. Please upload the selected file again.", id: "Unggahan telah kedaluwarsa. Unggah kembali file yang dipilih." },
  FORBIDDEN: { en: "You do not have permission to access this file.", id: "Anda tidak memiliki izin untuk mengakses file ini." },
  RATE_LIMIT: { en: "Too many upload attempts. Please wait before retrying.", id: "Terlalu banyak percobaan unggahan. Tunggu sebelum mencoba lagi." },
};
export function storageErrorMessage(code: StorageErrorCode, locale: "en" | "id") { return messages[code][locale]; }
export class StorageError extends Error {
  constructor(public readonly code: StorageErrorCode) { super(messages[code].en); this.name = "StorageError"; }
}
