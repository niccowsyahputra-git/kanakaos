import { validationErrorMap } from "@/lib/i18n/validation";
import { z } from "zod";
import { MAX_PROGRAMS, PROGRAM_ICON_KEYS } from "@/lib/site-content";
import { createTranslator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";
import { ASSET_LOCATIONS, PARTNER_TYPES, VOLUNTEER_FIELD_CODES, VOLUNTEER_EDUCATION, VOLUNTEER_AVAILABILITY, isDateOnly } from "@/lib/option-catalogs";

// Each request/form gets its own schema messages; no shared Zod error map.
export function getSchemas(locale: Locale = "id") {
  const tr = createTranslator(locale);
  const errorMap = validationErrorMap(locale);


// Helper: teks opsional dengan batas panjang (kosong -> undefined)
const optionalText = (max: number) =>
  z
    .string({ errorMap })
    .trim()
    .max(max, tr("Maksimal {0} karakter", { 0: max }))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined));

// Helper: angka opsional dari input string (kosong -> undefined)
const optionalNumber = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce
      .number({ errorMap: () => ({ message: tr("{0} tidak valid", { 0: label }) }) })
      .min(min, tr("{0} minimal {1}", { 0: label, 1: min }))
      .max(max, tr("{0} maksimal {1}", { 0: label, 1: max }))
      .optional()
  );

// Helper: enum agama opsional (kosong -> undefined)
const optionalReligion = z
  .enum(["ISLAM", "KRISTEN", "KATOLIK", "HINDU", "BUDDHA", "KHONGHUCU"], { errorMap })
  .optional()
  .or(z.literal("", { errorMap }).transform(() => undefined));

// Helper: enum pekerjaan orang tua opsional
const optionalOccupation = z
  .enum([
    "TIDAK_BEKERJA",
    "BURUH_PABRIK",
    "NELAYAN",
    "PETANI",
    "BURUH_BANGUNAN",
    "BURUH_HARIAN",
    "SUPIR_KENEK",
    "PELAUT",
    "PEDAGANG",
    "PRT",
    "TKI",
    "ASN",
    "LAINNYA",
  ], { errorMap })
  .optional()
  .or(z.literal("", { errorMap }).transform(() => undefined));

// Helper: enum status keberadaan orang tua opsional
const optionalParentStatus = z
  .enum([
    "HIDUP",
    "MENINGGAL",
    "TIDAK_DIKETAHUI",
    "BEKERJA_JAUH",
    "PROSES_HUKUM",
  ], { errorMap })
  .optional()
  .or(z.literal("", { errorMap }).transform(() => undefined));

