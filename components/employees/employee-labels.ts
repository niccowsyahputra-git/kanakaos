import type { EmploymentStatus } from "@prisma/client";

// Status kepegawaian
export const employmentStatusLabel: Record<EmploymentStatus, string> = {
  TETAP: "Karyawan Tetap",
  KONTRAK: "Karyawan Kontrak",
  HARIAN: "Karyawan Harian",
};

export const employmentStatusOptions = Object.entries(
  employmentStatusLabel
).map(([value, label]) => ({ value, label }));

// Status PTKP standar perpajakan Indonesia
export const PTKP_OPTIONS = [
  "TK/0",
  "TK/1",
  "TK/2",
  "TK/3",
  "K/0",
  "K/1",
  "K/2",
  "K/3",
] as const;
