import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { intlTags, type Locale } from "@/lib/i18n/config";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const EN_ONES = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const EN_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function toEnglishWords(n: number): string {
  if (n < 20) return EN_ONES[n];
  if (n < 100) return EN_TENS[Math.floor(n / 10)] + (n % 10 ? `-${EN_ONES[n % 10]}` : "");
  for (const [scale, name] of [[1e12, "Trillion"], [1e9, "Billion"], [1e6, "Million"], [1e3, "Thousand"], [100, "Hundred"]] as const) {
    if (n >= scale) return `${toEnglishWords(Math.floor(n / scale))} ${name}${n % scale ? ` ${toEnglishWords(n % scale)}` : ""}`;
  }
  return "Zero";
}

// ---------- Terbilang Bahasa Indonesia ----------

const SATUAN = [
  "",
  "Satu",
  "Dua",
  "Tiga",
  "Empat",
  "Lima",
  "Enam",
  "Tujuh",
  "Delapan",
  "Sembilan",
  "Sepuluh",
  "Sebelas",
];

/**
 * Konversi angka < 2000 triliun menjadi terbilang (tanpa suffix "Rupiah").
 * Mengikuti kaidah: 11-19 pakai "Belas", 100 = "Seratus", 1000 = "Seribu".
 */
function toWords(n: number): string {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${toWords(n - 10)} Belas`;
  if (n < 100) {
    const sisa = n % 10;
    return `${toWords(Math.floor(n / 10))} Puluh${sisa ? ` ${toWords(sisa)}` : ""}`;
  }
  if (n < 200) {
    const sisa = n - 100;
    return `Seratus${sisa ? ` ${toWords(sisa)}` : ""}`;
  }
  if (n < 1000) {
    const sisa = n % 100;
    return `${toWords(Math.floor(n / 100))} Ratus${sisa ? ` ${toWords(sisa)}` : ""}`;
  }
  if (n < 2000) {
    const sisa = n - 1000;
    return `Seribu${sisa ? ` ${toWords(sisa)}` : ""}`;
  }
  if (n < 1_000_000) {
    const sisa = n % 1000;
    return `${toWords(Math.floor(n / 1000))} Ribu${sisa ? ` ${toWords(sisa)}` : ""}`;
  }
  if (n < 1_000_000_000) {
    const sisa = n % 1_000_000;
    return `${toWords(Math.floor(n / 1_000_000))} Juta${sisa ? ` ${toWords(sisa)}` : ""}`;
  }
  if (n < 1_000_000_000_000) {
    const sisa = n % 1_000_000_000;
    return `${toWords(Math.floor(n / 1_000_000_000))} Miliar${sisa ? ` ${toWords(sisa)}` : ""}`;
  }
  const sisa = n % 1_000_000_000_000;
  return `${toWords(Math.floor(n / 1_000_000_000_000))} Triliun${sisa ? ` ${toWords(sisa)}` : ""}`;
}

/**
 * Mengubah angka menjadi terbilang Bahasa Indonesia dengan suffix "Rupiah".
 * Contoh: 1500000 -> "Satu Juta Lima Ratus Ribu Rupiah"
 */
export function numberToWords(amount: number, locale: Locale = "id"): string {
  if (locale === "en") {
    const n = Number.isFinite(amount) ? Math.floor(Math.abs(amount)) : 0;
    return `${amount < 0 && n ? "Minus " : ""}${toEnglishWords(n)} Rupiah`;
  }
  if (!Number.isFinite(amount)) return "Nol Rupiah";

  const n = Math.floor(Math.abs(amount));
  if (n === 0) return "Nol Rupiah";

  const prefix = amount < 0 ? "Minus " : "";
  return `${prefix}${toWords(n)} Rupiah`;
}

/** Format angka ke Rupiah, contoh: 1500000 -> "Rp 1.500.000" */
export function formatRupiah(amount: number, locale: Locale = "id"): string {
  return new Intl.NumberFormat(intlTags[locale], {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
