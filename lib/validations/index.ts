import { z } from "zod";

// Helper: teks opsional dengan batas panjang (kosong -> undefined)
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter`)
    .optional()
    .or(z.literal("").transform(() => undefined));

// Helper: angka opsional dari input string (kosong -> undefined)
const optionalNumber = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce
      .number({ errorMap: () => ({ message: `${label} tidak valid` }) })
      .min(min, `${label} minimal ${min}`)
      .max(max, `${label} maksimal ${max}`)
      .optional()
  );

// Helper: enum agama opsional (kosong -> undefined)
const optionalReligion = z
  .enum(["ISLAM", "KRISTEN", "KATOLIK", "HINDU", "BUDDHA", "KHONGHUCU"])
  .optional()
  .or(z.literal("").transform(() => undefined));

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
  ])
  .optional()
  .or(z.literal("").transform(() => undefined));

// Helper: enum status keberadaan orang tua opsional
const optionalParentStatus = z
  .enum([
    "HIDUP",
    "MENINGGAL",
    "TIDAK_DIKETAHUI",
    "BEKERJA_JAUH",
    "PROSES_HUKUM",
  ])
  .optional()
  .or(z.literal("").transform(() => undefined));

export const childSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "Nama minimal 3 karakter")
    .max(100, "Nama maksimal 100 karakter"),
  nik: z
    .string()
    .trim()
    .regex(/^\d{16}$/, "NIK harus 16 digit angka")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  dob: z.coerce
    .date({ errorMap: () => ({ message: "Tanggal lahir tidak valid" }) })
    .refine((d) => d <= new Date(), "Tanggal lahir tidak boleh di masa depan"),
  gender: z.enum(["MALE", "FEMALE"], {
    errorMap: () => ({ message: "Pilih jenis kelamin" }),
  }),
  religion: optionalReligion,
  bloodType: z.enum(["A", "B", "AB", "O", "UNKNOWN"]).default("UNKNOWN"),
  heightCm: optionalNumber(20, 250, "Tinggi badan"),
  weightKg: optionalNumber(1, 200, "Berat badan"),
  status: z.enum(["ACTIVE", "REINTEGRATED", "GRADUATED"]).default("ACTIVE"),
  orphanStatus: z
    .enum([
      "YATIM",
      "PIATU",
      "YATIM_PIATU",
      "KELUARGA_RETAK",
      "KELUARGA_MISKIN",
    ])
    .optional()
    .or(z.literal("").transform(() => undefined)),
  lastEducation: z
    .enum([
      "BELUM_SEKOLAH",
      "PAUD_TK",
      "SD",
      "SMP",
      "SMA_SMK",
      "PERGURUAN_TINGGI",
    ])
    .optional()
    .or(z.literal("").transform(() => undefined)),
  admissionDate: z.coerce
    .date({ errorMap: () => ({ message: "Tanggal masuk tidak valid" }) })
    .refine((d) => d <= new Date(), "Tanggal masuk tidak boleh di masa depan")
    .optional(),
  admissionReason: optionalText(500),
  homeAddress: optionalText(300),
  fatherName: optionalText(100),
  fatherNik: z
    .string()
    .trim()
    .regex(/^\d{16}$/, "NIK Ayah harus 16 digit angka")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  fatherReligion: optionalReligion,
  fatherOccupation: optionalOccupation,
  fatherStatus: optionalParentStatus,
  motherName: optionalText(100),
  motherNik: z
    .string()
    .trim()
    .regex(/^\d{16}$/, "NIK Ibu harus 16 digit angka")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  motherReligion: optionalReligion,
  motherOccupation: optionalOccupation,
  motherStatus: optionalParentStatus,
  lastGrade: optionalText(30),
  birthOrder: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce
      .number({ errorMap: () => ({ message: "Anak ke-berapa tidak valid" }) })
      .int("Anak ke-berapa harus bilangan bulat")
      .min(1, "Anak ke-berapa minimal 1")
      .max(30, "Anak ke-berapa maksimal 30")
      .optional()
  ),
  siblingsCount: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce
      .number({ errorMap: () => ({ message: "Jumlah saudara tidak valid" }) })
      .int("Jumlah saudara harus bilangan bulat")
      .min(0, "Jumlah saudara minimal 0")
      .max(15, "Jumlah saudara maksimal 15")
      .optional()
  ),
  previousSchool: optionalText(150),
  achievements: optionalText(1000),
  medicalHistory: optionalText(1000),
  notes: optionalText(1000),
  guardianId: z
    .string()
    .cuid("ID wali tidak valid")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type ChildInput = z.input<typeof childSchema>;

// Data saudara kandung anak (dikirim sebagai JSON dari form)
export const siblingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama saudara wajib diisi")
    .max(100, "Nama saudara maksimal 100 karakter"),
  gender: z
    .enum(["MALE", "FEMALE"])
    .optional()
    .or(z.literal("").transform(() => undefined)),
  dob: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce
      .date({ errorMap: () => ({ message: "Tanggal lahir saudara tidak valid" }) })
      .refine((d) => d <= new Date(), "Tanggal lahir saudara tidak boleh di masa depan")
      .optional()
  ),
  activity: z
    .enum(["SEKOLAH", "BEKERJA", "BELUM_SEKOLAH", "TIDAK_BEKERJA"])
    .optional()
    .or(z.literal("").transform(() => undefined)),
  livingWith: z
    .enum(["ORANG_TUA", "WALI", "KELUARGA", "PANTI_ASUHAN"])
    .optional()
    .or(z.literal("").transform(() => undefined)),
  pantiName: optionalText(150),
  relation: z
    .enum(["KAKAK", "ADIK"])
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const siblingsArraySchema = z
  .array(siblingSchema)
  .max(15, "Maksimal 15 saudara");

export const dailyLogSchema = z.object({
  childId: z.string().cuid("Pilih anak terlebih dahulu"),
  date: z.coerce
    .date({ errorMap: () => ({ message: "Tanggal tidak valid" }) })
    .refine((d) => d <= new Date(), "Tanggal tidak boleh di masa depan")
    .optional(),
  moodScore: z.coerce
    .number()
    .int("Mood harus bilangan bulat")
    .min(1, "Pilih mood anak")
    .max(5, "Mood maksimal 5"),
  // Porsi makan per waktu: habis semua = 100%
  breakfastDone: z.boolean().default(false),
  lunchDone: z.boolean().default(false),
  dinnerDone: z.boolean().default(false),
  sleepQuality: z.enum(["GOOD", "FAIR", "POOR"], {
    errorMap: () => ({ message: "Pilih kualitas tidur" }),
  }),
  // Sholat 5 waktu (checklist)
  prayerSubuh: z.boolean().default(false),
  prayerDzuhur: z.boolean().default(false),
  prayerAshar: z.boolean().default(false),
  prayerMaghrib: z.boolean().default(false),
  prayerIsya: z.boolean().default(false),
  piketDone: z.boolean().default(false),
  schoolAttendance: z
    .enum(["HADIR", "BOLOS", "IZIN", "SAKIT"])
    .optional()
    .or(z.literal("").transform(() => undefined)),
  evaluationNotes: z
    .string()
    .trim()
    .max(2000, "Catatan maksimal 2000 karakter")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type DailyLogInput = z.input<typeof dailyLogSchema>;

export const donationItemSchema = z.object({
  itemName: z
    .string()
    .trim()
    .min(2, "Nama barang minimal 2 karakter")
    .max(100, "Nama barang maksimal 100 karakter"),
  quantity: z.coerce
    .number({ errorMap: () => ({ message: "Qty barang tidak valid" }) })
    .int("Qty harus bilangan bulat")
    .min(1, "Qty minimal 1")
    .max(100000, "Qty terlalu besar"),
  unit: z.enum(["PCS", "KG", "LTR", "BOX"], {
    errorMap: () => ({ message: "Pilih satuan barang" }),
  }),
});

export const donationSchema = z
  .object({
    donaturName: z
      .string()
      .trim()
      .min(3, "Nama donatur minimal 3 karakter")
      .max(100, "Nama donatur maksimal 100 karakter"),
    donorType: z.enum(["PERORANGAN", "PERUSAHAAN"], {
      errorMap: () => ({ message: "Pilih jenis donatur" }),
    }),
    donaturContact: z
      .string()
      .trim()
      .max(100, "Kontak maksimal 100 karakter")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    donaturAddress: z
      .string()
      .trim()
      .max(300, "Alamat maksimal 300 karakter")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    type: z.enum(["CASH", "TRANSFER", "IN_KIND"], {
      errorMap: () => ({ message: "Pilih metode donasi" }),
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
      ])
      .optional()
      .or(z.literal("").transform(() => undefined)),
    // Nominal hanya relevan utk Tunai/Transfer (divalidasi di superRefine)
    amount: z.coerce
      .number({ errorMap: () => ({ message: "Nominal tidak valid" }) })
      .int("Nominal harus bilangan bulat rupiah")
      .min(0)
      .max(1_000_000_000_000, "Nominal terlalu besar")
      .default(0),
    // Daftar barang hanya utk donasi Barang
    items: z.array(donationItemSchema).max(30, "Maksimal 30 barang").default([]),
    purpose: z
      .string()
      .trim()
      .max(500, "Peruntukan maksimal 500 karakter")
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .superRefine((data, ctx) => {
    if (data.type === "IN_KIND") {
      if (data.items.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items"],
          message: "Tambahkan minimal 1 barang untuk donasi barang",
        });
      }
    } else {
      if (data.amount < 1000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["amount"],
          message: "Nominal minimal Rp 1.000",
        });
      }
    }
  });

export type DonationInput = z.input<typeof donationSchema>;

export const volunteerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Nama minimal 3 karakter")
    .max(100, "Nama maksimal 100 karakter"),
  phone: z
    .string()
    .trim()
    .max(20, "No. HP maksimal 20 karakter")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  skill: z
    .string()
    .trim()
    .max(100, "Keahlian maksimal 100 karakter")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  hasSafeguardingCert: z.boolean().default(false),
});

export type VolunteerInput = z.input<typeof volunteerSchema>;

export const redFlagSchema = z.object({
  volunteerId: z.string().cuid("ID relawan tidak valid"),
  reason: z
    .string()
    .trim()
    .min(10, "Alasan minimal 10 karakter agar jelas untuk audit")
    .max(2000, "Alasan maksimal 2000 karakter"),
});

export type RedFlagInput = z.input<typeof redFlagSchema>;

export const partnerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Nama mitra minimal 3 karakter")
    .max(150, "Nama mitra maksimal 150 karakter"),
  type: z.enum(["RS", "SEKOLAH", "POLISI", "CSR"], {
    errorMap: () => ({ message: "Pilih jenis mitra" }),
  }),
  picName: z
    .string()
    .trim()
    .max(100, "Nama PIC maksimal 100 karakter")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  picPhone: z
    .string()
    .trim()
    .max(20, "No. HP PIC maksimal 20 karakter")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  mouExpiryDate: z.coerce
    .date({ errorMap: () => ({ message: "Tanggal MoU tidak valid" }) })
    .optional(),
});

export type PartnerInput = z.input<typeof partnerSchema>;

export const aiConfigSchema = z.object({
  provider: z.enum(["QWEN", "OPENAI", "CUSTOM"], {
    errorMap: () => ({ message: "Pilih provider AI" }),
  }),
  // Kosong = pertahankan API key yang sudah tersimpan
  apiKey: z
    .string()
    .trim()
    .max(300, "API Key terlalu panjang")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  baseUrl: z
    .string()
    .trim()
    .url("Base URL harus berupa URL valid")
    .max(300, "Base URL terlalu panjang"),
  modelName: z
    .string()
    .trim()
    .min(2, "Nama model wajib diisi")
    .max(100, "Nama model terlalu panjang"),
});

export type AIConfigInput = z.input<typeof aiConfigSchema>;

// ---------- Phase 7: User Management ----------

export const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Nama minimal 3 karakter")
    .max(100, "Nama maksimal 100 karakter"),
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
  password: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .max(100, "Password maksimal 100 karakter"),
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
      errorMap: () => ({ message: "Pilih role user" }),
    }
  ),
});

export type CreateUserInput = z.input<typeof createUserSchema>;

export const updateUserSchema = z.object({
  id: z.string().cuid("ID user tidak valid"),
  name: z
    .string()
    .trim()
    .min(3, "Nama minimal 3 karakter")
    .max(100, "Nama maksimal 100 karakter"),
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
      errorMap: () => ({ message: "Pilih role user" }),
    }
  ),
  // Kosong = tidak ganti password
  password: z
    .string()
    .min(8, "Password baru minimal 8 karakter")
    .max(100, "Password maksimal 100 karakter")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type UpdateUserInput = z.input<typeof updateUserSchema>;

// ---------- Phase 7: Settings ----------

export const generalSettingsSchema = z.object({
  yayasanName: z
    .string()
    .trim()
    .min(3, "Nama yayasan minimal 3 karakter")
    .max(150, "Nama yayasan maksimal 150 karakter"),
  yayasanAddress: z
    .string()
    .trim()
    .max(500, "Alamat maksimal 500 karakter")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  vision: optionalText(1000),
  mission: optionalText(2000),
  description: optionalText(2000),
  deedNumber: optionalText(100),
  skKemenkumham: optionalText(150),
  npwp: z
    .string()
    .trim()
    .max(30, "NPWP maksimal 30 karakter")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  nib: optionalText(100),
  tdy: optionalText(100),
  activityPermit: optionalText(150),
  domicileLetter: optionalText(150),
});

export const notificationSettingsSchema = z.object({
  notifEmail: z
    .string()
    .trim()
    .email("Email tidak valid")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  notifNewDonation: z.boolean(),
  notifRedFlag: z.boolean(),
  notifLowStock: z.boolean(),
});

export type NotificationSettingsInput = z.input<
  typeof notificationSettingsSchema
>;

// ---------- Phase 7: Case Management ----------

export const caseSchema = z.object({
  childId: z.string().cuid("Pilih anak terlebih dahulu"),
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
    { errorMap: () => ({ message: "Pilih jenis kasus" }) }
  ),
  description: z
    .string()
    .trim()
    .min(10, "Deskripsi minimal 10 karakter")
    .max(2000, "Deskripsi maksimal 2000 karakter"),
  handling: optionalText(2000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"], {
    errorMap: () => ({ message: "Pilih prioritas" }),
  }),
});

export type CaseInput = z.input<typeof caseSchema>;

export const interventionSchema = z.object({
  caseId: z.string().cuid("ID kasus tidak valid"),
  date: z
    .string()
    .min(1, "Tanggal wajib diisi")
    .refine(
      (v) => !Number.isNaN(Date.parse(v)) && new Date(v) <= new Date(),
      "Tanggal tidak valid / di masa depan"
    ),
  interventionType: z
    .string()
    .trim()
    .min(3, "Jenis intervensi minimal 3 karakter")
    .max(100, "Jenis intervensi maksimal 100 karakter"),
  notes: z
    .string()
    .trim()
    .min(5, "Catatan minimal 5 karakter")
    .max(2000, "Catatan maksimal 2000 karakter"),
});

export const caseNoteSchema = z.object({
  caseId: z.string().cuid("ID kasus tidak valid"),
  content: z
    .string()
    .trim()
    .min(3, "Catatan minimal 3 karakter")
    .max(2000, "Catatan maksimal 2000 karakter"),
});

export const closeCaseSchema = z.object({
  caseId: z.string().cuid("ID kasus tidak valid"),
  closeReason: z
    .string()
    .trim()
    .min(10, "Alasan penutupan minimal 10 karakter")
    .max(1000, "Alasan maksimal 1000 karakter"),
});

// ---------- Phase 7 Batch 2: Home Visit ----------

export const homeVisitSchema = z.object({
  childId: z.string().cuid("Pilih anak terlebih dahulu"),
  officerId: z.string().cuid("Pilih petugas kunjungan"),
  scheduledDate: z
    .string()
    .min(1, "Tanggal kunjungan wajib diisi")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Tanggal tidak valid"),
  purpose: z
    .string()
    .trim()
    .min(5, "Tujuan kunjungan minimal 5 karakter")
    .max(500, "Tujuan maksimal 500 karakter"),
});

export type HomeVisitInput = z.input<typeof homeVisitSchema>;

export const completeVisitSchema = z.object({
  visitId: z.string().cuid("ID kunjungan tidak valid"),
  sanitationOk: z.boolean(),
  safetyOk: z.boolean(),
  cleanWaterOk: z.boolean(),
  childSpaceOk: z.boolean(),
  foodSecurityOk: z.boolean(),
  vulnerabilityScore: z.coerce
    .number()
    .int("Skor harus bilangan bulat")
    .min(0, "Skor minimal 0")
    .max(10, "Skor maksimal 10"),
  visitNotes: z
    .string()
    .trim()
    .min(10, "Hasil kunjungan wajib diisi (min. 10 karakter)")
    .max(2000, "Hasil kunjungan maksimal 2000 karakter"),
});

// ---------- Phase 7 Batch 2: Shift Handover ----------

export const shiftHandoverSchema = z.object({
  date: z
    .string()
    .min(1, "Tanggal wajib diisi")
    .refine(
      (v) => !Number.isNaN(Date.parse(v)) && new Date(v) <= new Date(),
      "Tanggal tidak valid / di masa depan"
    ),
  shift: z.enum(["PAGI", "SIANG", "MALAM"], {
    errorMap: () => ({ message: "Pilih shift" }),
  }),
  allChildrenSafe: z.boolean(),
  sickChildrenNotes: z
    .string()
    .trim()
    .max(1000, "Catatan anak sakit maksimal 1000 karakter")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  importantNotes: z
    .string()
    .trim()
    .min(5, "Catatan penting minimal 5 karakter")
    .max(2000, "Catatan maksimal 2000 karakter"),
});

export type ShiftHandoverInput = z.input<typeof shiftHandoverSchema>;

// ---------- Phase 7 Batch 2: Incident ----------

export const incidentSchema = z.object({
  childId: z.string().cuid("Pilih anak terlebih dahulu"),
  incidentType: z.enum(["HEALTH", "BEHAVIOR", "ACCIDENT", "OTHER"], {
    errorMap: () => ({ message: "Pilih jenis insiden" }),
  }),
  description: z
    .string()
    .trim()
    .min(10, "Deskripsi minimal 10 karakter")
    .max(2000, "Deskripsi maksimal 2000 karakter"),
  handling: optionalText(2000),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"], {
    errorMap: () => ({ message: "Pilih tingkat urgensi" }),
  }),
});

// Update penanganan + status sederhana (Masih Berjalan / Selesai)
export const incidentHandlingSchema = z.object({
  incidentId: z.string().cuid("ID insiden tidak valid"),
  handling: optionalText(2000),
  status: z.enum(["BERJALAN", "SELESAI"], {
    errorMap: () => ({ message: "Pilih status insiden" }),
  }),
});

export const caseHandlingSchema = z.object({
  caseId: z.string().cuid("ID kasus tidak valid"),
  handling: optionalText(2000),
  status: z.enum(["BERJALAN", "SELESAI"], {
    errorMap: () => ({ message: "Pilih status kasus" }),
  }),
});

export const incidentUpdateSchema = z.object({
  incidentId: z.string().cuid("ID insiden tidak valid"),
  notes: z
    .string()
    .trim()
    .min(5, "Catatan minimal 5 karakter")
    .max(2000, "Catatan maksimal 2000 karakter"),
  newStatus: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]).optional(),
});

// ---------- Phase 7 Batch 3: Finance ----------

export const transactionSchema = z.object({
  date: z
    .string()
    .min(1, "Tanggal wajib diisi")
    .refine(
      (v) => !Number.isNaN(Date.parse(v)) && new Date(v) <= new Date(),
      "Tanggal tidak valid / di masa depan"
    ),
  description: z
    .string()
    .trim()
    .min(3, "Deskripsi minimal 3 karakter")
    .max(300, "Deskripsi maksimal 300 karakter"),
  categoryId: z.string().cuid("Pilih kategori"),
  type: z.enum(["DEBIT", "CREDIT"], {
    errorMap: () => ({ message: "Pilih tipe transaksi" }),
  }),
  amount: z.coerce
    .number({ errorMap: () => ({ message: "Nominal tidak valid" }) })
    .int("Nominal harus bilangan bulat rupiah")
    .min(1, "Nominal minimal Rp 1")
    .max(1_000_000_000_000, "Nominal terlalu besar"),
});

export const budgetSchema = z.object({
  categoryId: z.string().cuid("ID kategori tidak valid"),
  monthlyBudget: z.coerce
    .number({ errorMap: () => ({ message: "Budget tidak valid" }) })
    .int("Budget harus bilangan bulat rupiah")
    .min(0, "Budget tidak boleh negatif")
    .max(1_000_000_000_000, "Budget terlalu besar"),
});

export const emailReceiptSchema = z.object({
  donationId: z.string().cuid("ID donasi tidak valid"),
  email: z.string().trim().email("Email tidak valid"),
});

// ---------- Phase 7 Batch 4: Logistik ----------

export const inventoryItemSchema = z.object({
  itemName: z
    .string()
    .trim()
    .min(2, "Nama barang minimal 2 karakter")
    .max(100, "Nama barang maksimal 100 karakter"),
  category: z.enum(["MAKANAN", "ATK", "OBAT", "PERLENGKAPAN", "LAINNYA"], {
    errorMap: () => ({ message: "Pilih kategori barang" }),
  }),
  quantity: z.coerce
    .number()
    .int("Jumlah harus bilangan bulat")
    .min(0, "Jumlah tidak boleh negatif"),
  unit: z
    .string()
    .trim()
    .min(1, "Satuan wajib diisi")
    .max(20, "Satuan maksimal 20 karakter"),
  minStock: z.coerce
    .number()
    .int("Stok minimum harus bilangan bulat")
    .min(0, "Stok minimum tidak boleh negatif"),
});

export const stockAdjustSchema = z.object({
  inventoryId: z.string().cuid("ID barang tidak valid"),
  delta: z.coerce
    .number()
    .int("Jumlah harus bilangan bulat")
    .refine((v) => v !== 0, "Adjustment tidak boleh 0"),
  reason: z
    .string()
    .trim()
    .min(3, "Alasan minimal 3 karakter")
    .max(300, "Alasan maksimal 300 karakter"),
});

export const purchaseRequestSchema = z.object({
  inventoryId: z.string().cuid("Pilih barang"),
  quantity: z.coerce
    .number()
    .int("Jumlah harus bilangan bulat")
    .min(1, "Jumlah minimal 1"),
  notes: z
    .string()
    .trim()
    .max(500, "Catatan maksimal 500 karakter")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const prDecisionSchema = z.object({
  prId: z.string().cuid("ID PR tidak valid"),
  decision: z.enum(["APPROVED", "REJECTED"]),
  decisionNotes: z
    .string()
    .trim()
    .max(500, "Catatan maksimal 500 karakter")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const assetSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama aset minimal 2 karakter")
    .max(150, "Nama aset maksimal 150 karakter"),
  category: z.enum(
    ["KENDARAAN", "ELEKTRONIK", "FURNITUR", "BANGUNAN", "LAINNYA"],
    { errorMap: () => ({ message: "Pilih kategori aset" }) }
  ),
  acquisitionDate: z
    .string()
    .min(1, "Tanggal perolehan wajib diisi")
    .refine(
      (v) => !Number.isNaN(Date.parse(v)) && new Date(v) <= new Date(),
      "Tanggal tidak valid / di masa depan"
    ),
  value: z.coerce
    .number()
    .int("Nilai harus bilangan bulat rupiah")
    .min(0, "Nilai tidak boleh negatif"),
  location: z
    .string()
    .trim()
    .max(100, "Lokasi maksimal 100 karakter")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  condition: z.enum(["BAIK", "PERLU_PERBAIKAN", "RUSAK"], {
    errorMap: () => ({ message: "Pilih kondisi aset" }),
  }),
});

export const maintenanceSchema = z.object({
  assetId: z.string().cuid("Pilih aset"),
  maintenanceDate: z
    .string()
    .min(1, "Tanggal maintenance wajib diisi")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Tanggal tidak valid"),
  maintenanceType: z
    .string()
    .trim()
    .min(3, "Jenis maintenance minimal 3 karakter")
    .max(100, "Jenis maintenance maksimal 100 karakter"),
  notes: z
    .string()
    .trim()
    .max(500, "Catatan maksimal 500 karakter")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

// ---------- Phase 7 Batch 5: Halaman Publik ----------

export const donationPledgeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Nama minimal 3 karakter")
    .max(100, "Nama maksimal 100 karakter"),
  email: z.string().trim().email("Email tidak valid"),
  phone: z
    .string()
    .trim()
    .max(20, "No. HP maksimal 20 karakter")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  amount: z.coerce
    .number({ errorMap: () => ({ message: "Nominal tidak valid" }) })
    .int("Nominal harus bilangan bulat rupiah")
    .min(10000, "Donasi minimal Rp 10.000")
    .max(1_000_000_000, "Untuk donasi besar, silakan hubungi kami langsung"),
  purpose: z.enum(
    ["UNRESTRICTED", "PENDIDIKAN", "KESEHATAN", "MAKANAN", "RENOVASI"],
    { errorMap: () => ({ message: "Pilih tujuan donasi" }) }
  ),
  method: z.enum(["TRANSFER_BANK", "QRIS", "E_WALLET"], {
    errorMap: () => ({ message: "Pilih metode pembayaran" }),
  }),
  message: z
    .string()
    .trim()
    .max(500, "Pesan maksimal 500 karakter")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type DonationPledgeInput = z.input<typeof donationPledgeSchema>;

export const volunteerApplySchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Nama minimal 3 karakter")
    .max(100, "Nama maksimal 100 karakter"),
  email: z.string().trim().email("Email tidak valid"),
  phone: z
    .string()
    .trim()
    .min(8, "No. HP minimal 8 digit")
    .max(20, "No. HP maksimal 20 karakter"),
  dob: z
    .string()
    .min(1, "Tanggal lahir wajib diisi")
    .refine((v) => {
      const date = new Date(v);
      if (Number.isNaN(date.getTime())) return false;
      const age =
        (Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      return age >= 17 && age <= 80;
    }, "Usia relawan harus 17-80 tahun"),
  address: z
    .string()
    .trim()
    .min(10, "Alamat minimal 10 karakter")
    .max(300, "Alamat maksimal 300 karakter"),
  occupation: z
    .string()
    .trim()
    .min(2, "Pekerjaan wajib diisi")
    .max(100, "Pekerjaan maksimal 100 karakter"),
  skills: z.array(z.string()).min(1, "Pilih minimal 1 keahlian"),
  availability: z.array(z.string()).min(1, "Pilih minimal 1 ketersediaan"),
  motivation: z
    .string()
    .trim()
    .min(20, "Ceritakan motivasi Anda minimal 20 karakter")
    .max(1000, "Motivasi maksimal 1000 karakter"),
  agreePolicy: z.literal(true, {
    errorMap: () => ({
      message: "Anda wajib menyetujui Kebijakan Perlindungan Anak",
    }),
  }),
});

// ---------- Phase 7 Batch 6: Profile & Notifications ----------

export const updateProfileSchema = z.object({
  phone: z
    .string()
    .trim()
    .max(20, "No. HP maksimal 20 karakter")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, "Password lama wajib diisi"),
    newPassword: z
      .string()
      .min(8, "Password baru minimal 8 karakter")
      .max(100, "Password maksimal 100 karakter"),
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Konfirmasi password tidak sama",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.oldPassword, {
    message: "Password baru harus berbeda dari password lama",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

// ---------- Gap Fix: Guardian ----------

export const guardianSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Nama wali minimal 3 karakter")
    .max(100, "Nama wali maksimal 100 karakter"),
  phone: z
    .string()
    .trim()
    .max(20, "No. HP maksimal 20 karakter")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  dob: z.coerce
    .date({ errorMap: () => ({ message: "Tanggal lahir tidak valid" }) })
    .refine((d) => d <= new Date(), "Tanggal lahir tidak boleh di masa depan")
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
    ])
    .optional()
    .or(z.literal("").transform(() => undefined)),
  nik: z
    .string()
    .trim()
    .regex(/^\d{16}$/, "No. KTP (NIK) harus 16 digit angka")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  kkNumber: z
    .string()
    .trim()
    .regex(/^\d{16}$/, "No. KK harus 16 digit angka")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  religion: optionalReligion,
  spouseName: z
    .string()
    .trim()
    .max(100, "Nama pasangan maksimal 100 karakter")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  spouseStatus: z
    .enum(["ISTRI", "SUAMI", "BERCERAI"])
    .optional()
    .or(z.literal("").transform(() => undefined)),
  spouseNik: z
    .string()
    .trim()
    .regex(/^\d{16}$/, "NIK Pasangan harus 16 digit angka")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  occupation: optionalOccupation,
  lastEducation: z
    .enum([
      "BELUM_SEKOLAH",
      "PAUD_TK",
      "SD",
      "SMP",
      "SMA_SMK",
      "PERGURUAN_TINGGI",
    ])
    .optional()
    .or(z.literal("").transform(() => undefined)),
  residenceStatus: z
    .enum(["MILIK_SENDIRI", "SEWA", "MENUMPANG", "TIDAK_MEMILIKI"])
    .optional()
    .or(z.literal("").transform(() => undefined)),
  monthlyIncome: optionalNumber(0, 1_000_000_000, "Penghasilan per bulan"),
  dependentsCount: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce
      .number({ errorMap: () => ({ message: "Jumlah tanggungan tidak valid" }) })
      .int("Jumlah tanggungan harus bilangan bulat")
      .min(0, "Jumlah tanggungan minimal 0")
      .max(50, "Jumlah tanggungan maksimal 50")
      .optional()
  ),
  address: z
    .string()
    .trim()
    .max(300, "Alamat maksimal 300 karakter")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  notes: z
    .string()
    .trim()
    .max(1000, "Catatan maksimal 1000 karakter")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type GuardianInput = z.input<typeof guardianSchema>;

// ---------- Modul Pegawai Yayasan ----------

export const employeeSchema = z.object({
  // Data Pribadi
  firstName: z
    .string()
    .trim()
    .min(2, "Nama depan minimal 2 karakter")
    .max(60, "Nama depan maksimal 60 karakter"),
  lastName: optionalText(60),
  gender: z.enum(["MALE", "FEMALE"], {
    errorMap: () => ({ message: "Pilih jenis kelamin" }),
  }),
  dob: z.coerce
    .date({ errorMap: () => ({ message: "Tanggal lahir tidak valid" }) })
    .refine((d) => d <= new Date(), "Tanggal lahir tidak boleh di masa depan")
    .optional(),
  nik: z
    .string()
    .trim()
    .regex(/^\d{16}$/, "No. KTP harus 16 digit angka")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  religion: optionalReligion,
  phone: optionalText(20),
  email: z
    .string()
    .trim()
    .email("Email tidak valid")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  // Kepegawaian
  employeeCode: z
    .string()
    .trim()
    .min(2, "Kode karyawan minimal 2 karakter")
    .max(30, "Kode karyawan maksimal 30 karakter"),
  joinDate: z.coerce
    .date({ errorMap: () => ({ message: "Tanggal bergabung tidak valid" }) })
    .optional(),
  department: optionalText(80),
  position: optionalText(80),
  grade: optionalText(30),
  employmentStatus: z.enum(["TETAP", "KONTRAK", "HARIAN"], {
    errorMap: () => ({ message: "Pilih status kepegawaian" }),
  }),
  ptkpStatus: z
    .enum(["TK/0", "TK/1", "TK/2", "TK/3", "K/0", "K/1", "K/2", "K/3"])
    .optional()
    .or(z.literal("").transform(() => undefined)),
  entityLocation: optionalText(100),
  // Gaji & Pajak
  basicSalary: optionalNumber(0, 1_000_000_000, "Gaji pokok"),
  salaryEffectiveDate: z.coerce
    .date({ errorMap: () => ({ message: "Tanggal efektif gaji tidak valid" }) })
    .optional(),
  npwp: z
    .string()
    .trim()
    .regex(/^[\d.\-]{15,20}$/, "No. NPWP harus 15-16 digit (boleh dengan titik/strip)")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  // Alamat
  fullAddress: optionalText(300),
  city: optionalText(80),
  province: optionalText(80),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Kode pos harus 5 digit angka")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type EmployeeInput = z.input<typeof employeeSchema>;

// ---------- Modul Kepulangan Anak ----------

export const homeLeaveSchema = z
  .object({
    childId: z.string().cuid("Pilih anak terlebih dahulu"),
    leaveDate: z.coerce
      .date({ errorMap: () => ({ message: "Tanggal kepulangan tidak valid" }) }),
    plannedReturnDate: z.coerce
      .date({ errorMap: () => ({ message: "Rencana tanggal kembali tidak valid" }) })
      .optional(),
    actualReturnDate: z.coerce
      .date({ errorMap: () => ({ message: "Tanggal aktual kembali tidak valid" }) })
      .optional(),
    reason: z.enum(
      [
        "LIBURAN_SEKOLAH",
        "LIBURAN_HARI_RAYA",
        "ORANG_TUA_SAKIT",
        "SAKIT",
        "SKORSING",
      ],
      { errorMap: () => ({ message: "Pilih tujuan kepulangan" }) }
    ),
    description: optionalText(1000),
  })
  .refine(
    (data) =>
      !data.plannedReturnDate || data.plannedReturnDate >= data.leaveDate,
    {
      message: "Rencana kembali tidak boleh sebelum tanggal kepulangan",
      path: ["plannedReturnDate"],
    }
  )
  .refine(
    (data) =>
      !data.actualReturnDate || data.actualReturnDate >= data.leaveDate,
    {
      message: "Tanggal aktual kembali tidak boleh sebelum tanggal kepulangan",
      path: ["actualReturnDate"],
    }
  );

export type HomeLeaveInput = z.input<typeof homeLeaveSchema>;

// ---------- Modul Kunjungan Orang Tua/Wali ke Panti ----------

export const familyVisitSchema = z.object({
  childId: z.string().cuid("Pilih anak yang dikunjungi"),
  visitorName: z
    .string()
    .trim()
    .min(2, "Nama pengunjung minimal 2 karakter")
    .max(100, "Nama pengunjung maksimal 100 karakter"),
  relationship: optionalText(50),
  visitDate: z.coerce.date({
    errorMap: () => ({ message: "Tanggal & jam kunjungan tidak valid" }),
  }),
  purpose: z
    .string()
    .trim()
    .min(3, "Urusan kunjungan minimal 3 karakter")
    .max(500, "Urusan kunjungan maksimal 500 karakter"),
});

export type FamilyVisitInput = z.input<typeof familyVisitSchema>;

// ---------- Modul Keuangan Lanjutan ----------

export const programSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Nama program minimal 3 karakter")
    .max(150, "Nama program maksimal 150 karakter"),
  field: z.enum(
    ["PENDIDIKAN", "KESEHATAN", "SOSIAL_LOGISTIK", "INFRASTRUKTUR", "KEAGAMAAN"],
    { errorMap: () => ({ message: "Pilih kategori bidang" }) }
  ),
  fundraisingTarget: z.coerce
    .number()
    .min(0, "Target penggalangan tidak boleh negatif"),
  maxBudget: z.coerce
    .number()
    .min(0, "Anggaran maksimal tidak boleh negatif"),
  startDate: z.coerce.date().optional(),
  picId: z.string().cuid("Pilih penanggung jawab"),
  status: z.enum(["DRAFT", "AKTIF", "PENYALURAN", "SELESAI", "DITANGGUHKAN"]),
  leftoverRule: z.enum(["KE_OPERASIONAL", "KE_PROGRAM_LAIN"]),
  description: optionalText(2000),
});

export type ProgramInput = z.input<typeof programSchema>;

export const donorSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama lengkap minimal 2 karakter")
    .max(150, "Nama maksimal 150 karakter"),
  category: z.enum(
    ["PERORANGAN", "KORPORAT", "PEMERINTAH", "UNIT_BISNIS", "LAINNYA"],
    { errorMap: () => ({ message: "Pilih kategori kontak" }) }
  ),
  address: optionalText(300),
  phone: optionalText(20),
  email: z
    .string()
    .trim()
    .email("Format email tidak valid")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  dob: z.coerce.date().optional(),
  donorSince: z.coerce.date().optional(),
  occupation: optionalText(100),
  monthlyIncome: z.coerce.number().min(0).optional(),
  lastEducation: z
    .enum([
      "BELUM_SEKOLAH",
      "PAUD_TK",
      "SD",
      "SMP",
      "SMA_SMK",
      "PERGURUAN_TINGGI",
    ])
    .optional(),
});

export type DonorInput = z.input<typeof donorSchema>;

export const financeIncomeSchema = z
  .object({
    date: z.coerce.date({
      errorMap: () => ({ message: "Tanggal transaksi tidak valid" }),
    }),
    contactCategory: z.enum(
      ["PERORANGAN", "KORPORAT", "PEMERINTAH", "UNIT_BISNIS", "LAINNYA"],
      { errorMap: () => ({ message: "Pilih kategori kontak" }) }
    ),
    donorId: z.string().cuid().optional(),
    sourceName: z
      .string()
      .trim()
      .min(2, "Nama donatur/sumber wajib diisi")
      .max(150, "Nama donatur/sumber maksimal 150 karakter"),
    restriction: z.enum(
      ["TIDAK_TERIKAT", "TERIKAT_TEMPORER", "TERIKAT_PERMANEN"],
      { errorMap: () => ({ message: "Pilih sifat keterikatan dana" }) }
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
      { errorMap: () => ({ message: "Pilih jenis kategori dana" }) }
    ),
    programId: z.string().cuid().optional(),
    method: z.enum(["TRANSFER_BANK", "TUNAI"], {
      errorMap: () => ({ message: "Pilih metode pembayaran" }),
    }),
    amount: z.coerce
      .number({ errorMap: () => ({ message: "Jumlah transaksi tidak valid" }) })
      .positive("Jumlah transaksi harus lebih dari 0"),
    accountId: z.string().cuid().optional(),
    memo: optionalText(1000),
  })
  .refine(
    (data) => data.restriction === "TIDAK_TERIKAT" || !!data.programId,
    {
      message: "Alokasi program wajib dipilih untuk dana terikat",
      path: ["programId"],
    }
  );

export type FinanceIncomeInput = z.input<typeof financeIncomeSchema>;

export const financeExpenseSchema = z
  .object({
    date: z.coerce.date({
      errorMap: () => ({ message: "Tanggal pengeluaran tidak valid" }),
    }),
    accountId: z.string().cuid("Pilih sumber rekening kas"),
    pocket: z.enum(["TIDAK_TERIKAT", "TERIKAT"], {
      errorMap: () => ({ message: "Pilih kantong dana" }),
    }),
    programId: z.string().cuid().optional(),
    coa: z.enum(
      [
        "BEBAN_PROGRAM",
        "BEBAN_GAJI",
        "BEBAN_RUMAH_TANGGA",
        "BEBAN_KANTOR",
        "BEBAN_FUNDRAISING",
      ],
      { errorMap: () => ({ message: "Pilih kategori biaya (COA)" }) }
    ),
    beneficiaryChildId: z.string().cuid().optional(),
    beneficiaryName: optionalText(150),
    amount: z.coerce
      .number({ errorMap: () => ({ message: "Nilai pencairan tidak valid" }) })
      .positive("Nilai pencairan harus lebih dari 0"),
  })
  .refine((data) => data.pocket === "TIDAK_TERIKAT" || !!data.programId, {
    message: "Pilih program untuk beban dana terikat",
    path: ["programId"],
  })
  .refine(
    (data) =>
      data.coa !== "BEBAN_PROGRAM" ||
      !!data.beneficiaryChildId ||
      !!data.beneficiaryName,
    {
      message:
        "Penerima manfaat wajib diisi untuk Beban Program & Penyaluran",
      path: ["beneficiaryName"],
    }
  );

export type FinanceExpenseInput = z.input<typeof financeExpenseSchema>;
