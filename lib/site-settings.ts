import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_LANDING,
  DEFAULT_YAYASAN_NAME,
  PROGRAM_ICON_KEYS,
  type LandingContent,
  type ProgramItem,
} from "@/lib/site-content";

/** Pemetaan field konten landing -> key di tabel SystemConfig */
export const LANDING_CONFIG_KEYS = {
  heroBadge: "LANDING_HERO_BADGE",
  heroTitle: "LANDING_HERO_TITLE",
  heroSubtitle: "LANDING_HERO_SUBTITLE",
  aboutTitle: "LANDING_ABOUT_TITLE",
  about: "YAYASAN_DESCRIPTION",
  vision: "YAYASAN_VISION",
  mission: "YAYASAN_MISSION",
  programsTitle: "LANDING_PROGRAMS_TITLE",
  programs: "LANDING_PROGRAMS",
  ctaTitle: "LANDING_CTA_TITLE",
  ctaSubtitle: "LANDING_CTA_SUBTITLE",
  copyright: "LANDING_COPYRIGHT",
} as const satisfies Record<keyof LandingContent, string>;

const IDENTITY_KEYS = [
  "YAYASAN_NAME",
  "YAYASAN_ADDRESS",
  "YAYASAN_PHONE",
  "YAYASAN_EMAIL",
  "YAYASAN_LOGO_URL",
] as const;

export type YayasanIdentity = {
  name: string;
  address: string;
  phone: string;
  email: string;
  /** URL logo (Cloudinary atau /api/yayasan-logo), kosong jika belum ada */
  logoUrl: string;
};

export type SiteSettings = {
  identity: YayasanIdentity;
  landing: LandingContent;
};

function parsePrograms(raw: string | undefined): ProgramItem[] {
  if (raw === undefined) return DEFAULT_LANDING.programs;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return DEFAULT_LANDING.programs;
    return value
      .filter(
        (item): item is ProgramItem =>
          typeof item?.title === "string" &&
          typeof item?.description === "string" &&
          PROGRAM_ICON_KEYS.includes(item?.icon)
      )
      .map(({ icon, title, description }) => ({ icon, title, description }));
  } catch {
    return DEFAULT_LANDING.programs;
  }
}

/**
 * Ambil identitas yayasan & konten halaman publik dalam satu query.
 * Key yang belum pernah disimpan memakai nilai bawaan.
 * Di-cache per request agar layout & halaman tidak query dua kali.
 */
export const getSiteSettings = cache(async function getSiteSettings(): Promise<SiteSettings> {
  const rows = await prisma.systemConfig.findMany({
    where: {
      configKey: {
        in: [...IDENTITY_KEYS, ...Object.values(LANDING_CONFIG_KEYS)],
      },
    },
  });
  const map = new Map(rows.map((row) => [row.configKey, row.configValue]));

  // Teks: key yang belum ada -> default; key yang sengaja dikosongkan -> kosong
  const text = (field: Exclude<keyof LandingContent, "programs">) =>
    map.get(LANDING_CONFIG_KEYS[field]) ?? DEFAULT_LANDING[field];

  return {
    identity: {
      name: map.get("YAYASAN_NAME") || DEFAULT_YAYASAN_NAME,
      address: map.get("YAYASAN_ADDRESS") ?? "",
      phone: map.get("YAYASAN_PHONE") ?? "",
      email: map.get("YAYASAN_EMAIL") ?? "",
      logoUrl: map.get("YAYASAN_LOGO_URL") ?? "",
    },
    landing: {
      heroBadge: text("heroBadge"),
      heroTitle: text("heroTitle"),
      heroSubtitle: text("heroSubtitle"),
      aboutTitle: text("aboutTitle"),
      about: text("about"),
      vision: text("vision"),
      mission: text("mission"),
      programsTitle: text("programsTitle"),
      programs: parsePrograms(map.get(LANDING_CONFIG_KEYS.programs)),
      ctaTitle: text("ctaTitle"),
      ctaSubtitle: text("ctaSubtitle"),
      copyright: text("copyright"),
    },
  };
});

export type ReceiptYayasan = Omit<YayasanIdentity, "logoUrl"> & {
  /** Data URL PNG/JPEG untuk @react-pdf, null jika tidak ada/gagal dimuat */
  logoSrc: string | null;
};

const LOGO_DATA_URL_PATTERN = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;
const MAX_REMOTE_LOGO_BYTES = 3 * 1024 * 1024;

/** Ambil logo sebagai data URL agar PDF tidak bergantung pada fetch saat render. */
async function loadLogoDataUrl(logoUrl: string): Promise<string | null> {
  if (logoUrl.startsWith("/api/yayasan-logo")) {
    const row = await prisma.systemConfig.findUnique({
      where: { configKey: "YAYASAN_LOGO_DATA" },
    });
    const value = row?.configValue ?? "";
    return LOGO_DATA_URL_PATTERN.test(value) ? value : null;
  }
  if (!logoUrl.startsWith("https://")) return null;
  try {
    const res = await fetch(logoUrl, { signal: AbortSignal.timeout(5000) });
    const mime = res.headers.get("content-type")?.split(";")[0] ?? "";
    if (!res.ok || (mime !== "image/png" && mime !== "image/jpeg")) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_REMOTE_LOGO_BYTES) return null;
    return `data:${mime};base64,${bytes.toString("base64")}`;
  } catch (error) {
    console.error("loadLogoDataUrl error:", error);
    return null;
  }
}

/** Identitas yayasan untuk kop kwitansi PDF. */
export async function getReceiptYayasan(): Promise<ReceiptYayasan> {
  const {
    identity: { logoUrl, ...identity },
  } = await getSiteSettings();
  return {
    ...identity,
    logoSrc: logoUrl ? await loadLogoDataUrl(logoUrl) : null,
  };
}
