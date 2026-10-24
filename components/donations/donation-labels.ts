import type { DonationCategory } from "@prisma/client";

// Kategori dana donasi (syariah & umum)
export const donationCategoryLabel: Record<DonationCategory, string> = {
  ZAKAT_MAAL: "Zakat Maal",
  ZAKAT_FITRAH: "Zakat Fitrah",
  INFAQ_SEDEKAH: "Infaq / Sedekah Umum",
  WAKAF_TUNAI: "Wakaf Tunai (Uang)",
  WAKAF_ASET: "Wakaf Aset",
  HIBAH_TERIKAT: "Dana Hibah Terikat (CSR/Sponsor)",
  QURBAN: "Qurban",
};

export const donationCategoryOptions = Object.entries(
  donationCategoryLabel
).map(([value, label]) => ({ value, label }));