const childSchema = z.object({
  fullName: z
    .string({ errorMap })
    .trim()
    .min(3, tr("Nama minimal 3 karakter"))
    .max(100, tr("Nama maksimal 100 karakter")),
  nik: z
    .string({ errorMap })
    .trim()
    .regex(/^\d{16}$/, tr("NIK harus 16 digit angka"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  dob: z.coerce
    .date({ errorMap: () => ({ message: tr("Tanggal lahir tidak valid") }) })
    .refine((d) => d <= new Date(), tr("Tanggal lahir tidak boleh di masa depan")),
  gender: z.enum(["MALE", "FEMALE"], {
    errorMap: () => ({ message: tr("Pilih jenis kelamin") }),
  }),
  religion: optionalReligion,
  bloodType: z.enum(["A", "B", "AB", "O", "UNKNOWN"], { errorMap }).default("UNKNOWN"),
  heightCm: optionalNumber(20, 250, tr("Tinggi badan")),
  weightKg: optionalNumber(1, 200, tr("Berat badan")),
  status: z.enum(["ACTIVE", "REINTEGRATED", "GRADUATED"], { errorMap }).default("ACTIVE"),
  orphanStatus: z
    .enum([
      "YATIM",
      "PIATU",
      "YATIM_PIATU",
      "KELUARGA_RETAK",
      "KELUARGA_MISKIN",
    ], { errorMap })
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  lastEducation: z
    .enum([
      "BELUM_SEKOLAH",
      "PAUD_TK",
      "SD",
      "SMP",
      "SMA_SMK",
      "PERGURUAN_TINGGI",
    ], { errorMap })
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  admissionDate: z.coerce
    .date({ errorMap: () => ({ message: tr("Tanggal masuk tidak valid") }) })
    .refine((d) => d <= new Date(), tr("Tanggal masuk tidak boleh di masa depan"))
    .optional(),
  admissionReason: optionalText(500),
  homeAddress: optionalText(300),
  fatherName: optionalText(100),
  fatherNik: z
    .string({ errorMap })
    .trim()
    .regex(/^\d{16}$/, tr("NIK Ayah harus 16 digit angka"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  fatherReligion: optionalReligion,
  fatherOccupation: optionalOccupation,
  fatherStatus: optionalParentStatus,
  motherName: optionalText(100),
  motherNik: z
    .string({ errorMap })
    .trim()
    .regex(/^\d{16}$/, tr("NIK Ibu harus 16 digit angka"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  motherReligion: optionalReligion,
  motherOccupation: optionalOccupation,
  motherStatus: optionalParentStatus,
  lastGrade: optionalText(30),
  birthOrder: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce
      .number({ errorMap: () => ({ message: tr("Anak ke-berapa tidak valid") }) })
      .int(tr("Anak ke-berapa harus bilangan bulat"))
      .min(1, tr("Anak ke-berapa minimal 1"))
      .max(30, tr("Anak ke-berapa maksimal 30"))
      .optional()
  ),
  siblingsCount: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce
      .number({ errorMap: () => ({ message: tr("Jumlah saudara tidak valid") }) })
      .int(tr("Jumlah saudara harus bilangan bulat"))
      .min(0, tr("Jumlah saudara minimal 0"))
      .max(15, tr("Jumlah saudara maksimal 15"))
      .optional()
  ),
  previousSchool: optionalText(150),
  achievements: optionalText(1000),
  medicalHistory: optionalText(1000),
  notes: optionalText(1000),
  guardianId: z
    .string({ errorMap })
    .cuid(tr("ID wali tidak valid"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
}, { errorMap });

// Data saudara kandung anak (dikirim sebagai JSON dari form)
const siblingSchema = z.object({
  name: z
    .string({ errorMap })
    .trim()
    .min(1, tr("Nama saudara wajib diisi"))
    .max(100, tr("Nama saudara maksimal 100 karakter")),
  gender: z
    .enum(["MALE", "FEMALE"], { errorMap })
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  dob: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce
      .date({ errorMap: () => ({ message: tr("Tanggal lahir saudara tidak valid") }) })
      .refine((d) => d <= new Date(), tr("Tanggal lahir saudara tidak boleh di masa depan"))
      .optional()
  ),
  activity: z
    .enum(["SEKOLAH", "BEKERJA", "BELUM_SEKOLAH", "TIDAK_BEKERJA"], { errorMap })
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  livingWith: z
    .enum(["ORANG_TUA", "WALI", "KELUARGA", "PANTI_ASUHAN"], { errorMap })
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  pantiName: optionalText(150),
  relation: z
    .enum(["KAKAK", "ADIK"], { errorMap })
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
}, { errorMap });

const siblingsArraySchema = z
  .array(siblingSchema, { errorMap })
  .max(15, tr("Maksimal 15 saudara"));

const dailyLogSchema = z.object({
  childId: z.string({ errorMap }).cuid(tr("Pilih anak terlebih dahulu")),
  date: z.coerce
    .date({ errorMap: () => ({ message: tr("Tanggal tidak valid") }) })
    .refine((d) => d <= new Date(), tr("Tanggal tidak boleh di masa depan"))
    .optional(),
  moodScore: z.coerce
    .number({ errorMap })
    .int(tr("Mood harus bilangan bulat"))
    .min(1, tr("Pilih mood anak"))
    .max(5, tr("Mood maksimal 5")),
  // Porsi makan per waktu: habis semua = 100%
  breakfastDone: z.boolean({ errorMap }).default(false),
  lunchDone: z.boolean({ errorMap }).default(false),
  dinnerDone: z.boolean({ errorMap }).default(false),
  sleepQuality: z.enum(["GOOD", "FAIR", "POOR"], {
    errorMap: () => ({ message: tr("Pilih kualitas tidur") }),
  }),
  // Sholat 5 waktu (checklist)
  prayerSubuh: z.boolean({ errorMap }).default(false),
  prayerDzuhur: z.boolean({ errorMap }).default(false),
  prayerAshar: z.boolean({ errorMap }).default(false),
  prayerMaghrib: z.boolean({ errorMap }).default(false),
  prayerIsya: z.boolean({ errorMap }).default(false),
  piketDone: z.boolean({ errorMap }).default(false),
  schoolAttendance: z
    .enum(["HADIR", "BOLOS", "IZIN", "SAKIT"], { errorMap })
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  evaluationNotes: z
    .string({ errorMap })
    .trim()
    .max(2000, tr("Catatan maksimal 2000 karakter"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
}, { errorMap });

const donationItemSchema = z.object({
  itemName: z
    .string({ errorMap })
    .trim()
    .min(2, tr("Nama barang minimal 2 karakter"))
    .max(100, tr("Nama barang maksimal 100 karakter")),
  quantity: z.coerce
    .number({ errorMap: () => ({ message: tr("Qty barang tidak valid") }) })
    .int(tr("Qty harus bilangan bulat"))
    .min(1, tr("Qty minimal 1"))
    .max(100000, tr("Qty terlalu besar")),
  unit: z.enum(["PCS", "KG", "LTR", "BOX"], {
    errorMap: () => ({ message: tr("Pilih satuan barang") }),
  }),
}, { errorMap });

const donationSchema = z
  .object({
    donaturName: z
      .string({ errorMap })
      .trim()
      .min(3, tr("Nama donatur minimal 3 karakter"))
      .max(100, tr("Nama donatur maksimal 100 karakter")),
    donorType: z.enum(["PERORANGAN", "PERUSAHAAN"], {
      errorMap: () => ({ message: tr("Pilih jenis donatur") }),
    }),
    donaturContact: z
      .string({ errorMap })
      .trim()
      .max(100, tr("Kontak maksimal 100 karakter"))
      .optional()
      .or(z.literal("", { errorMap }).transform(() => undefined)),
    donaturAddress: z
      .string({ errorMap })
      .trim()
      .max(300, tr("Alamat maksimal 300 karakter"))
      .optional()
      .or(z.literal("", { errorMap }).transform(() => undefined)),
    type: z.enum(["CASH", "TRANSFER", "IN_KIND"], {
      errorMap: () => ({ message: tr("Pilih metode donasi") }),
    }),
    category: z
      .enum([
        "ZAKAT_MAAL",
        "ZAKAT_FITRAH",
        "INFAQ_SEDEKAH",
        "WAKAF_TUNAI",
        "WAKAF_ASET",
        "HIBAH_TERIKAT",
        "QURBAN",
      ], { errorMap })
      .optional()
      .or(z.literal("", { errorMap }).transform(() => undefined)),
    // Nominal hanya relevan utk Tunai/Transfer (divalidasi di superRefine)
    amount: z.coerce
      .number({ errorMap: () => ({ message: tr("Nominal tidak valid") }) })
      .int(tr("Nominal harus bilangan bulat rupiah"))
      .min(0)
      .max(1_000_000_000_000, tr("Nominal terlalu besar"))
      .default(0),
    // Daftar barang hanya utk donasi Barang
    items: z.array(donationItemSchema, { errorMap }).max(30, tr("Maksimal 30 barang")).default([]),
    purpose: z
      .string({ errorMap })
      .trim()
      .max(500, tr("Peruntukan maksimal 500 karakter"))
      .optional()
      .or(z.literal("", { errorMap }).transform(() => undefined)),
  }, { errorMap })
  .superRefine((data, ctx) => {
    if (data.type === "IN_KIND") {
      if (data.items.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items"],
          message: tr("Tambahkan minimal 1 barang untuk donasi barang"),
        });
      }
    } else {
      if (data.amount < 1000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["amount"],
          message: tr("Nominal minimal Rp 1.000"),
        });
      }
    }
  });

const volunteerProfileShape = {
  skills: z.array(z.enum(VOLUNTEER_FIELD_CODES, { errorMap }), { errorMap })
    .min(1, tr("Pilih minimal 1 keahlian")).max(10)
    .refine(values => new Set(values).size === values.length, tr("Keahlian tidak boleh duplikat")),
  highestEducation: z.enum(VOLUNTEER_EDUCATION, { errorMap }).optional().or(z.literal("").transform(() => undefined)),
  major: optionalText(150),
  email: z.string({ errorMap }).trim().toLowerCase().email(tr("Email tidak valid")).max(100).optional().or(z.literal("").transform(() => undefined)),
  dob: z.string({ errorMap }).optional().or(z.literal("").transform(() => undefined)).refine(v => {
    if (!v) return true;
    if (!isDateOnly(v)) return false;
    const age = (Date.now() - new Date(v).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    return age >= 17 && age <= 80;
  }, tr("Usia relawan harus 17-80 tahun")),
  address: optionalText(300),
  occupation: optionalText(100),
  availability: optionalText(200),
  motivation: optionalText(1000),
};

const volunteerSchema = z.object({
  ...volunteerProfileShape,
  name: z
    .string({ errorMap })
    .trim()
    .min(3, tr("Nama minimal 3 karakter"))
    .max(100, tr("Nama maksimal 100 karakter")),
  phone: z
    .string({ errorMap })
    .trim()
    .max(20, tr("No. HP maksimal 20 karakter"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  hasSafeguardingCert: z.boolean({ errorMap }).default(false),
  needId: z
    .string({ errorMap })
    .cuid(tr("Kebutuhan relawan tidak valid"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
}, { errorMap });

// Edit / lengkapi data relawan (termasuk pendaftar PENDING dari form publik)
const volunteerUpdateSchema = volunteerSchema.extend({
  id: z.string({ errorMap }).cuid(tr("ID relawan tidak valid")),
});

// Kebutuhan relawan yayasan (bidang, jumlah, jadwal)
const volunteerNeedSchema = z.object({
  field: z.enum([...VOLUNTEER_FIELD_CODES, "OTHER"], { errorMap }),
  otherField: optionalText(100),
  startDate: z.string({ errorMap }).refine(isDateOnly, tr("Tanggal mulai tidak valid")),
  endDate: z.string({ errorMap }).refine(isDateOnly, tr("Tanggal akhir tidak valid")),
  description: optionalText(1000),
  quantity: z.coerce
    .number({ invalid_type_error: tr("Jumlah kebutuhan tidak valid") })
    .int(tr("Jumlah kebutuhan harus bilangan bulat"))
    .min(1, tr("Jumlah kebutuhan minimal 1 orang"))
    .max(1000, tr("Jumlah kebutuhan maksimal 1000 orang")),
  schedule: optionalText(200),
}, { errorMap }).superRefine((value, ctx) => {
  if (value.field === "OTHER" && (!value.otherField || value.otherField.length < 3)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["otherField"], message: tr("Isi bidang lainnya minimal 3 karakter") });
  }
  if (isDateOnly(value.startDate) && isDateOnly(value.endDate) && value.endDate < value.startDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: tr("Tanggal akhir tidak boleh sebelum tanggal mulai") });
  }
});

// Akun login untuk relawan (role otomatis VOLUNTEER)
const volunteerAccountSchema = z.object({
  name: z
    .string({ errorMap })
    .trim()
    .min(3, tr("Nama minimal 3 karakter"))
    .max(100, tr("Nama maksimal 100 karakter")),
  email: z
    .string({ errorMap })
    .trim()
    .toLowerCase()
    .email(tr("Email tidak valid"))
    .max(100, tr("Email maksimal 100 karakter")),
  password: z
    .string({ errorMap })
    .min(8, tr("Password minimal 8 karakter"))
    .max(100, tr("Password maksimal 100 karakter")),
}, { errorMap });

const redFlagSchema = z.object({
  volunteerId: z.string({ errorMap }).cuid(tr("ID relawan tidak valid")),
  reason: z
    .string({ errorMap })
    .trim()
    .min(10, tr("Alasan minimal 10 karakter agar jelas untuk audit"))
    .max(2000, tr("Alasan maksimal 2000 karakter")),
}, { errorMap });

const partnerSchema = z.object({
  name: z
    .string({ errorMap })
    .trim()
    .min(3, tr("Nama mitra minimal 3 karakter"))
    .max(150, tr("Nama mitra maksimal 150 karakter")),
  type: z.enum(PARTNER_TYPES, {
    errorMap: () => ({ message: tr("Pilih jenis mitra") }),
  }),
  picName: z
    .string({ errorMap })
    .trim()
    .max(100, tr("Nama PIC maksimal 100 karakter"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  picPhone: z
    .string({ errorMap })
    .trim()
    .max(20, tr("No. HP PIC maksimal 20 karakter"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  mouExpiryDate: z.coerce
    .date({ errorMap: () => ({ message: tr("Tanggal MoU tidak valid") }) })
    .optional(),
}, { errorMap });

const aiConfigSchema = z.object({
  provider: z.enum(["QWEN", "OPENAI", "CUSTOM"], {
    errorMap: () => ({ message: tr("Pilih provider AI") }),
  }),
  // Kosong = pertahankan API key yang sudah tersimpan
  apiKey: z
    .string({ errorMap })
    .trim()
    .max(300, tr("API Key terlalu panjang"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  baseUrl: z
    .string({ errorMap })
    .trim()
    .url(tr("Base URL harus berupa URL valid"))
    .max(300, tr("Base URL terlalu panjang")),
  modelName: z
    .string({ errorMap })
    .trim()
    .min(2, tr("Nama model wajib diisi"))
    .max(100, tr("Nama model terlalu panjang")),
}, { errorMap });

// ---------- Phase 7: User Management ----------

const createUserSchema = z.object({
  name: z
    .string({ errorMap })
    .trim()
    .min(3, tr("Nama minimal 3 karakter"))
    .max(100, tr("Nama maksimal 100 karakter")),
  email: z.string({ errorMap }).trim().toLowerCase().email(tr("Email tidak valid")),
  password: z
    .string({ errorMap })
    .min(8, tr("Password minimal 8 karakter"))
    .max(100, tr("Password maksimal 100 karakter")),
  role: z.enum(
    [
      "SUPER_ADMIN",
      "SOCIAL_WORKER",
      "CAREGIVER",
      "VOLUNTEER",
      "FINANCE",
      "LOGISTICS",
    ],
    {
      errorMap: () => ({ message: tr("Pilih role user") }),
    }
  ),
}, { errorMap });

const updateUserSchema = z.object({
  id: z.string({ errorMap }).cuid(tr("ID user tidak valid")),
  name: z
    .string({ errorMap })
    .trim()
    .min(3, tr("Nama minimal 3 karakter"))
    .max(100, tr("Nama maksimal 100 karakter")),
  role: z.enum(
    [
      "SUPER_ADMIN",
      "SOCIAL_WORKER",
      "CAREGIVER",
      "VOLUNTEER",
      "FINANCE",
      "LOGISTICS",
    ],
    {
      errorMap: () => ({ message: tr("Pilih role user") }),
    }
  ),
  // Kosong = tidak ganti password
  password: z
    .string({ errorMap })
    .min(8, tr("Password baru minimal 8 karakter"))
    .max(100, tr("Password maksimal 100 karakter"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
}, { errorMap });

// ---------- Phase 7: Settings ----------

const generalSettingsSchema = z.object({
  yayasanName: z
    .string({ errorMap })
    .trim()
    .min(3, tr("Nama yayasan minimal 3 karakter"))
    .max(150, tr("Nama yayasan maksimal 150 karakter")),
  yayasanAddress: z
    .string({ errorMap })
    .trim()
    .max(500, tr("Alamat maksimal 500 karakter"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  yayasanPhone: z
    .string({ errorMap })
    .trim()
    .max(30, tr("No. telepon maksimal 30 karakter"))
    .regex(/^[0-9+()\-\s]*$/, tr("No. telepon hanya boleh berisi angka, spasi, +, -, ( )"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  yayasanEmail: z
    .string({ errorMap })
    .trim()
    .email(tr("Email yayasan tidak valid"))
    .max(150, tr("Email maksimal 150 karakter"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  deedNumber: optionalText(100),
  skKemenkumham: optionalText(150),
  npwp: z
    .string({ errorMap })
    .trim()
    .max(30, tr("NPWP maksimal 30 karakter"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  nib: optionalText(100),
  tdy: optionalText(100),
  activityPermit: optionalText(150),
  domicileLetter: optionalText(150),
}, { errorMap });

// Konten halaman publik (landing page)
const landingText = (max: number, label: string) =>
  z.string({ errorMap }).trim().max(max, tr("{0} maksimal {1} karakter", { 0: label, 1: max }));

const landingSettingsSchema = z.object({
  heroBadge: landingText(100, tr("Label atas judul")),
  heroTitle: landingText(200, tr("Judul")).min(3, tr("Judul minimal 3 karakter")),
  heroSubtitle: landingText(500, tr("Sub judul")),
  aboutTitle: landingText(100, tr("Judul Tentang Kami")),
  about: landingText(2000, tr("Tentang Kami")),
  vision: landingText(1000, tr("Visi")),
  mission: landingText(2000, tr("Misi")),
  programsTitle: landingText(100, tr("Judul Program")),
  programs: z
    .array(
      z.object({
        icon: z.enum(PROGRAM_ICON_KEYS, { errorMap }),
        title: landingText(80, tr("Nama program")).min(1, tr("Nama program wajib diisi")),
        description: landingText(300, tr("Deskripsi program")),
      }, { errorMap }), { errorMap }
    )
    .max(MAX_PROGRAMS, tr("Maksimal {0} program", { 0: MAX_PROGRAMS })),
  ctaTitle: landingText(150, tr("Judul ajakan donasi")),
  ctaSubtitle: landingText(500, tr("Teks ajakan donasi")),
  copyright: landingText(200, "Copyright"),
}, { errorMap });

const notificationSettingsSchema = z.object({
  notifEmail: z
    .string({ errorMap })
    .trim()
    .email(tr("Email tidak valid"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  notifNewDonation: z.boolean({ errorMap }),
  notifRedFlag: z.boolean({ errorMap }),
  notifLowStock: z.boolean({ errorMap }),
}, { errorMap });

// ---------- Phase 7: Case Management ----------

const caseSchema = z.object({
  childId: z.string({ errorMap }).cuid(tr("Pilih anak terlebih dahulu")),
  caseType: z.enum(
    [
      "PROTECTION",
      "HEALTH",
      "EDUCATION",
      "PSYCHOSOCIAL",
      "LEGAL",
      "FAMILY_REUNIFICATION",
      "OTHER",
    ],
    { errorMap: () => ({ message: tr("Pilih jenis kasus") }) }
  ),
  description: z
    .string({ errorMap })
    .trim()
    .min(10, tr("Deskripsi minimal 10 karakter"))
    .max(2000, tr("Deskripsi maksimal 2000 karakter")),
  handling: optionalText(2000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"], {
    errorMap: () => ({ message: tr("Pilih prioritas") }),
  }),
}, { errorMap });

const interventionSchema = z.object({
  caseId: z.string({ errorMap }).cuid(tr("ID kasus tidak valid")),
  date: z
    .string({ errorMap })
    .min(1, tr("Tanggal wajib diisi"))
    .refine(
      (v) => !Number.isNaN(Date.parse(v)) && new Date(v) <= new Date(),
      tr("Tanggal tidak valid / di masa depan")
    ),
  interventionType: z
    .string({ errorMap })
    .trim()
    .min(3, tr("Jenis intervensi minimal 3 karakter"))
    .max(100, tr("Jenis intervensi maksimal 100 karakter")),
  notes: z
    .string({ errorMap })
    .trim()
    .min(5, tr("Catatan minimal 5 karakter"))
    .max(2000, tr("Catatan maksimal 2000 karakter")),
}, { errorMap });

const caseNoteSchema = z.object({
  caseId: z.string({ errorMap }).cuid(tr("ID kasus tidak valid")),
  content: z
    .string({ errorMap })
    .trim()
    .min(3, tr("Catatan minimal 3 karakter"))
    .max(2000, tr("Catatan maksimal 2000 karakter")),
}, { errorMap });

const closeCaseSchema = z.object({
  caseId: z.string({ errorMap }).cuid(tr("ID kasus tidak valid")),
  closeReason: z
    .string({ errorMap })
    .trim()
    .min(10, tr("Alasan penutupan minimal 10 karakter"))
    .max(1000, tr("Alasan maksimal 1000 karakter")),
}, { errorMap });

// ---------- Phase 7 Batch 2: Home Visit ----------

const homeVisitSchema = z.object({
  childId: z.string({ errorMap }).cuid(tr("Pilih anak terlebih dahulu")),
  officerId: z.string({ errorMap }).cuid(tr("Pilih petugas kunjungan")),
  scheduledDate: z
    .string({ errorMap })
    .min(1, tr("Tanggal kunjungan wajib diisi"))
    .refine((v) => !Number.isNaN(Date.parse(v)), tr("Tanggal tidak valid")),
  purpose: z
    .string({ errorMap })
    .trim()
    .min(5, tr("Tujuan kunjungan minimal 5 karakter"))
    .max(500, tr("Tujuan maksimal 500 karakter")),
}, { errorMap });

const completeVisitSchema = z.object({
  visitId: z.string({ errorMap }).cuid(tr("ID kunjungan tidak valid")),
  sanitationOk: z.boolean({ errorMap }),
  safetyOk: z.boolean({ errorMap }),
  cleanWaterOk: z.boolean({ errorMap }),
  childSpaceOk: z.boolean({ errorMap }),
  foodSecurityOk: z.boolean({ errorMap }),
  vulnerabilityScore: z.coerce
    .number({ errorMap })
    .int(tr("Skor harus bilangan bulat"))
    .min(0, tr("Skor minimal 0"))
    .max(10, tr("Skor maksimal 10")),
  visitNotes: z
    .string({ errorMap })
    .trim()
    .min(10, tr("Hasil kunjungan wajib diisi (min. 10 karakter)"))
    .max(2000, tr("Hasil kunjungan maksimal 2000 karakter")),
}, { errorMap });

// ---------- Phase 7 Batch 2: Shift Handover ----------

const shiftHandoverSchema = z.object({
  date: z
    .string({ errorMap })
    .min(1, tr("Tanggal wajib diisi"))
    .refine(
      (v) => !Number.isNaN(Date.parse(v)) && new Date(v) <= new Date(),
      tr("Tanggal tidak valid / di masa depan")
    ),
  shift: z.enum(["PAGI", "SIANG", "MALAM"], {
    errorMap: () => ({ message: tr("Pilih shift") }),
  }),
  allChildrenSafe: z.boolean({ errorMap }),
  sickChildrenNotes: z
    .string({ errorMap })
    .trim()
    .max(1000, tr("Catatan anak sakit maksimal 1000 karakter"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  importantNotes: z
    .string({ errorMap })
    .trim()
    .min(5, tr("Catatan penting minimal 5 karakter"))
    .max(2000, tr("Catatan maksimal 2000 karakter")),
}, { errorMap });

// ---------- Phase 7 Batch 2: Incident ----------

const incidentSchema = z.object({
  childId: z.string({ errorMap }).cuid(tr("Pilih anak terlebih dahulu")),
  incidentType: z.enum(["HEALTH", "BEHAVIOR", "ACCIDENT", "OTHER"], {
    errorMap: () => ({ message: tr("Pilih jenis insiden") }),
  }),
  description: z
    .string({ errorMap })
    .trim()
    .min(10, tr("Deskripsi minimal 10 karakter"))
    .max(2000, tr("Deskripsi maksimal 2000 karakter")),
  handling: optionalText(2000),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"], {
    errorMap: () => ({ message: tr("Pilih tingkat urgensi") }),
  }),
}, { errorMap });

// Update penanganan + status sederhana (Masih Berjalan / Selesai)
const incidentHandlingSchema = z.object({
  incidentId: z.string({ errorMap }).cuid(tr("ID insiden tidak valid")),
  handling: optionalText(2000),
  status: z.enum(["BERJALAN", "SELESAI"], {
    errorMap: () => ({ message: tr("Pilih status insiden") }),
  }),
}, { errorMap });

const caseHandlingSchema = z.object({
  caseId: z.string({ errorMap }).cuid(tr("ID kasus tidak valid")),
  handling: optionalText(2000),
  status: z.enum(["BERJALAN", "SELESAI"], {
    errorMap: () => ({ message: tr("Pilih status kasus") }),
  }),
}, { errorMap });

const incidentUpdateSchema = z.object({
  incidentId: z.string({ errorMap }).cuid(tr("ID insiden tidak valid")),
  notes: z
    .string({ errorMap })
    .trim()
    .min(5, tr("Catatan minimal 5 karakter"))
    .max(2000, tr("Catatan maksimal 2000 karakter")),
  newStatus: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"], { errorMap }).optional(),
}, { errorMap });

// ---------- Phase 7 Batch 3: Finance ----------

const transactionSchema = z.object({
  date: z
    .string({ errorMap })
    .min(1, tr("Tanggal wajib diisi"))
    .refine(
      (v) => !Number.isNaN(Date.parse(v)) && new Date(v) <= new Date(),
      tr("Tanggal tidak valid / di masa depan")
    ),
  description: z
    .string({ errorMap })
    .trim()
    .min(3, tr("Deskripsi minimal 3 karakter"))
    .max(300, tr("Deskripsi maksimal 300 karakter")),
  categoryId: z.string({ errorMap }).cuid(tr("Pilih kategori")),
  type: z.enum(["DEBIT", "CREDIT"], {
    errorMap: () => ({ message: tr("Pilih tipe transaksi") }),
  }),
  amount: z.coerce
    .number({ errorMap: () => ({ message: tr("Nominal tidak valid") }) })
    .int(tr("Nominal harus bilangan bulat rupiah"))
    .min(1, tr("Nominal minimal Rp 1"))
    .max(1_000_000_000_000, tr("Nominal terlalu besar")),
}, { errorMap });

const budgetSchema = z.object({
  categoryId: z.string({ errorMap }).cuid(tr("ID kategori tidak valid")),
  monthlyBudget: z.coerce
    .number({ errorMap: () => ({ message: tr("Budget tidak valid") }) })
    .int(tr("Budget harus bilangan bulat rupiah"))
    .min(0, tr("Budget tidak boleh negatif"))
    .max(1_000_000_000_000, tr("Budget terlalu besar")),
}, { errorMap });

const emailReceiptSchema = z.object({
  donationId: z.string({ errorMap }).cuid(tr("ID donasi tidak valid")),
  email: z.string({ errorMap }).trim().email(tr("Email tidak valid")),
}, { errorMap });

// ---------- Phase 7 Batch 4: Logistik ----------

const inventoryItemSchema = z.object({
  itemName: z
    .string({ errorMap })
    .trim()
    .min(2, tr("Nama barang minimal 2 karakter"))
    .max(100, tr("Nama barang maksimal 100 karakter")),
  category: z.enum(["MAKANAN", "ATK", "OBAT", "PERLENGKAPAN", "LAINNYA"], {
    errorMap: () => ({ message: tr("Pilih kategori barang") }),
  }),
  quantity: z.coerce
    .number({ errorMap })
    .int(tr("Jumlah harus bilangan bulat"))
    .min(0, tr("Jumlah tidak boleh negatif")),
  unit: z
    .string({ errorMap })
    .trim()
    .min(1, tr("Satuan wajib diisi"))
    .max(20, tr("Satuan maksimal 20 karakter")),
  minStock: z.coerce
    .number({ errorMap })
    .int(tr("Stok minimum harus bilangan bulat"))
    .min(0, tr("Stok minimum tidak boleh negatif")),
}, { errorMap });

const stockAdjustSchema = z.object({
  inventoryId: z.string({ errorMap }).cuid(tr("ID barang tidak valid")),
  delta: z.coerce
    .number({ errorMap })
    .int(tr("Jumlah harus bilangan bulat"))
    .refine((v) => v !== 0, tr("Adjustment tidak boleh 0")),
  reason: z
    .string({ errorMap })
    .trim()
    .min(3, tr("Alasan minimal 3 karakter"))
    .max(300, tr("Alasan maksimal 300 karakter")),
}, { errorMap });

const purchaseRequestSchema = z.object({
  inventoryId: z.string({ errorMap }).cuid(tr("Pilih barang")),
  quantity: z.coerce
    .number({ errorMap })
    .int(tr("Jumlah harus bilangan bulat"))
    .min(1, tr("Jumlah minimal 1")),
  notes: z
    .string({ errorMap })
    .trim()
    .max(500, tr("Catatan maksimal 500 karakter"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
}, { errorMap });

const prDecisionSchema = z.object({
  prId: z.string({ errorMap }).cuid(tr("ID PR tidak valid")),
  decision: z.enum(["APPROVED", "REJECTED"], { errorMap }),
  decisionNotes: z
    .string({ errorMap })
    .trim()
    .max(500, tr("Catatan maksimal 500 karakter"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
}, { errorMap });

const assetSchema = z.object({
  name: z
    .string({ errorMap })
    .trim()
    .min(2, tr("Nama aset minimal 2 karakter"))
    .max(150, tr("Nama aset maksimal 150 karakter")),
  category: z.enum(
    ["KENDARAAN", "ELEKTRONIK", "FURNITUR", "BANGUNAN", "LAINNYA"],
    { errorMap: () => ({ message: tr("Pilih kategori aset") }) }
  ),
  acquisitionDate: z
    .string({ errorMap })
    .min(1, tr("Tanggal perolehan wajib diisi"))
    .refine(
      (v) => !Number.isNaN(Date.parse(v)) && new Date(v) <= new Date(),
      tr("Tanggal tidak valid / di masa depan")
    ),
  value: z.coerce
    .number({ errorMap })
    .int(tr("Nilai harus bilangan bulat rupiah"))
    .min(0, tr("Nilai tidak boleh negatif")),
  location: z.enum(ASSET_LOCATIONS, { errorMap }).optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  condition: z.enum(["BAIK", "PERLU_PERBAIKAN", "RUSAK"], {
    errorMap: () => ({ message: tr("Pilih kondisi aset") }),
  }),
}, { errorMap });

const maintenanceSchema = z.object({
  assetId: z.string({ errorMap }).cuid(tr("Pilih aset")),
  maintenanceDate: z
    .string({ errorMap })
    .min(1, tr("Tanggal maintenance wajib diisi"))
    .refine((v) => !Number.isNaN(Date.parse(v)), tr("Tanggal tidak valid")),
  maintenanceType: z
    .string({ errorMap })
    .trim()
    .min(3, tr("Jenis maintenance minimal 3 karakter"))
    .max(100, tr("Jenis maintenance maksimal 100 karakter")),
  notes: z
    .string({ errorMap })
    .trim()
    .max(500, tr("Catatan maksimal 500 karakter"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
}, { errorMap });

// ---------- Phase 7 Batch 5: Halaman Publik ----------

const donationPledgeSchema = z.object({
  name: z
    .string({ errorMap })
    .trim()
    .min(3, tr("Nama minimal 3 karakter"))
    .max(100, tr("Nama maksimal 100 karakter")),
  email: z.string({ errorMap }).trim().email(tr("Email tidak valid")),
  phone: z
    .string({ errorMap })
    .trim()
    .max(20, tr("No. HP maksimal 20 karakter"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  amount: z.coerce
    .number({ errorMap: () => ({ message: tr("Nominal tidak valid") }) })
    .int(tr("Nominal harus bilangan bulat rupiah"))
    .min(10000, tr("Donasi minimal Rp 10.000"))
    .max(1_000_000_000, tr("Untuk donasi besar, silakan hubungi kami langsung")),
  purpose: z.enum(
    ["UNRESTRICTED", "PENDIDIKAN", "KESEHATAN", "MAKANAN", "RENOVASI"],
    { errorMap: () => ({ message: tr("Pilih tujuan donasi") }) }
  ),
  method: z.enum(["TRANSFER_BANK", tr("QRIS"), "E_WALLET"], {
    errorMap: () => ({ message: tr("Pilih metode pembayaran") }),
  }),
  message: z
    .string({ errorMap })
    .trim()
    .max(500, tr("Pesan maksimal 500 karakter"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
}, { errorMap });

const volunteerApplySchema = z.object({
  ...volunteerProfileShape,
  name: z
    .string({ errorMap })
    .trim()
    .min(3, tr("Nama minimal 3 karakter"))
    .max(100, tr("Nama maksimal 100 karakter")),
  email: z.string({ errorMap }).trim().toLowerCase().email(tr("Email tidak valid")).max(100),
  phone: z
    .string({ errorMap })
    .trim()
    .min(8, tr("No. HP minimal 8 digit"))
    .max(20, tr("No. HP maksimal 20 karakter")),
  dob: z
    .string({ errorMap })
    .min(1, tr("Tanggal lahir wajib diisi"))
    .refine((v) => {
      const date = new Date(v);
      if (!isDateOnly(v)) return false;
      const age =
        (Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      return age >= 17 && age <= 80;
    }, tr("Usia relawan harus 17-80 tahun")),
  address: z
    .string({ errorMap })
    .trim()
    .min(10, tr("Alamat minimal 10 karakter"))
    .max(300, tr("Alamat maksimal 300 karakter")),
  occupation: z
    .string({ errorMap })
    .trim()
    .min(2, tr("Pekerjaan wajib diisi"))
    .max(100, tr("Pekerjaan maksimal 100 karakter")),
  availability: z.array(z.enum(VOLUNTEER_AVAILABILITY, { errorMap }), { errorMap }).min(1, tr("Pilih minimal 1 ketersediaan")),
  motivation: z
    .string({ errorMap })
    .trim()
    .min(20, tr("Ceritakan motivasi Anda minimal 20 karakter"))
    .max(1000, tr("Motivasi maksimal 1000 karakter")),
  agreePolicy: z.literal(true, {
    errorMap: () => ({
      message: tr("Anda wajib menyetujui Kebijakan Perlindungan Anak"),
    }),
  }),
  needId: z
    .string({ errorMap })
    .cuid(tr("Kebutuhan relawan tidak valid"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
}, { errorMap });

// ---------- Phase 7 Batch 6: Profile & Notifications ----------

const updateProfileSchema = z.object({
  phone: z
    .string({ errorMap })
    .trim()
    .max(20, tr("No. HP maksimal 20 karakter"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
}, { errorMap });

const changePasswordSchema = z
  .object({
    oldPassword: z.string({ errorMap }).min(1, tr("Password lama wajib diisi")),
    newPassword: z
      .string({ errorMap })
      .min(8, tr("Password baru minimal 8 karakter"))
      .max(100, tr("Password maksimal 100 karakter")),
    confirmPassword: z.string({ errorMap }).min(1, tr("Konfirmasi password wajib diisi")),
  }, { errorMap })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: tr("Konfirmasi password tidak sama"),
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.oldPassword, {
    message: tr("Password baru harus berbeda dari password lama"),
    path: ["newPassword"],
  });

// ---------- Gap Fix: Guardian ----------

const guardianSchema = z.object({
  name: z
    .string({ errorMap })
    .trim()
    .min(3, tr("Nama wali minimal 3 karakter"))
    .max(100, tr("Nama wali maksimal 100 karakter")),
  phone: z
    .string({ errorMap })
    .trim()
    .max(20, tr("No. HP maksimal 20 karakter"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  dob: z.coerce
    .date({ errorMap: () => ({ message: tr("Tanggal lahir tidak valid") }) })
    .refine((d) => d <= new Date(), tr("Tanggal lahir tidak boleh di masa depan"))
    .optional(),
  relationship: z
    .enum([
      "Ayah Kandung",
      "Ibu Kandung",
      "Ayah Tiri",
      "Ibu Tiri",
      "Kakek",
      "Nenek",
      "Paman",
      "Bibi",
      "Kakak",
      "Keluarga Jauh",
      "Tetangga",
      "Guru",
    ], { errorMap })
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  nik: z
    .string({ errorMap })
    .trim()
    .regex(/^\d{16}$/, tr("No. KTP (NIK) harus 16 digit angka"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  kkNumber: z
    .string({ errorMap })
    .trim()
    .regex(/^\d{16}$/, tr("No. KK harus 16 digit angka"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  religion: optionalReligion,
  spouseName: z
    .string({ errorMap })
    .trim()
    .max(100, tr("Nama pasangan maksimal 100 karakter"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  spouseStatus: z
    .enum(["ISTRI", "SUAMI", "BERCERAI"], { errorMap })
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  spouseNik: z
    .string({ errorMap })
    .trim()
    .regex(/^\d{16}$/, tr("NIK Pasangan harus 16 digit angka"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  occupation: optionalOccupation,
  lastEducation: z
    .enum([
      "BELUM_SEKOLAH",
      "PAUD_TK",
      "SD",
      "SMP",
      "SMA_SMK",
      "PERGURUAN_TINGGI",
    ], { errorMap })
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  residenceStatus: z
    .enum(["MILIK_SENDIRI", "SEWA", "MENUMPANG", "TIDAK_MEMILIKI"], { errorMap })
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  monthlyIncome: optionalNumber(0, 1_000_000_000, tr("Penghasilan per bulan")),
  dependentsCount: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce
      .number({ errorMap: () => ({ message: tr("Jumlah tanggungan tidak valid") }) })
      .int(tr("Jumlah tanggungan harus bilangan bulat"))
      .min(0, tr("Jumlah tanggungan minimal 0"))
      .max(50, tr("Jumlah tanggungan maksimal 50"))
      .optional()
  ),
  address: z
    .string({ errorMap })
    .trim()
    .max(300, tr("Alamat maksimal 300 karakter"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  notes: z
    .string({ errorMap })
    .trim()
    .max(1000, tr("Catatan maksimal 1000 karakter"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
}, { errorMap });

// ---------- Modul Pegawai Yayasan ----------

const employeeSchema = z.object({
  // Data Pribadi
  firstName: z
    .string({ errorMap })
    .trim()
    .min(2, tr("Nama depan minimal 2 karakter"))
    .max(60, tr("Nama depan maksimal 60 karakter")),
  lastName: optionalText(60),
  gender: z.enum(["MALE", "FEMALE"], {
    errorMap: () => ({ message: tr("Pilih jenis kelamin") }),
  }),
  dob: z.coerce
    .date({ errorMap: () => ({ message: tr("Tanggal lahir tidak valid") }) })
    .refine((d) => d <= new Date(), tr("Tanggal lahir tidak boleh di masa depan"))
    .optional(),
  nik: z
    .string({ errorMap })
    .trim()
    .regex(/^\d{16}$/, tr("No. KTP harus 16 digit angka"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  religion: optionalReligion,
  phone: optionalText(20),
  email: z
    .string({ errorMap })
    .trim()
    .email(tr("Email tidak valid"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  // Kepegawaian
  employeeCode: z
    .string({ errorMap })
    .trim()
    .min(2, tr("Kode karyawan minimal 2 karakter"))
    .max(30, tr("Kode karyawan maksimal 30 karakter")),
  joinDate: z.coerce
    .date({ errorMap: () => ({ message: tr("Tanggal bergabung tidak valid") }) })
    .optional(),
  department: optionalText(80),
  position: optionalText(80),
  grade: optionalText(30),
  employmentStatus: z.enum(["TETAP", "KONTRAK", "HARIAN"], {
    errorMap: () => ({ message: tr("Pilih status kepegawaian") }),
  }),
  ptkpStatus: z
    .enum(["TK/0", "TK/1", "TK/2", "TK/3", "K/0", "K/1", "K/2", "K/3"], { errorMap })
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  entityLocation: optionalText(100),
  entityLocationId: z.string({ errorMap }).cuid(tr("Entitas lokasi tidak valid")).optional().or(z.literal("").transform(() => undefined)),
  // Gaji & Pajak
  basicSalary: optionalNumber(0, 1_000_000_000, tr("Gaji pokok")),
  salaryEffectiveDate: z.coerce
    .date({ errorMap: () => ({ message: tr("Tanggal efektif gaji tidak valid") }) })
    .optional(),
  npwp: z
    .string({ errorMap })
    .trim()
    .regex(/^[\d.\-]{15,20}$/, tr("No. NPWP harus 15-16 digit (boleh dengan titik/strip)"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  // Alamat
  fullAddress: optionalText(300),
  city: optionalText(80),
  province: optionalText(80),
  postalCode: z
    .string({ errorMap })
    .trim()
    .regex(/^\d{5}$/, tr("Kode pos harus 5 digit angka"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
}, { errorMap });

// ---------- Modul Kepulangan Anak ----------

const homeLeaveSchema = z
  .object({
    childId: z.string({ errorMap }).cuid(tr("Pilih anak terlebih dahulu")),
    leaveDate: z.coerce
      .date({ errorMap: () => ({ message: tr("Tanggal kepulangan tidak valid") }) }),
    plannedReturnDate: z.coerce
      .date({ errorMap: () => ({ message: tr("Rencana tanggal kembali tidak valid") }) })
      .optional(),
    actualReturnDate: z.coerce
      .date({ errorMap: () => ({ message: tr("Tanggal aktual kembali tidak valid") }) })
      .optional(),
    reason: z.enum(
      [
        "LIBURAN_SEKOLAH",
        "LIBURAN_HARI_RAYA",
        "ORANG_TUA_SAKIT",
        "SAKIT",
        "SKORSING",
      ],
      { errorMap: () => ({ message: tr("Pilih tujuan kepulangan") }) }
    ),
    description: optionalText(1000),
  }, { errorMap })
  .refine(
    (data) =>
      !data.plannedReturnDate || data.plannedReturnDate >= data.leaveDate,
    {
      message: tr("Rencana kembali tidak boleh sebelum tanggal kepulangan"),
      path: ["plannedReturnDate"],
    }
  )
  .refine(
    (data) =>
      !data.actualReturnDate || data.actualReturnDate >= data.leaveDate,
    {
      message: tr("Tanggal aktual kembali tidak boleh sebelum tanggal kepulangan"),
      path: ["actualReturnDate"],
    }
  );

// ---------- Modul Kunjungan Orang Tua/Wali ke Panti ----------

const familyVisitSchema = z.object({
  childId: z.string({ errorMap }).cuid(tr("Pilih anak yang dikunjungi")),
  visitorName: z
    .string({ errorMap })
    .trim()
    .min(2, tr("Nama pengunjung minimal 2 karakter"))
    .max(100, tr("Nama pengunjung maksimal 100 karakter")),
  relationship: optionalText(50),
  visitDate: z.coerce.date({
    errorMap: () => ({ message: tr("Tanggal & jam kunjungan tidak valid") }),
  }),
  purpose: z
    .string({ errorMap })
    .trim()
    .min(3, tr("Urusan kunjungan minimal 3 karakter"))
    .max(500, tr("Urusan kunjungan maksimal 500 karakter")),
}, { errorMap });

// ---------- Modul Keuangan Lanjutan ----------

// Separate from the legacy program schema so existing edit submissions stay valid.
const fundingAmount = z.coerce.number({
  errorMap: () => ({ message: tr("Nominal pendanaan harus berupa angka yang valid") }),
}).finite(tr("Nominal pendanaan harus berupa angka yang valid"))
  .min(0, tr("Nominal pendanaan tidak boleh negatif")).default(0);
const fundraisingShare = z.preprocess(
  value => value === null || (typeof value === "string" && !value.trim()) ? undefined : value,
  z.coerce.number({ errorMap: () => ({ message: tr("Isi porsi penggalangan antara 0–100%.") }) })
    .finite(tr("Isi porsi penggalangan antara 0–100%."))
    .min(0, tr("Isi porsi penggalangan antara 0–100%."))
    .max(100, tr("Isi porsi penggalangan antara 0–100%."))
);
const programFundingSchema = z.discriminatedUnion("sumberDana", [
  z.object({ sumberDana: z.literal("PENGGALANGAN"), fundraisingTarget: fundingAmount }),
  z.object({ sumberDana: z.literal("INTERNAL"), alokasiDanaInternal: fundingAmount }),
  z.object({
    sumberDana: z.literal("CAMPURAN"), fundraisingTarget: fundingAmount,
    alokasiDanaInternal: fundingAmount, porsiPenggalangan: fundraisingShare,
  }),
], { errorMap: () => ({ message: tr("Pilih sumber pendanaan") }) }).transform(data => ({
  sumberDana: data.sumberDana,
  fundraisingTarget: data.sumberDana === "INTERNAL" ? 0 : data.fundraisingTarget,
  alokasiDanaInternal: data.sumberDana === "PENGGALANGAN" ? 0 : data.alokasiDanaInternal,
  porsiPenggalangan: data.sumberDana === "CAMPURAN" ? data.porsiPenggalangan : null,
}));

const programSchema = z.object({
  name: z
    .string({ errorMap })
    .trim()
    .min(3, tr("Nama program minimal 3 karakter"))
    .max(150, tr("Nama program maksimal 150 karakter")),
  field: z.enum(
    ["PENDIDIKAN", "KESEHATAN", "SOSIAL_LOGISTIK", "INFRASTRUKTUR", "KEAGAMAAN"],
    { errorMap: () => ({ message: tr("Pilih kategori bidang") }) }
  ),
  fundraisingTarget: z.coerce
    .number({ errorMap })
    .min(0, tr("Target penggalangan tidak boleh negatif")),
  maxBudget: z.coerce
    .number({ errorMap })
    .min(0, tr("Anggaran maksimal tidak boleh negatif")),
  startDate: z.coerce.date({ errorMap }).optional(),
  picId: z.string({ errorMap }).cuid(tr("Pilih penanggung jawab")),
  status: z.enum(["DRAFT", "AKTIF", "PENYALURAN", "SELESAI", "DITANGGUHKAN"], { errorMap }),
  leftoverRule: z.enum(["KE_OPERASIONAL", "KE_PROGRAM_LAIN"], { errorMap }),
  description: optionalText(2000),
}, { errorMap });

const donorSchema = z.object({
  name: z
    .string({ errorMap })
    .trim()
    .min(2, tr("Nama lengkap minimal 2 karakter"))
    .max(150, tr("Nama maksimal 150 karakter")),
  category: z.enum(
    ["PERORANGAN", "KORPORAT", "PEMERINTAH", "UNIT_BISNIS", "LAINNYA"],
    { errorMap: () => ({ message: tr("Pilih kategori kontak") }) }
  ),
  address: optionalText(300),
  phone: optionalText(20),
  email: z
    .string({ errorMap })
    .trim()
    .email(tr("Format email tidak valid"))
    .optional()
    .or(z.literal("", { errorMap }).transform(() => undefined)),
  dob: z.coerce.date({ errorMap }).optional(),
  donorSince: z.coerce.date({ errorMap }).optional(),
  occupation: optionalText(100),
  monthlyIncome: z.coerce.number({ errorMap }).min(0).optional(),
  lastEducation: z
    .enum([
      "BELUM_SEKOLAH",
      "PAUD_TK",
      "SD",
      "SMP",
      "SMA_SMK",
      "PERGURUAN_TINGGI",
    ], { errorMap })
    .optional(),
}, { errorMap });

const financeIncomeSchema = z
  .object({
    date: z.coerce.date({
      errorMap: () => ({ message: tr("Tanggal transaksi tidak valid") }),
    }),
    contactCategory: z.enum(
      ["PERORANGAN", "KORPORAT", "PEMERINTAH", "UNIT_BISNIS", "LAINNYA"],
      { errorMap: () => ({ message: tr("Pilih kategori kontak") }) }
    ),
    donorId: z.string({ errorMap }).cuid().optional(),
    sourceName: z
      .string({ errorMap })
      .trim()
      .min(2, tr("Nama donatur/sumber wajib diisi"))
      .max(150, tr("Nama donatur/sumber maksimal 150 karakter")),
    restriction: z.enum(
      ["TIDAK_TERIKAT", "TERIKAT_TEMPORER", "TERIKAT_PERMANEN"],
      { errorMap: () => ({ message: tr("Pilih sifat keterikatan dana") }) }
    ),
    fundCategory: z.enum(
      [
        "ZAKAT_MAAL",
        "ZAKAT_FITRAH",
        "INFAQ_SEDEKAH",
        "WAKAF_TUNAI",
        "WAKAF_ASET",
        "QURBAN",
        "HIBAH_TERIKAT",
        "PENDAPATAN_USAHA",
      ],
      { errorMap: () => ({ message: tr("Pilih jenis kategori dana") }) }
    ),
    programId: z.string({ errorMap }).cuid().optional(),
    method: z.enum(["TRANSFER_BANK", "TUNAI"], {
      errorMap: () => ({ message: tr("Pilih metode pembayaran") }),
    }),
    amount: z.coerce
      .number({ errorMap: () => ({ message: tr("Jumlah transaksi tidak valid") }) })
      .finite(tr("Jumlah transaksi tidak valid"))
      .positive(tr("Jumlah transaksi harus lebih dari 0")),
    accountId: z.string({ errorMap }).cuid().optional(),
    memo: optionalText(1000),
  }, { errorMap })
  .refine(
    (data) => data.restriction === "TIDAK_TERIKAT" || !!data.programId,
    {
      message: tr("Alokasi program wajib dipilih untuk dana terikat"),
      path: ["programId"],
    }
  );

const financeExpenseSchema = z
  .object({
    date: z.coerce.date({
      errorMap: () => ({ message: tr("Tanggal pengeluaran tidak valid") }),
    }),
    accountId: z.string({ errorMap }).cuid(tr("Pilih sumber rekening kas")),
    pocket: z.enum(["TIDAK_TERIKAT", "TERIKAT"], {
      errorMap: () => ({ message: tr("Pilih kantong dana") }),
    }),
    programId: z.string({ errorMap }).cuid().optional(),
    sumberDana: z.enum(["PENGGALANGAN", "INTERNAL"], {
      errorMap: () => ({ message: tr("Pilih sumber dana pengeluaran program") }),
    }).optional(),
    coa: z.enum(
      [
        "BEBAN_PROGRAM",
        "BEBAN_GAJI",
        "BEBAN_RUMAH_TANGGA",
        "BEBAN_KANTOR",
        "BEBAN_FUNDRAISING",
      ],
      { errorMap: () => ({ message: tr("Pilih kategori biaya (COA)") }) }
    ),
    beneficiaryChildId: z.string({ errorMap }).cuid().optional(),
    beneficiaryName: optionalText(150),
    amount: z.coerce
      .number({ errorMap: () => ({ message: tr("Nilai pencairan tidak valid") }) })
      .finite(tr("Nilai pencairan tidak valid"))
      .positive(tr("Nilai pencairan harus lebih dari 0")),
  }, { errorMap })
  .refine((data) => data.pocket === "TIDAK_TERIKAT" || !!data.programId, {
    message: tr("Pilih program untuk beban dana terikat"),
    path: ["programId"],
  })
  .refine(data => data.pocket !== "TERIKAT" || !!data.sumberDana, {
    message: tr("Pilih sumber dana pengeluaran program"), path: ["sumberDana"],
  })
  .refine(data => data.pocket !== "TIDAK_TERIKAT" || (!data.programId && !data.sumberDana), {
    message: tr("Sumber dana program memerlukan kantong program"), path: ["pocket"],
  })
  .refine(
    (data) =>
      data.coa !== "BEBAN_PROGRAM" ||
      !!data.beneficiaryChildId ||
      !!data.beneficiaryName,
    {
      message:
        tr("Penerima manfaat wajib diisi untuk Beban Program & Penyaluran"),
      path: ["beneficiaryName"],
    }
  );
  return { childSchema, siblingSchema, siblingsArraySchema, dailyLogSchema, donationItemSchema, donationSchema, volunteerSchema, volunteerUpdateSchema, volunteerNeedSchema, volunteerAccountSchema, redFlagSchema, partnerSchema, aiConfigSchema, createUserSchema, updateUserSchema, generalSettingsSchema, landingSettingsSchema, notificationSettingsSchema, caseSchema, interventionSchema, caseNoteSchema, closeCaseSchema, homeVisitSchema, completeVisitSchema, shiftHandoverSchema, incidentSchema, incidentHandlingSchema, caseHandlingSchema, incidentUpdateSchema, transactionSchema, budgetSchema, emailReceiptSchema, inventoryItemSchema, stockAdjustSchema, purchaseRequestSchema, prDecisionSchema, assetSchema, maintenanceSchema, donationPledgeSchema, volunteerApplySchema, updateProfileSchema, changePasswordSchema, guardianSchema, employeeSchema, homeLeaveSchema, familyVisitSchema, programSchema, programFundingSchema, donorSchema, financeIncomeSchema, financeExpenseSchema };
}

// Preserve existing schema types and Indonesian defaults for non-UI consumers.
export const { childSchema, siblingSchema, siblingsArraySchema, dailyLogSchema, donationItemSchema, donationSchema, volunteerSchema, volunteerUpdateSchema, volunteerNeedSchema, volunteerAccountSchema, redFlagSchema, partnerSchema, aiConfigSchema, createUserSchema, updateUserSchema, generalSettingsSchema, landingSettingsSchema, notificationSettingsSchema, caseSchema, interventionSchema, caseNoteSchema, closeCaseSchema, homeVisitSchema, completeVisitSchema, shiftHandoverSchema, incidentSchema, incidentHandlingSchema, caseHandlingSchema, incidentUpdateSchema, transactionSchema, budgetSchema, emailReceiptSchema, inventoryItemSchema, stockAdjustSchema, purchaseRequestSchema, prDecisionSchema, assetSchema, maintenanceSchema, donationPledgeSchema, volunteerApplySchema, updateProfileSchema, changePasswordSchema, guardianSchema, employeeSchema, homeLeaveSchema, familyVisitSchema, programSchema, programFundingSchema, donorSchema, financeIncomeSchema, financeExpenseSchema } = getSchemas();


export type ChildInput = z.input<typeof childSchema>;


export type DailyLogInput = z.input<typeof dailyLogSchema>;


export type DonationInput = z.input<typeof donationSchema>;


export type VolunteerInput = z.input<typeof volunteerSchema>;


export type VolunteerUpdateInput = z.input<typeof volunteerUpdateSchema>;


export type VolunteerNeedInput = z.input<typeof volunteerNeedSchema>;


export type VolunteerAccountInput = z.input<typeof volunteerAccountSchema>;


export type RedFlagInput = z.input<typeof redFlagSchema>;


export type PartnerInput = z.input<typeof partnerSchema>;


export type AIConfigInput = z.input<typeof aiConfigSchema>;


export type CreateUserInput = z.input<typeof createUserSchema>;


export type UpdateUserInput = z.input<typeof updateUserSchema>;


export type LandingSettingsInput = z.input<typeof landingSettingsSchema>;


export type NotificationSettingsInput = z.input<
  typeof notificationSettingsSchema
>;


export type CaseInput = z.input<typeof caseSchema>;


export type HomeVisitInput = z.input<typeof homeVisitSchema>;


export type ShiftHandoverInput = z.input<typeof shiftHandoverSchema>;


export type DonationPledgeInput = z.input<typeof donationPledgeSchema>;


export type ChangePasswordInput = z.input<typeof changePasswordSchema>;


export type GuardianInput = z.input<typeof guardianSchema>;


export type EmployeeInput = z.input<typeof employeeSchema>;


export type HomeLeaveInput = z.input<typeof homeLeaveSchema>;


export type FamilyVisitInput = z.input<typeof familyVisitSchema>;


export type ProgramInput = z.input<typeof programSchema>;


export type DonorInput = z.input<typeof donorSchema>;


export type FinanceIncomeInput = z.input<typeof financeIncomeSchema>;


export type FinanceExpenseInput = z.input<typeof financeExpenseSchema>;
