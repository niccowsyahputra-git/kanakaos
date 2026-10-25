"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createTranslator, type Translator } from "./translate";
import type { Locale } from "./config";
import type { Dictionary } from "./locales/id";

export type I18nValue = { locale: Locale; t: Dictionary };

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  t,
  children,
}: I18nValue & { children: ReactNode }) {
  return (
    <I18nContext.Provider value={{ locale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

/** Akses kamus terjemahan + locale aktif dari client component. */
export function useI18n(): I18nValue & { tr: Translator } {
  const ctx = useContext(I18nContext);
  const tr = useMemo(() => createTranslator(ctx?.locale ?? "id"), [ctx?.locale]);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return { ...ctx, tr };
}
