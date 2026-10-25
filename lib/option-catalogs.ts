// Canonical values are independent of the selected display language.
export const ASSET_LOCATIONS = [
  "Teras depan", "Aula", "ruang tamu", "kantor depan", "kantor belakang",
  "gudang depan", "ruang makan anak laki", "ruang makan anak perempuan",
  "dapur anak", "dapur dalam", "kamar mandi perempuan", "kamar mandi laki-laki",
  "area gudang atas", "area gudang belakang", "area kamar laki-laki", "area kamar perempuan",
] as const;

export const EMPLOYEE_DEPARTMENTS = [
  "Departemen Pengasuhan dan Keperawatan",
  "Departemen Pendidikan & Keagamaan",
  "Departemen Sarana dan Prasarana",
  "Departemen Administrasi, Keuangan dan Humas",
] as const;

export const EMPLOYEE_POSITIONS = [
  "Pimpinan - Ketua LKSA", "Kepala Pengasuhan dan Pelayanan Utama",
  "Kepala Pendidikan dan Keagamaan", "Pengurus Administrasi dan Humas",
  "Pengasuh", "Pendidik",
] as const;

export const VOLUNTEER_FIELDS = {
  FORMAL_EDUCATION: "pendidikan dan pengajaran formal",
  RELIGIOUS_EDUCATION: "pendidikan dan pengajaran agama",
  MENTAL_HEALTH: "kesehatan mental dan pengembangan diri",
  CREATIVE_ARTS: "keterampilan kreatif dan kesenian",
  IT: "Teknologi dan Informasi",
  MEDICAL: "Kesehatan dan Medis",
  DOCUMENTATION: "Dokumentasi dan fotografi",
  MANAGEMENT: "Manajemen",
  LEGAL: "Legal",
  PUBLIC_RELATIONS: "Humas",
} as const;
export type VolunteerField = keyof typeof VOLUNTEER_FIELDS;
export const VOLUNTEER_FIELD_CODES = Object.keys(VOLUNTEER_FIELDS) as [VolunteerField, ...VolunteerField[]];
export const VOLUNTEER_EDUCATION = ["Tidak/belum tamat SD", "SD", "SMP", "SMA/SMK", "D1", "D2", "D3", "D4", "S1", "S2", "S3"] as const;
export const VOLUNTEER_AVAILABILITY = ["Hari Kerja (Senin-Jumat)", "Sabtu", "Minggu", "Fleksibel"] as const;
export const PARTNER_TYPES = ["RS", "SEKOLAH", "POLISI", "CSR", "LBH", "ORMAS", "YAYASAN", "LEMBAGA_PENDIDIKAN", "LEMBAGA_KEAGAMAAN"] as const;
export const PARTNER_LABELS: Record<typeof PARTNER_TYPES[number], string> = {
  RS: "Rumah Sakit", SEKOLAH: "Sekolah", POLISI: "Kepolisian", CSR: "CSR Perusahaan",
  LBH: "Lembaga Bantuan Hukum", ORMAS: "Organisasi Kemasyarakatan", YAYASAN: "Yayasan",
  LEMBAGA_PENDIDIKAN: "Lembaga Pendidikan", LEMBAGA_KEAGAMAAN: "Lembaga Keagamaan",
};
export const EMPLOYEE_STATUSES = ["ACTIVE", "SUSPENDED", "INACTIVE"] as const;
export const EMPLOYEE_STATUS_LABELS = { ACTIVE: "Aktif", SUSPENDED: "Suspend", INACTIVE: "Tidak aktif" } as const;
export const NEED_STATUSES = ["OPEN", "SUSPENDED", "CLOSED"] as const;
export const NEED_STATUS_LABELS = { OPEN: "Aktif", SUSPENDED: "Suspend", CLOSED: "Tidak aktif" } as const;

export function normalizeLocationName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
}
export function isCatalogValue(values: readonly string[], value: string) {
  return values.includes(value);
}
export function catalogLabel(value: string | null, values: readonly string[], translate: (value: string) => string) {
  return value && values.includes(value) ? translate(value) : value;
}
export function readVolunteerSkills(json: string | null | undefined): VolunteerField[] {
  try {
    const value: unknown = JSON.parse(json ?? "[]");
    return Array.isArray(value) ? [...new Set(value.filter((v): v is VolunteerField => typeof v === "string" && Object.hasOwn(VOLUNTEER_FIELDS, v)))] : [];
  } catch { return []; }
}
export function recognizedLegacySkills(value: string | null): VolunteerField[] {
  const labels = (value ?? "").split(",").map(v => v.trim());
  return VOLUNTEER_FIELD_CODES.filter(code => labels.includes(VOLUNTEER_FIELDS[code]));
}
export function needFieldLabel(field: string | null, other: string | null, legacyTitle: string) {
  return field && Object.hasOwn(VOLUNTEER_FIELDS, field)
    ? VOLUNTEER_FIELDS[field as VolunteerField]
    : other || legacyTitle;
}
export function isDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function dateOnlyLabel(value: string | Date, locale: "id" | "en") {
  return new Date(value).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", { dateStyle: "medium", timeZone: "UTC" });
}
