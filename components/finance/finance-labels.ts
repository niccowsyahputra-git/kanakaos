import type {
  ProgramField,
  ProgramStatus,
  LeftoverRule,
  DonorCategory,
  FundRestriction,
  IncomeFundCategory,
  IncomeMethod,
  VerificationStatus,
  ExpensePocket,
  ExpenseCoa,
  ApprovalStatus,
} from "@prisma/client";

function toOptions<T extends string>(labels: Record<T, string>) {
  return (Object.entries(labels) as [T, string][]).map(([value, label]) => ({
    value,
    label,
  }));
}

// ---------- Program ----------
export const programFieldLabel: Record<ProgramField, string> = {
  PENDIDIKAN: "Pendidikan",
  KESEHATAN: "Kesehatan",
  SOSIAL_LOGISTIK: "Sosial & Logistik",
  INFRASTRUKTUR: "Infrastruktur",
  KEAGAMAAN: "Keagamaan",
};
export const programFieldOptions = toOptions(programFieldLabel);

export const programStatusLabel: Record<ProgramStatus, string> = {
  DRAFT: "Draft",
  AKTIF: "Aktif",
  PENYALURAN: "Penyaluran Dana",
  SELESAI: "Selesai & Laporan",
  DITANGGUHKAN: "Ditangguhkan",
};
export const programStatusOptions = toOptions(programStatusLabel);

export const programStatusClass: Record<ProgramStatus, string> = {
  DRAFT: "border-transparent bg-gray-100 text-gray-700",
  AKTIF: "border-transparent bg-green-100 text-green-800",
  PENYALURAN: "border-transparent bg-blue-100 text-blue-800",
  SELESAI: "border-transparent bg-purple-100 text-purple-800",
  DITANGGUHKAN: "border-transparent bg-amber-100 text-amber-800",
};

export const leftoverRuleLabel: Record<LeftoverRule, string> = {
  KE_OPERASIONAL: "Dialihkan otomatis ke kas operasional (dana tidak terikat)",
  KE_PROGRAM_LAIN: "Dialihkan ke program yang lain",
};
export const leftoverRuleOptions = toOptions(leftoverRuleLabel);

// ---------- Donatur ----------
export const donorCategoryLabel: Record<DonorCategory, string> = {
  PERORANGAN: "Donatur Perorangan",
  KORPORAT: "Donatur Korporat/Perusahaan",
  PEMERINTAH: "Lembaga Pemerintah (Hibah)",
  UNIT_BISNIS: "Unit Bisnis Yayasan (Aset Produktif)",
  LAINNYA: "Lainnya",
};
export const donorCategoryOptions = toOptions(donorCategoryLabel);

// ---------- Kas Masuk ----------
export const fundRestrictionLabel: Record<FundRestriction, string> = {
  TIDAK_TERIKAT: "Dana Tidak Terikat",
  TERIKAT_TEMPORER: "Dana Terikat Temporer",
  TERIKAT_PERMANEN: "Dana Terikat Permanen",
};
export const fundRestrictionOptions = toOptions(fundRestrictionLabel);

export const fundRestrictionHint: Record<FundRestriction, string> = {
  TIDAK_TERIKAT: "Bebas digunakan untuk semua operasional umum yayasan",
  TERIKAT_TEMPORER: "Dibatasi oleh waktu atau tujuan program spesifik",
  TERIKAT_PERMANEN:
    "Pokok dana tidak boleh menyusut, hanya hasil kelolanya yang boleh dipakai",
};

export const incomeFundCategoryLabel: Record<IncomeFundCategory, string> = {
  ZAKAT_MAAL: "Zakat Maal",
  ZAKAT_FITRAH: "Zakat Fitrah",
  INFAQ_SEDEKAH: "Infaq / Sedekah Umum",
  WAKAF_TUNAI: "Wakaf Tunai (Uang)",
  WAKAF_ASET: "Wakaf Aset",
  QURBAN: "Qurban",
  HIBAH_TERIKAT: "Dana Hibah Terikat (CSR/Sponsor)",
  PENDAPATAN_USAHA: "Pendapatan Usaha Mandiri Yayasan",
};
export const incomeFundCategoryOptions = toOptions(incomeFundCategoryLabel);

export const incomeMethodLabel: Record<IncomeMethod, string> = {
  TRANSFER_BANK: "Transfer Bank",
  TUNAI: "Tunai / Cash",
};
export const incomeMethodOptions = toOptions(incomeMethodLabel);

export const verificationLabel: Record<VerificationStatus, string> = {
  PENDING: "Pending (Menunggu Cek Mutasi Bank)",
  VERIFIED: "Verified (Dana Sudah Masuk Riil)",
  REJECTED: "Rejected (Bukti Transfer Palsu / Gagal)",
};

export const verificationShortLabel: Record<VerificationStatus, string> = {
  PENDING: "Pending",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

export const verificationClass: Record<VerificationStatus, string> = {
  PENDING: "border-transparent bg-amber-100 text-amber-800",
  VERIFIED: "border-transparent bg-green-100 text-green-800",
  REJECTED: "border-transparent bg-red-100 text-red-800",
};

// ---------- Kas Keluar ----------
export const expensePocketLabel: Record<ExpensePocket, string> = {
  TIDAK_TERIKAT: "Saldo Dana Tidak Terikat (Kas Operasional Umum)",
  TERIKAT: "Saldo Dana Terikat (pilih program spesifik)",
};
export const expensePocketOptions = toOptions(expensePocketLabel);

export const expenseCoaLabel: Record<ExpenseCoa, string> = {
  BEBAN_PROGRAM: "Beban Program & Penyaluran",
  BEBAN_GAJI: "Beban Gaji & Personalia",
  BEBAN_RUMAH_TANGGA: "Beban Rumah Tangga Panti",
  BEBAN_KANTOR: "Beban Kantor & Administrasi",
  BEBAN_FUNDRAISING: "Beban Pemasaran & Fundraising",
};
export const expenseCoaOptions = toOptions(expenseCoaLabel);

export const expenseCoaHint: Record<ExpenseCoa, string> = {
  BEBAN_PROGRAM: "Uang saku anak, SPP, sembako",
  BEBAN_GAJI: "Gaji pengasuh, insentif ustadz",
  BEBAN_RUMAH_TANGGA: "Listrik, air, internet, gas dapur",
  BEBAN_KANTOR: "Kertas, tinta printer, sewa domain website",
  BEBAN_FUNDRAISING: "Cetak brosur, iklan donasi sosmed",
};

export const approvalLabel: Record<ApprovalStatus, string> = {
  DRAFT: "Draft",
  REVIEW: "Menunggu Review (Bendahara)",
  APPROVAL: "Menunggu Approval (Ketua/Dewan Pembina)",
  SELESAI: "Selesai / Dana Cair",
};

export const approvalShortLabel: Record<ApprovalStatus, string> = {
  DRAFT: "Draft",
  REVIEW: "Menunggu Review",
  APPROVAL: "Menunggu Approval",
  SELESAI: "Dana Cair",
};

export const approvalClass: Record<ApprovalStatus, string> = {
  DRAFT: "border-transparent bg-gray-100 text-gray-700",
  REVIEW: "border-transparent bg-amber-100 text-amber-800",
  APPROVAL: "border-transparent bg-blue-100 text-blue-800",
  SELESAI: "border-transparent bg-green-100 text-green-800",
};

// ---------- Util ----------
export function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}
