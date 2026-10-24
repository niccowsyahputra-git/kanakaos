import type { HomeLeaveReason, HomeLeaveReturnStatus } from "@prisma/client";

// Tujuan kepulangan anak
export const homeLeaveReasonLabel: Record<HomeLeaveReason, string> = {
  LIBURAN_SEKOLAH: "Liburan Sekolah",
  LIBURAN_HARI_RAYA: "Liburan Hari Raya",
  ORANG_TUA_SAKIT: "Orang Tua Sakit",
  SAKIT: "Sakit",
  SKORSING: "Skorsing",
};

export const homeLeaveReasonOptions = Object.entries(homeLeaveReasonLabel).map(
  ([value, label]) => ({ value, label })
);

// Status kembali (dihitung otomatis dari rencana vs aktual)
export const returnStatusLabel: Record<HomeLeaveReturnStatus, string> = {
  BELUM_KEMBALI: "Belum Kembali",
  TEPAT_WAKTU: "Kembali Tepat Waktu",
  LEBIH_CEPAT: "Kembali Lebih Cepat",
  TERLAMBAT: "Kembali Terlambat",
};

export const returnStatusClass: Record<HomeLeaveReturnStatus, string> = {
  BELUM_KEMBALI: "border-transparent bg-amber-100 text-amber-800",
  TEPAT_WAKTU: "border-transparent bg-green-100 text-green-800",
  LEBIH_CEPAT: "border-transparent bg-teal-100 text-teal-800",
  TERLAMBAT: "border-transparent bg-red-100 text-red-800",
};
