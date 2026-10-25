/** Bahasa yang didukung aplikasi. "id" adalah bahasa default. */
export const locales = ["id", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "id";

/** Nama cookie untuk menyimpan pilihan bahasa user. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Masa berlaku cookie bahasa: 1 tahun (detik). */
export const localeCookieMaxAge = 60 * 60 * 24 * 365;

export function isLocale(value: string | null | undefined): value is Locale {
  return (
    typeof value === "string" &&
    (locales as readonly string[]).includes(value)
  );
}

/** Tag Intl per locale, untuk format tanggal & angka. */
export const intlTags: Record<Locale, string> = {
  id: "id-ID",
  en: "en-US",
};
