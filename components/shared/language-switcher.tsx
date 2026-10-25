"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Languages } from "lucide-react";

import { useI18n } from "@/lib/i18n/client";
import {
  LOCALE_COOKIE,
  localeCookieMaxAge,
  locales,
  type Locale,
} from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * Tombol pilihan bahasa (ID / EN).
 * Menyimpan pilihan ke cookie lalu me-refresh server components.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${localeCookieMaxAge}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-0.5 rounded-full border bg-background p-1",
        className
      )}
      role="group"
      aria-label={t.common.language.label}
    >
      <Languages className="ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      {locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => switchTo(loc)}
          aria-pressed={loc === locale}
          disabled={isPending}
          title={loc === "id" ? "Bahasa Indonesia" : "English"}
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-semibold uppercase transition-colors",
            loc === locale
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
