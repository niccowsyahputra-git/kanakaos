import type { ResidenceStatus, Occupation, SpouseStatus } from "@prisma/client";
import { occupationLabel } from "@/components/children/child-labels";

// Hubungan wali dengan anak (disimpan sebagai label langsung)
export const RELATIONSHIP_OPTIONS = [
  "Ayah Kandung",
  "Ibu Kandung",
  "Ayah Tiri",
  "Ibu Tiri",
  "Kakek",
  "Nenek",
  "Paman",
  "Bibi",
  "Kakak",
  "Keluarga Jauh",
  "Tetangga",
  "Guru",
] as const;

// Status tempat tinggal wali
export const residenceStatusLabel: Record<ResidenceStatus, string> = {
  MILIK_SENDIRI: "Milik Sendiri",
  SEWA: "Sewa",
  MENUMPANG: "Menumpang",
  TIDAK_MEMILIKI: "Tidak Memiliki Tempat Tinggal",
};

export const residenceStatusOptions = Object.entries(residenceStatusLabel).map(
  ([value, label]) => ({ value, label })
);

// Status pasangan wali
export const spouseStatusLabel: Record<SpouseStatus, string> = {
  ISTRI: "Istri",
  SUAMI: "Suami",
  BERCERAI: "Bercerai",
};

export const spouseStatusOptions = Object.entries(spouseStatusLabel).map(
  ([value, label]) => ({ value, label })
);

// Pekerjaan wali: daftar lengkap (sama dengan pekerjaan orang tua di modul anak)
const GUARDIAN_OCCUPATIONS: Occupation[] = [
  "TIDAK_BEKERJA",
  "BURUH_PABRIK",
  "NELAYAN",
  "PETANI",
  "BURUH_BANGUNAN",
  "BURUH_HARIAN",
  "SUPIR_KENEK",
  "PELAUT",
  "PEDAGANG",
  "PRT",
  "TKI",
  "ASN",
  "LAINNYA",
];

export const guardianOccupationOptions = GUARDIAN_OCCUPATIONS.map((value) => ({
  value,
  label: occupationLabel[value],
}));
