import { intlTags, type Locale } from "./config";

type DateInput = Date | string | number;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Format tanggal panjang sesuai locale. Contoh id: "25 Oktober 2026", en: "October 25, 2026". */
export function formatDate(date: DateInput, locale: Locale): string {
  return new Intl.DateTimeFormat(intlTags[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(toDate(date));
}

/** Format tanggal singkat numerik sesuai locale. Contoh id: "25/10/2026", en: "10/25/2026". */
export function formatDateShort(date: DateInput, locale: Locale): string {
  return new Intl.DateTimeFormat(intlTags[locale], {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(toDate(date));
}

/** Format tanggal + jam sesuai locale. Contoh id: "25 Oktober 2026 14.30", en: "October 25, 2026 2:30 PM". */
export function formatDateTime(date: DateInput, locale: Locale): string {
  return new Intl.DateTimeFormat(intlTags[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(toDate(date));
}

/** Format Rupiah dengan pemisah angka sesuai locale (mata uang tetap IDR). */
export function formatRupiahLocale(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(intlTags[locale], {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format angka biasa sesuai locale (pemisah ribuan/desimal). */
export function formatNumberLocale(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlTags[locale]).format(value);
}
