import type {
  OrphanStatus,
  EducationLevel,
  ChildStatus,
  Religion,
  Occupation,
  ParentStatus,
  SiblingActivity,
  SiblingLivingWith,
  SiblingRelation,
} from "@prisma/client";

// Status residensi anak di panti
export const childStatusLabel: Record<ChildStatus, string> = {
  ACTIVE: "Aktif",
  REINTEGRATED: "Reintegrasi",
  GRADUATED: "Lulus",
};

// Status anak (kategori sosial/keluarga)
export const orphanStatusLabel: Record<OrphanStatus, string> = {
  YATIM: "Yatim (tanpa ayah)",
  PIATU: "Piatu (tanpa ibu)",
  YATIM_PIATU: "Yatim Piatu",
  KELUARGA_RETAK: "Keluarga Retak (Broken Home)",
  KELUARGA_MISKIN: "Keluarga Miskin / Dhuafa",
};

export const orphanStatusOptions = Object.entries(orphanStatusLabel).map(
  ([value, label]) => ({ value, label })
);

// Jenjang pendidikan terakhir
export const educationLabel: Record<EducationLevel, string> = {
  BELUM_SEKOLAH: "Belum Sekolah",
  PAUD_TK: "PAUD / TK",
  SD: "SD / Sederajat",
  SMP: "SMP / Sederajat",
  SMA_SMK: "SMA / SMK / Sederajat",
  PERGURUAN_TINGGI: "Perguruan Tinggi",
};

export const educationOptions = Object.entries(educationLabel).map(
  ([value, label]) => ({ value, label })
);

// Agama (6 agama resmi di Indonesia)
export const religionLabel: Record<Religion, string> = {
  ISLAM: "Islam",
  KRISTEN: "Kristen Protestan",
  KATOLIK: "Katolik",
  HINDU: "Hindu",
  BUDDHA: "Buddha",
  KHONGHUCU: "Khonghucu",
};

export const religionOptions = Object.entries(religionLabel).map(
  ([value, label]) => ({ value, label })
);

// Pekerjaan orang tua
export const occupationLabel: Record<Occupation, string> = {
  TIDAK_BEKERJA: "Tidak Bekerja",
  BURUH_PABRIK: "Buruh Pabrik",
  NELAYAN: "Nelayan",
  PETANI: "Petani",
  BURUH_BANGUNAN: "Buruh Bangunan",
  BURUH_HARIAN: "Buruh Harian",
  SUPIR_KENEK: "Supir / Kenek",
  PELAUT: "Pelaut",
  PEDAGANG: "Pedagang",
  PRT: "Pembantu Rumah Tangga",
  TKI: "TKI",
  ASN: "ASN",
  LAINNYA: "Lainnya",
};

// Daftar pekerjaan berbeda untuk ayah dan ibu (sesuai kebutuhan yayasan)
const FATHER_OCCUPATIONS: Occupation[] = [
  "TIDAK_BEKERJA",
  "BURUH_PABRIK",
  "NELAYAN",
  "PETANI",
  "BURUH_BANGUNAN",
  "BURUH_HARIAN",
  "SUPIR_KENEK",
  "PELAUT",
  "PEDAGANG",
  "TKI",
  "ASN",
  "LAINNYA",
];

const MOTHER_OCCUPATIONS: Occupation[] = [
  "TIDAK_BEKERJA",
  "NELAYAN",
  "PEDAGANG",
  "PRT",
  "TKI",
  "BURUH_PABRIK",
  "BURUH_HARIAN",
  "ASN",
  "LAINNYA",
];

export const fatherOccupationOptions = FATHER_OCCUPATIONS.map((value) => ({
  value,
  label: occupationLabel[value],
}));

export const motherOccupationOptions = MOTHER_OCCUPATIONS.map((value) => ({
  value,
  label: occupationLabel[value],
}));

// Status keberadaan orang tua
export const parentStatusLabel: Record<ParentStatus, string> = {
  HIDUP: "Hidup",
  MENINGGAL: "Meninggal",
  TIDAK_DIKETAHUI: "Tidak Diketahui",
  BEKERJA_JAUH: "Bekerja Jauh",
  PROSES_HUKUM: "Menjalani Proses Hukum",
};

export const parentStatusOptions = Object.entries(parentStatusLabel).map(
  ([value, label]) => ({ value, label })
);

// Pilihan tingkat/kelas terakhir, bergantung jenjang pendidikan
export const gradeOptionsByEducation: Partial<Record<EducationLevel, string[]>> = {
  PAUD_TK: ["Playgroup", "Tingkat A", "Tingkat B"],
  SD: ["Kelas 1", "Kelas 2", "Kelas 3", "Kelas 4", "Kelas 5", "Kelas 6"],
  SMP: ["Kelas 7", "Kelas 8", "Kelas 9"],
  SMA_SMK: ["Kelas 10", "Kelas 11", "Kelas 12"],
};

// ---------- Saudara kandung ----------

export const siblingActivityLabel: Record<SiblingActivity, string> = {
  SEKOLAH: "Sekolah",
  BEKERJA: "Bekerja",
  BELUM_SEKOLAH: "Belum Sekolah",
  TIDAK_BEKERJA: "Tidak Bekerja",
};

export const siblingActivityOptions = Object.entries(siblingActivityLabel).map(
  ([value, label]) => ({ value, label })
);

export const siblingLivingWithLabel: Record<SiblingLivingWith, string> = {
  ORANG_TUA: "Orang Tua",
  WALI: "Wali",
  KELUARGA: "Keluarga",
  PANTI_ASUHAN: "Panti Asuhan",
};

export const siblingLivingWithOptions = Object.entries(
  siblingLivingWithLabel
).map(([value, label]) => ({ value, label }));

export const siblingRelationLabel: Record<SiblingRelation, string> = {
  KAKAK: "Kakak",
  ADIK: "Adik",
};

export const siblingRelationOptions = Object.entries(siblingRelationLabel).map(
  ([value, label]) => ({ value, label })
);

export const bloodTypeOptions = [
  { value: "UNKNOWN", label: "Belum diketahui" },
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "AB", label: "AB" },
  { value: "O", label: "O" },
];

export const residencyStatusOptions = [
  { value: "ACTIVE", label: "Aktif di Panti" },
  { value: "REINTEGRATED", label: "Reintegrasi Keluarga" },
  { value: "GRADUATED", label: "Lulus / Mandiri" },
];
