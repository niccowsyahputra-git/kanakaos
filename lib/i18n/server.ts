import { cookies } from "next/headers";
import { createTranslator, type Translator } from "./translate";
import {
  defaultLocale,
  isLocale,
  LOCALE_COOKIE,
  type Locale,
} from "./config";
import { type Dictionary } from "./locales/id";
import { id } from "./locales/id";
import { en } from "./locales/en";

const dictionaries: Record<Locale, Dictionary> = { id, en };

/** Ambil locale aktif dari cookie (fallback: bahasa default "id"). */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}

export type ServerT = { locale: Locale; t: Dictionary; tr: Translator };

/** Ambil locale + kamus terjemahan untuk server component / server action. */
export async function getT(): Promise<ServerT> {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale], tr: createTranslator(locale) };
}
