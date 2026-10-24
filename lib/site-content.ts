// Konten halaman publik yang bisa diubah admin (disimpan di tabel SystemConfig).
// File ini bebas dari Prisma agar bisa dipakai juga oleh komponen client.

export const PROGRAM_ICON_KEYS = [
  "graduation",
  "health",
  "home",
  "handHeart",
  "heart",
  "users",
  "book",
  "food",
  "baby",
  "shield",
  "smile",
  "sparkles",
] as const;

export type ProgramIconKey = (typeof PROGRAM_ICON_KEYS)[number];

export type ProgramItem = {
  icon: ProgramIconKey;
  title: string;
  description: string;
};

export const MAX_PROGRAMS = 8;

export type LandingContent = {
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  aboutTitle: string;
  about: string;
  vision: string;
  mission: string;
  programsTitle: string;
  programs: ProgramItem[];
  ctaTitle: string;
  ctaSubtitle: string;
  copyright: string;
};

/** Konten bawaan, dipakai selama admin belum mengisi pengaturan. */
export const DEFAULT_LANDING: LandingContent = {
  heroBadge: "Setiap anak berhak atas masa depan",
  heroTitle: "Bersama {nama}, Wujudkan Harapan Anak-Anak Kita",
  heroSubtitle:
    "Kami merawat, mendidik, dan mendampingi anak-anak asuh dengan penuh kasih agar mereka tumbuh sehat, cerdas, dan mandiri.",
  aboutTitle: "Tentang Kami",
  about: "",
  vision:
    "Menjadi rumah yang aman dan penuh kasih bagi anak-anak yang membutuhkan, tempat mereka bertumbuh menjadi pribadi yang berkarakter dan mandiri.",
  mission:
    "Menyediakan pengasuhan berkualitas, pendidikan, layanan kesehatan, serta pendampingan psikososial dengan mengutamakan prinsip perlindungan anak (child safeguarding).",
  programsTitle: "Program Kami",
  programs: [
    {
      icon: "graduation",
      title: "Pendidikan",
      description:
        "Menjamin setiap anak asuh mendapat pendidikan formal dan bimbingan belajar.",
    },
    {
      icon: "health",
      title: "Kesehatan",
      description:
        "Pemeriksaan rutin, gizi seimbang, dan pendampingan psikologis anak.",
    },
    {
      icon: "home",
      title: "Pengasuhan",
      description: "Lingkungan tinggal yang aman, hangat, dan penuh kasih sayang.",
    },
    {
      icon: "handHeart",
      title: "Reintegrasi Keluarga",
      description:
        "Mendampingi anak kembali ke keluarga bila kondisi memungkinkan.",
    },
  ],
  ctaTitle: "Uluran Tangan Anda Sangat Berarti",
  ctaSubtitle:
    "Donasi Anda membantu memenuhi kebutuhan makan, pendidikan, dan kesehatan anak-anak asuh kami setiap hari.",
  copyright: "© {tahun} {nama}. Dikelola dengan KanakaOS.",
};

export const DEFAULT_YAYASAN_NAME = "Yayasan Kanaka";

/** Ganti placeholder {nama} dan {tahun} pada teks konten. */
export function fillPlaceholders(text: string, yayasanName: string): string {
  return text
    .replaceAll("{nama}", yayasanName)
    .replaceAll("{tahun}", String(new Date().getFullYear()));
}
