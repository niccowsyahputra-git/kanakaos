import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
export function numberToWords(amount: number): string {
  if (!Number.isFinite(amount)) return "Nol Rupiah";

  const n = Math.floor(Math.abs(amount));
  if (n === 0) return "Nol Rupiah";

  const prefix = amount < 0 ? "Minus " : "";
  return `${prefix}${toWords(n)} Rupiah`;
}

/** Format angka ke Rupiah, contoh: 1500000 -> "Rp 1.500.000" */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
