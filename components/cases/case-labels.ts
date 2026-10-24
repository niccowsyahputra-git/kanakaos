import type { CaseStatus, CasePriority, CaseType } from "@prisma/client";

export const caseTypeLabel: Record<CaseType, string> = {
  PROTECTION: "Perlindungan Anak",
  HEALTH: "Kesehatan",
  EDUCATION: "Pendidikan",
  PSYCHOSOCIAL: "Psikososial",
  LEGAL: "Hukum",
  FAMILY_REUNIFICATION: "Reunifikasi Keluarga",
  OTHER: "Lainnya",
};

export const caseStatusLabel: Record<CaseStatus, string> = {
  OPEN: "Baru",
  IN_PROGRESS: "Masih Berjalan",
  CLOSED: "Selesai",
};

export const caseStatusClass: Record<CaseStatus, string> = {
  OPEN: "border-transparent bg-yellow-100 text-yellow-800",
  IN_PROGRESS: "border-transparent bg-blue-100 text-blue-800",
  CLOSED: "border-transparent bg-gray-100 text-gray-600",
};

export const casePriorityLabel: Record<CasePriority, string> = {
  LOW: "Rendah",
  MEDIUM: "Sedang",
  HIGH: "Tinggi",
  CRITICAL: "Kritis",
};

export const casePriorityClass: Record<CasePriority, string> = {
  LOW: "border-transparent bg-gray-100 text-gray-600",
  MEDIUM: "border-transparent bg-blue-100 text-blue-800",
  HIGH: "border-transparent bg-orange-100 text-orange-800",
  CRITICAL: "border-transparent bg-red-100 text-red-800",
};
