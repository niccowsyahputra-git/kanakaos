/**
 * Seed data dummy komprehensif untuk KanakaOS.
 * Jalankan: npx tsx prisma/seed-dummy.ts
 *
 * Script ini idempoten: membersihkan data generatif lama lalu membuat ulang.
 * TIDAK menghapus akun User dasar (admin/finance/logistik) & CashAccount.
 */
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";
import { VOLUNTEER_FIELDS, VOLUNTEER_FIELD_CODES } from "../lib/option-catalogs";

// ---------- Util acak ----------
const rand = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const chance = (p: number) => Math.random() < p;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const dateInYear = (month: number, day: number) =>
  new Date(new Date().getFullYear(), month, day, 10, 0, 0);

const MALE_NAMES = [
  "Ahmad", "Budi", "Rizki", "Fajar", "Dimas", "Andi", "Bagus", "Hendra",
  "Iqbal", "Reza", "Yusuf", "Arif", "Galih", "Wahyu", "Teguh", "Rahmat",
  "Fikri", "Adit", "Bayu", "Naufal", "Ilham", "Dani", "Surya", "Eka", "Rio",
];
const FEMALE_NAMES = [
  "Siti", "Ayu", "Dewi", "Nur", "Putri", "Rara", "Intan", "Salsa", "Fitri",
  "Lestari", "Melati", "Anisa", "Zahra", "Aulia", "Kirana", "Maya", "Dinda",
  "Wulan", "Tari", "Nabila", "Sari", "Indah", "Cahya", "Rani", "Gita",
];
const LAST_NAMES = [
  "Pratama", "Saputra", "Wijaya", "Nugroho", "Ramadhan", "Hidayat", "Kusuma",
  "Santoso", "Maulana", "Firmansyah", "Halim", "Putri", "Lestari", "Anggraini",
  "Wibowo", "Setiawan", "Purnama", "Utami", "Permata", "Cahaya",
];

async function main() {
  console.log("🧹 Membersihkan data generatif lama...");
  await prisma.transaction.deleteMany({});
  await prisma.financeExpense.deleteMany({});
  await prisma.financeIncome.deleteMany({});
  await prisma.program.deleteMany({});
  await prisma.donor.deleteMany({});
  await prisma.donationItem.deleteMany({});
  await prisma.donation.deleteMany({});
  await prisma.familyVisit.deleteMany({});
  await prisma.homeVisit.deleteMany({});
  await prisma.homeLeave.deleteMany({});
  await prisma.incidentUpdate.deleteMany({});
  await prisma.incident.deleteMany({});
  await prisma.caseIntervention.deleteMany({});
  await prisma.caseNote.deleteMany({});
  await prisma.caseDocument.deleteMany({});
  await prisma.case.deleteMany({});
  await prisma.dailyLog.deleteMany({});
  await prisma.stockAdjustment.deleteMany({});
  await prisma.purchaseRequest.deleteMany({});
  await prisma.child.deleteMany({});
  await prisma.guardian.deleteMany({});
  await prisma.volunteer.deleteMany({});
  await prisma.partner.deleteMany({});
  await prisma.asset.deleteMany({});
  await prisma.inventory.deleteMany({});
  await prisma.employee.deleteMany({});

  // ---------- Profil Yayasan (SystemConfig) ----------
  console.log("🏢 Menulis profil yayasan...");
  const config: Record<string, string> = {
    YAYASAN_NAME: "Yayasan Panti Asuhan Kanaka Peduli",
    YAYASAN_ADDRESS: "Jl. Melati Indah No. 12, Kel. Sukamaju, Kec. Cilodong, Kota Depok, Jawa Barat 16414",
    YAYASAN_VISION: "Menjadi lembaga pengasuhan anak yang unggul, amanah, dan mandiri dalam melahirkan generasi berakhlak mulia.",
    YAYASAN_MISSION: "1. Memberikan pengasuhan penuh kasih sayang.\n2. Menjamin pendidikan berkualitas bagi setiap anak.\n3. Mengelola dana umat secara transparan & akuntabel.\n4. Membangun kemandirian ekonomi yayasan.",
    YAYASAN_DESCRIPTION: "Yayasan Panti Asuhan Kanaka Peduli berdiri sejak 2010, mengasuh anak yatim, piatu, dan dhuafa dengan pendekatan berbasis keluarga dan child safeguarding.",
    YAYASAN_DEED_NUMBER: "Akta Notaris No. 21 tanggal 15 Maret 2010 (Notaris H. Sudirman, S.H.)",
    YAYASAN_SK_KEMENKUMHAM: "AHU-0012345.AH.01.04.Tahun 2010",
    YAYASAN_NPWP: "31.234.567.8-412.000",
    YAYASAN_NIB: "1234567890123",
    YAYASAN_TDY: "TDY/423/DINSOS/2019",
    YAYASAN_ACTIVITY_PERMIT: "466/1234/IZIN-OP/DINSOS/2023",
    YAYASAN_DOMICILE: "470/89/Ds-SKM/2023",
  };
  for (const [k, v] of Object.entries(config)) {
    await prisma.systemConfig.upsert({
      where: { configKey: k },
      update: { configValue: v },
      create: { configKey: k, configValue: v },
    });
  }

  // ---------- Pengasuh (3 user + employee) ----------
  console.log("👥 Membuat 3 pengasuh + 5 pegawai lain...");
  const pengasuhPass = await bcrypt.hash("pengasuh123", 10);
  const caregiverIds: string[] = [];
  const pengasuhData = [
    { first: "Umi", last: "Kalsum", email: "umi.kalsum@kanaka.id", gender: "FEMALE" },
    { first: "Pak", last: "Slamet", email: "slamet@kanaka.id", gender: "MALE" },
    { first: "Bunda", last: "Ratih", email: "ratih@kanaka.id", gender: "FEMALE" },
  ];
  for (let i = 0; i < pengasuhData.length; i++) {
    const p = pengasuhData[i];
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: { role: "CAREGIVER", isActive: true },
      create: {
        name: `${p.first} ${p.last}`,
        email: p.email,
        password: pengasuhPass,
        role: "CAREGIVER",
        phone: `08123${randInt(100000, 999999)}`,
      },
    });
    caregiverIds.push(user.id);
    await prisma.employee.create({
      data: {
        firstName: p.first,
        lastName: p.last,
        gender: p.gender,
        employeeCode: `KNK-P${String(i + 1).padStart(3, "0")}`,
        department: "Pengasuhan",
        position: "Pengasuh",
        employmentStatus: "TETAP",
        joinDate: daysAgo(randInt(400, 1200)),
        basicSalary: randInt(2500, 3500) * 1000,
        phone: user.phone,
        email: p.email,
        userId: user.id,
        city: "Depok",
        province: "Jawa Barat",
      },
    });
  }

  // 5 pegawai lain (tanpa akun login)
  const otherStaff = [
    { first: "Ibu", last: "Sumarni", gender: "FEMALE", dept: "Dapur", pos: "Juru Masak" },
    { first: "Pak", last: "Joko", gender: "MALE", dept: "Keamanan", pos: "Satpam" },
    { first: "Rina", last: "Marlina", gender: "FEMALE", dept: "Administrasi", pos: "Staf Admin" },
    { first: "Ustadz", last: "Hakim", gender: "MALE", dept: "Pendidikan", pos: "Guru Mengaji" },
    { first: "Pak", last: "Darto", gender: "MALE", dept: "Umum", pos: "Sopir" },
  ];
  for (let i = 0; i < otherStaff.length; i++) {
    const s = otherStaff[i];
    await prisma.employee.create({
      data: {
        firstName: s.first,
        lastName: s.last,
        gender: s.gender,
        employeeCode: `KNK-S${String(i + 1).padStart(3, "0")}`,
        department: s.dept,
        position: s.pos,
        employmentStatus: rand(["TETAP", "KONTRAK", "HARIAN"] as const),
        joinDate: daysAgo(randInt(200, 900)),
        basicSalary: randInt(1800, 3000) * 1000,
        phone: `0813${randInt(1000000, 9999999)}`,
        city: "Depok",
        province: "Jawa Barat",
      },
    });
  }

  const staffUserIds = [...caregiverIds];
  const adminUser = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
  });
  const adminId = adminUser?.id ?? caregiverIds[0];

  // ---------- 50 Anak Asuh + Wali ----------
  console.log("🧒 Membuat 50 anak asuh + wali...");
  const EDU_BY_AGE = (age: number) => {
    if (age < 5) return "BELUM_SEKOLAH";
    if (age < 7) return "PAUD_TK";
    if (age < 13) return "SD";
    if (age < 16) return "SMP";
    if (age < 19) return "SMA_SMK";
    return "PERGURUAN_TINGGI";
  };
  const GRADE = (edu: string) => {
    if (edu === "SD") return `Kelas ${randInt(1, 6)}`;
    if (edu === "SMP") return `Kelas ${randInt(7, 9)}`;
    if (edu === "SMA_SMK") return `Kelas ${rand([10, 11, 12])}`;
    if (edu === "PERGURUAN_TINGGI") return `Semester ${randInt(1, 8)}`;
    return null;
  };
  const childIds: string[] = [];
  const schoolAgeChildIds: string[] = [];

  for (let i = 0; i < 50; i++) {
    const isMale = i % 2 === 0;
    const gender = isMale ? "MALE" : "FEMALE";
    const firstName = isMale ? rand(MALE_NAMES) : rand(FEMALE_NAMES);
    const fullName = `${firstName} ${rand(LAST_NAMES)}`;
    const age = randInt(4, 20);
    const dob = new Date(
      new Date().getFullYear() - age,
      randInt(0, 11),
      randInt(1, 28)
    );
    const edu = EDU_BY_AGE(age);
    const orphan = rand([
      "YATIM", "PIATU", "YATIM_PIATU", "KELUARGA_RETAK", "KELUARGA_MISKIN",
    ] as const);

    const guardian = await prisma.guardian.create({
      data: {
        name: `Wali ${firstName}`,
        phone: `0852${randInt(1000000, 9999999)}`,
        address: `Kp. ${rand(["Sukamaju", "Cimanggis", "Sawangan", "Bojong"])} RT ${randInt(1, 12)}/RW ${randInt(1, 8)}, Depok`,
        relationship: rand(["Nenek", "Kakek", "Paman", "Bibi", "Kakak Kandung", "Ibu Kandung"]),
        vulnerabilityScore: randInt(1, 10),
        nik: `32760${randInt(10000000000, 99999999999)}`,
        religion: "ISLAM",
        occupation: rand([
          "BURUH_HARIAN", "PEDAGANG", "PETANI", "TIDAK_BEKERJA", "PRT", "NELAYAN",
        ] as const),
        lastEducation: rand(["SD", "SMP", "SMA_SMK"] as const),
        residenceStatus: rand(["SEWA", "MENUMPANG", "MILIK_SENDIRI"] as const),
        monthlyIncome: randInt(500, 2500) * 1000,
        dependentsCount: randInt(1, 5),
      },
    });

    const child = await prisma.child.create({
      data: {
        fullName,
        gender,
        dob,
        nik: `32760${randInt(10000000000, 99999999999)}`,
        religion: "ISLAM",
        bloodType: rand(["A", "B", "AB", "O"]),
        heightCm: 90 + age * randInt(3, 5),
        weightKg: 12 + age * randInt(2, 3),
        admissionDate: daysAgo(randInt(30, 1500)),
        admissionReason: rand([
          "Orang tua meninggal", "Keluarga tidak mampu", "Anak terlantar",
          "Rujukan Dinas Sosial", "Broken home",
        ]),
        status: "ACTIVE",
        orphanStatus: orphan,
        homeAddress: guardian.address,
        fatherName: `Bpk ${rand(LAST_NAMES)}`,
        fatherStatus: rand(["MENINGGAL", "HIDUP", "TIDAK_DIKETAHUI"] as const),
        motherName: `Ibu ${rand(FEMALE_NAMES)}`,
        motherStatus: rand(["MENINGGAL", "HIDUP", "BEKERJA_JAUH"] as const),
        lastEducation: edu,
        lastGrade: GRADE(edu),
        previousSchool: `SD/SMP Negeri ${randInt(1, 20)} Depok`,
        achievements: chance(0.3) ? "Juara kelas / lomba tahfidz" : null,
        medicalHistory: chance(0.2) ? rand(["Asma ringan", "Alergi debu", "Riwayat maag"]) : null,
        birthOrder: randInt(1, 5),
        siblingsCount: randInt(0, 4),
        guardianId: guardian.id,
        assignedCaregiverId: caregiverIds[i % caregiverIds.length],
      },
    });
    childIds.push(child.id);
    if (["SD", "SMP", "SMA_SMK"].includes(edu)) schoolAgeChildIds.push(child.id);
  }

  // ---------- Log Harian 10 hari untuk setiap anak ----------
  console.log("📝 Membuat log harian 10 hari untuk 50 anak...");
  // Pilih 3 anak berisiko (mood rendah berturut-turut) & beberapa sakit hari ini
  const atRiskSet = new Set(childIds.slice(0, 3));
  const sickTodaySet = new Set(
    schoolAgeChildIds.slice(0, 4).length
      ? schoolAgeChildIds.slice(0, 4)
      : childIds.slice(0, 4)
  );

  const logRows: {
    childId: string;
    date: Date;
    moodScore: number;
    mealPercentage: number;
    breakfastDone: boolean;
    lunchDone: boolean;
    dinnerDone: boolean;
    sleepQuality: "GOOD" | "FAIR" | "POOR";
    prayerSubuh: boolean;
    prayerDzuhur: boolean;
    prayerAshar: boolean;
    prayerMaghrib: boolean;
    prayerIsya: boolean;
    piketDone: boolean;
    schoolAttendance: "HADIR" | "BOLOS" | "IZIN" | "SAKIT" | null;
    evaluationNotes: string | null;
    caregiverId: string;
  }[] = [];

  for (const childId of childIds) {
    const caregiverId = rand(caregiverIds);
    const isSchoolAge = schoolAgeChildIds.includes(childId);
    for (let d = 0; d < 10; d++) {
      const isRecent = d < 3;
      const lowMood = atRiskSet.has(childId) && isRecent;
      const moodScore = lowMood ? randInt(1, 2) : randInt(3, 5);
      const meals = [chance(0.9), chance(0.85), chance(0.8)];
      const mealPct = Math.round(
        (meals.filter(Boolean).length / 3) * 100
      );
      let attendance: "HADIR" | "BOLOS" | "IZIN" | "SAKIT" | null = null;
      if (isSchoolAge) {
        if (d === 0 && sickTodaySet.has(childId)) attendance = "SAKIT";
        else attendance = rand([
          "HADIR", "HADIR", "HADIR", "HADIR", "IZIN", "BOLOS", "SAKIT",
        ] as const);
      }
      logRows.push({
        childId,
        date: daysAgo(d),
        moodScore,
        mealPercentage: mealPct,
        breakfastDone: meals[0],
        lunchDone: meals[1],
        dinnerDone: meals[2],
        sleepQuality: rand(["GOOD", "GOOD", "FAIR", "POOR"] as const),
        prayerSubuh: chance(0.8),
        prayerDzuhur: chance(0.9),
        prayerAshar: chance(0.9),
        prayerMaghrib: chance(0.95),
        prayerIsya: chance(0.85),
        piketDone: chance(0.7),
        schoolAttendance: attendance,
        evaluationNotes: lowMood ? "Anak tampak murung & menyendiri, perlu perhatian." : null,
        caregiverId,
      });
    }
  }
  await prisma.dailyLog.createMany({ data: logRows });

  // ---------- 10 Relawan ----------
  console.log("🙌 Membuat 10 relawan...");
  for (let i = 0; i < 10; i++) {
    const isMale = chance(0.5);
    const skill = rand([...VOLUNTEER_FIELD_CODES]);
    await prisma.volunteer.create({
      data: {
        name: `${isMale ? rand(MALE_NAMES) : rand(FEMALE_NAMES)} ${rand(LAST_NAMES)}`,
        phone: `0857${randInt(1000000, 9999999)}`,
        skill: VOLUNTEER_FIELDS[skill],
        skillsJson: JSON.stringify([skill]),
        status: rand(["APPROVED", "APPROVED", "PENDING", "REJECTED", "SUSPENDED"] as const),
        hasSafeguardingCert: chance(0.6),
        email: `relawan${i + 1}@mail.com`,
        occupation: rand(["Mahasiswa", "Karyawan Swasta", "Wiraswasta", "Guru"]),
        availability: rand(["Akhir pekan", "Hari kerja sore", "Fleksibel"]),
        motivation: "Ingin berkontribusi untuk anak-anak panti.",
      },
    });
  }

  // ---------- 5 Mitra ----------
  console.log("🤝 Membuat 5 mitra...");
  const partners = [
    { name: "RS Hermina Depok", type: "RS", days: 20 },
    { name: "SMA Negeri 3 Depok", type: "SEKOLAH", days: 75 },
    { name: "Polsek Cilodong", type: "POLISI", days: 200 },
    { name: "PT Astra CSR", type: "CSR", days: 45 },
    { name: "RS Bhakti Yudha", type: "RS", days: 400 },
  ];
  for (const p of partners) {
    await prisma.partner.create({
      data: {
        name: p.name,
        type: p.type as "RS",
        picName: rand(MALE_NAMES) + " " + rand(LAST_NAMES),
        picPhone: `021${randInt(1000000, 9999999)}`,
        mouExpiryDate: daysAgo(-p.days),
      },
    });
  }

  // ---------- 30 Aset ----------
  console.log("🏛️ Membuat 30 aset...");
  const assetBase = [
    ["Motor Operasional", "KENDARAAN"], ["Mobil Ambulans Panti", "KENDARAAN"],
    ["Laptop Admin", "ELEKTRONIK"], ["Printer", "ELEKTRONIK"], ["AC Ruang Kelas", "ELEKTRONIK"],
    ["Lemari Arsip", "FURNITUR"], ["Meja Belajar", "FURNITUR"], ["Kasur Tingkat", "FURNITUR"],
    ["Gedung Asrama Putra", "BANGUNAN"], ["Gedung Asrama Putri", "BANGUNAN"],
  ];
  const assetRows = Array.from({ length: 30 }, (_, i) => {
    const [name, cat] = assetBase[i % assetBase.length];
    return {
      name: `${name} #${i + 1}`,
      category: cat as "KENDARAAN",
      acquisitionDate: daysAgo(randInt(30, 1800)),
      value: randInt(500, 150000) * 1000,
      location: rand(["Asrama Putra", "Asrama Putri", "Kantor", "Dapur", "Aula"]),
      condition: rand(["BAIK", "BAIK", "PERLU_PERBAIKAN", "RUSAK"] as const),
    };
  });
  await prisma.asset.createMany({ data: assetRows });

  // ---------- 100 Inventori ----------
  console.log("📦 Membuat 100 inventori...");
  const invBase = [
    ["Beras", "MAKANAN", "kg"], ["Minyak Goreng", "MAKANAN", "ltr"],
    ["Telur", "MAKANAN", "kg"], ["Gula", "MAKANAN", "kg"], ["Mie Instan", "MAKANAN", "box"],
    ["Buku Tulis", "ATK", "pcs"], ["Pulpen", "ATK", "pcs"], ["Kertas HVS", "ATK", "rim"],
    ["Paracetamol", "OBAT", "strip"], ["Vitamin C", "OBAT", "botol"], ["Minyak Kayu Putih", "OBAT", "botol"],
    ["Sabun Mandi", "PERLENGKAPAN", "pcs"], ["Pasta Gigi", "PERLENGKAPAN", "pcs"],
    ["Selimut", "PERLENGKAPAN", "pcs"], ["Sajadah", "LAINNYA", "pcs"],
  ];
  const invRows = Array.from({ length: 100 }, (_, i) => {
    const [name, cat, unit] = invBase[i % invBase.length];
    const qty = randInt(0, 200);
    const min = randInt(10, 40);
    return {
      itemName: `${name} (Batch ${Math.floor(i / invBase.length) + 1})`,
      category: cat as "MAKANAN",
      quantity: qty,
      unit,
      minStock: min,
    };
  });
  await prisma.inventory.createMany({ data: invRows });

  // ---------- 10 Kasus Anak ----------
  console.log("📁 Membuat 10 kasus anak...");
  for (let i = 0; i < 10; i++) {
    await prisma.case.create({
      data: {
        childId: rand(childIds),
        caseType: rand([
          "PROTECTION", "HEALTH", "EDUCATION", "PSYCHOSOCIAL", "LEGAL", "FAMILY_REUNIFICATION",
        ] as const),
        description: rand([
          "Anak menunjukkan penurunan prestasi akademik.",
          "Perlu pendampingan psikologis pasca kehilangan orang tua.",
          "Proses pengurusan akta kelahiran.",
          "Rujukan pemeriksaan kesehatan lanjutan.",
          "Mediasi reunifikasi dengan keluarga.",
        ]),
        handling: chance(0.5) ? "Sedang dalam pendampingan pekerja sosial." : null,
        priority: rand(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const),
        status: rand(["OPEN", "IN_PROGRESS", "CLOSED"] as const),
        assignedToId: adminId,
      },
    });
  }

  // ---------- 10 Insiden ----------
  console.log("🚨 Membuat 10 insiden...");
  for (let i = 0; i < 10; i++) {
    await prisma.incident.create({
      data: {
        childId: rand(childIds),
        incidentType: rand(["HEALTH", "BEHAVIOR", "ACCIDENT", "OTHER"] as const),
        description: rand([
          "Anak demam tinggi malam hari.",
          "Terjatuh saat bermain di halaman.",
          "Berkelahi dengan teman sekamar.",
          "Terlambat pulang dari sekolah tanpa kabar.",
        ]),
        handling: chance(0.6) ? "Sudah ditangani pengasuh & diberi P3K." : null,
        urgency: rand(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const),
        status: rand(["OPEN", "IN_PROGRESS", "RESOLVED"] as const),
        reportedById: rand(caregiverIds),
      },
    });
  }

  // ---------- 20 Kunjungan Keluarga + 10 Kunjungan Rumah ----------
  console.log("👨‍👩‍👧 Membuat 20 kunjungan keluarga & 10 kunjungan rumah...");
  for (let i = 0; i < 20; i++) {
    const childId = rand(childIds);
    await prisma.familyVisit.create({
      data: {
        childId,
        visitorName: rand(["Ibu", "Bapak", "Nenek", "Paman", "Bibi"]) + " " + rand(LAST_NAMES),
        relationship: rand(["Ibu kandung", "Ayah kandung", "Nenek", "Paman", "Bibi", "Kakak"]),
        visitDate: daysAgo(randInt(0, 25)),
        purpose: rand([
          "Menjenguk dan membawa makanan.",
          "Mengantar perlengkapan sekolah.",
          "Silaturahmi akhir pekan.",
          "Membicarakan rencana liburan anak.",
        ]),
        createdById: rand(caregiverIds),
      },
    });
  }
  for (let i = 0; i < 10; i++) {
    const childId = rand(childIds);
    const done = chance(0.6);
    await prisma.homeVisit.create({
      data: {
        childId,
        scheduledDate: daysAgo(randInt(-10, 40)),
        purpose: "Asesmen kelayakan rumah untuk rencana reunifikasi.",
        status: done ? "DONE" : "PLANNED",
        officerId: rand(staffUserIds),
        createdById: adminId,
        ...(done && {
          sanitationOk: chance(0.7),
          safetyOk: chance(0.7),
          cleanWaterOk: chance(0.8),
          childSpaceOk: chance(0.6),
          foodSecurityOk: chance(0.6),
          vulnerabilityScore: randInt(1, 10),
          visitNotes: "Kondisi rumah cukup layak, perlu perbaikan minor.",
          completedAt: daysAgo(randInt(0, 10)),
        }),
      },
    });
  }

  // ---------- 10 Kepulangan Anak (data detail) ----------
  console.log("🚪 Membuat 10 kepulangan anak...");
  for (let i = 0; i < 10; i++) {
    const leaveDate = daysAgo(randInt(5, 30));
    const planned = new Date(leaveDate);
    planned.setDate(planned.getDate() + randInt(2, 7));
    const returned = chance(0.7);
    const actual = returned ? new Date(planned) : null;
    if (actual) actual.setDate(actual.getDate() + randInt(-2, 3));
    let status: "BELUM_KEMBALI" | "TEPAT_WAKTU" | "LEBIH_CEPAT" | "TERLAMBAT" =
      "BELUM_KEMBALI";
    if (actual) {
      status =
        actual < planned ? "LEBIH_CEPAT" : actual > planned ? "TERLAMBAT" : "TEPAT_WAKTU";
    }
    await prisma.homeLeave.create({
      data: {
        childId: rand(childIds),
        leaveDate,
        plannedReturnDate: planned,
        actualReturnDate: actual,
        returnStatus: status,
        reason: rand([
          "LIBURAN_SEKOLAH", "LIBURAN_HARI_RAYA", "ORANG_TUA_SAKIT", "SAKIT",
        ] as const),
        description: "Dijemput oleh wali.",
        createdById: rand(caregiverIds),
      },
    });
  }

  // ---------- 20 Donasi (buku besar donasi lama) ----------
  console.log("💝 Membuat 20 donasi...");
  const year = new Date().getFullYear();
  for (let i = 0; i < 20; i++) {
    await prisma.donation.create({
      data: {
        donaturName: chance(0.3) ? "Hamba Allah" : `${rand(MALE_NAMES)} ${rand(LAST_NAMES)}`,
        donorType: rand(["PERORANGAN", "PERORANGAN", "PERUSAHAAN"] as const),
        donaturContact: `08${randInt(1000000000, 9999999999)}`,
        amount: randInt(100, 5000) * 1000,
        type: rand(["CASH", "TRANSFER", "TRANSFER"] as const),
        category: rand([
          "INFAQ_SEDEKAH", "ZAKAT_MAAL", "WAKAF_TUNAI", "QURBAN",
        ] as const),
        purpose: rand(["Operasional panti", "Pendidikan anak", "Kesehatan", "Umum"]),
        receiptNumber: `KW/${year}/${String(i + 1).padStart(4, "0")}`,
        createdAt: daysAgo(randInt(0, 300)),
      },
    });
  }

  // ---------- Donatur, Program, Keuangan masuk/keluar (50) ----------
  console.log("💰 Membuat donatur, program & 50 transaksi keuangan...");
  // Donatur (beberapa aktif bulan ini, beberapa pasif)
  const donorIds: string[] = [];
  const donorNames = [
    "H. Abdullah Salim", "PT Berkah Jaya", "Hj. Aminah", "Yayasan Peduli Kasih",
    "Bpk. Sutrisno", "Ibu Kartini", "CV Maju Bersama", "Ust. Hamdan",
  ];
  for (let i = 0; i < donorNames.length; i++) {
    const isCorp = donorNames[i].match(/PT|CV|Yayasan/);
    const d = await prisma.donor.create({
      data: {
        name: donorNames[i],
        category: isCorp ? "KORPORAT" : "PERORANGAN",
        phone: `0811${randInt(1000000, 9999999)}`,
        email: `donatur${i + 1}@mail.com`,
        address: "Depok, Jawa Barat",
        donorSince: daysAgo(randInt(200, 1000)),
        occupation: isCorp ? null : rand(["Wiraswasta", "PNS", "Dokter", "Pensiunan"]),
        monthlyIncome: isCorp ? null : randInt(5000, 30000) * 1000,
        lastEducation: "PERGURUAN_TINGGI",
      },
    });
    donorIds.push(d.id);
  }

  // Program
  const programsData = [
    { name: "Beasiswa Anak Berprestasi 2026", field: "PENDIDIKAN", target: 50_000_000 },
    { name: "Renovasi Asrama Putri", field: "INFRASTRUKTUR", target: 120_000_000 },
    { name: "Kesehatan & Gizi Anak", field: "KESEHATAN", target: 30_000_000 },
    { name: "Qurban Berbagi 1447H", field: "KEAGAMAAN", target: 40_000_000 },
  ];
  const programIds: string[] = [];
  for (let i = 0; i < programsData.length; i++) {
    const p = programsData[i];
    const prog = await prisma.program.create({
      data: {
        code: `PRG/${year}/${String(i + 1).padStart(3, "0")}`,
        name: p.name,
        field: p.field as "PENDIDIKAN",
        fundraisingTarget: p.target,
        maxBudget: p.target,
        startDate: daysAgo(randInt(30, 180)),
        status: rand(["AKTIF", "AKTIF", "PENYALURAN"] as const),
        leftoverRule: "KE_OPERASIONAL",
        picId: adminId,
        description: `Program ${p.name} untuk kesejahteraan anak asuh.`,
      },
    });
    programIds.push(prog.id);
  }

  const accounts = await prisma.cashAccount.findMany({ where: { isActive: true } });
  const accountIds = accounts.map((a) => a.id);
  if (accountIds.length === 0) {
    for (const name of ["Cash Kecil / Petty Cash", "Bank Mandiri Operasional", "Bank BCA Khusus Zakat"]) {
      const a = await prisma.cashAccount.create({ data: { name, openingBalance: 5_000_000 } });
      accountIds.push(a.id);
    }
  }

  // 25 Kas Masuk (mayoritas verified & tidak terikat agar runway sehat)
  const fundCats = [
    "ZAKAT_MAAL", "ZAKAT_FITRAH", "INFAQ_SEDEKAH", "WAKAF_TUNAI", "QURBAN",
    "HIBAH_TERIKAT", "PENDAPATAN_USAHA",
  ];
  let kmSeq = 0;
  for (let i = 0; i < 25; i++) {
    const restricted = i % 3 === 0; // ~1/3 terikat ke program
    const method = chance(0.5) ? "TRANSFER_BANK" : "TUNAI";
    // tunai selalu verified; transfer mayoritas verified, sedikit pending
    const verification =
      method === "TUNAI" ? "VERIFIED" : chance(0.8) ? "VERIFIED" : "PENDING";
    const month = randInt(0, new Date().getMonth());
    kmSeq++;
    await prisma.financeIncome.create({
      data: {
        refNumber: `KM/YYS/${year}/${String(month + 1).padStart(2, "0")}/${String(kmSeq).padStart(3, "0")}`,
        date: dateInYear(month, randInt(1, 28)),
        contactCategory: chance(0.5) ? "PERORANGAN" : "KORPORAT",
        donorId: chance(0.7) ? rand(donorIds) : null,
        sourceName: chance(0.3) ? "Hamba Allah" : rand(donorNames),
        restriction: restricted ? "TERIKAT_TEMPORER" : "TIDAK_TERIKAT",
        fundCategory: restricted ? "HIBAH_TERIKAT" : (rand(fundCats) as "ZAKAT_MAAL"),
        programId: restricted ? rand(programIds) : null,
        method: method as "TUNAI",
        amount: randInt(500, 15000) * 1000,
        verification: verification as "VERIFIED",
        accountId: rand(accountIds),
        memo: chance(0.3) ? "Donasi rutin bulanan." : null,
        createdById: adminId,
      },
    });
  }

  // 25 Kas Keluar (mayoritas operasional; beberapa APPROVAL >1jt utk antrean)
  const coas = [
    "BEBAN_PROGRAM", "BEBAN_GAJI", "BEBAN_RUMAH_TANGGA", "BEBAN_KANTOR", "BEBAN_FUNDRAISING",
  ];
  let pvSeq = 0;
  for (let i = 0; i < 25; i++) {
    const restricted = i % 4 === 0;
    const month = randInt(0, new Date().getMonth());
    pvSeq++;
    // 4 voucher menunggu approval Ketua (>1jt), sisanya mayoritas SELESAI
    const pendingApproval = i < 4;
    const approval = pendingApproval
      ? "APPROVAL"
      : rand(["SELESAI", "SELESAI", "SELESAI", "REVIEW", "DRAFT"] as const);
    const amount = pendingApproval
      ? randInt(1500, 8000) * 1000
      : randInt(200, 3000) * 1000;
    await prisma.financeExpense.create({
      data: {
        voucherNumber: `PV/YYS/${year}/${String(month + 1).padStart(2, "0")}/${String(pvSeq).padStart(3, "0")}`,
        date: dateInYear(month, randInt(1, 28)),
        accountId: rand(accountIds),
        pocket: restricted ? "TERIKAT" : "TIDAK_TERIKAT",
        programId: restricted ? rand(programIds) : null,
        coa: restricted ? "BEBAN_PROGRAM" : (rand(coas) as "BEBAN_GAJI"),
        beneficiaryChildId: chance(0.4) ? rand(childIds) : null,
        beneficiaryName: chance(0.3) ? rand(["Toko Bangunan Jaya", "SPP Sekolah", "PLN", "PDAM"]) : null,
        amount,
        approval: approval as "SELESAI",
        createdById: adminId,
      },
    });
  }

  // ---------- Backfill Buku Besar (Transaction) ----------
  // Samakan dengan perilaku aplikasi: pemasukan VERIFIED -> DEBIT,
  // pengeluaran SELESAI (dana cair) -> CREDIT. Agar Detail Transaksi konsisten.
  console.log("📒 Backfill buku besar transaksi...");
  const catCache = new Map<string, string>();
  const catId = async (name: string) => {
    if (catCache.has(name)) return catCache.get(name)!;
    const c = await prisma.financeCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    catCache.set(name, c.id);
    return c.id;
  };
  const COA_LABEL: Record<string, string> = {
    BEBAN_PROGRAM: "Beban Program & Penyaluran",
    BEBAN_GAJI: "Beban Gaji & Personalia",
    BEBAN_RUMAH_TANGGA: "Beban Rumah Tangga Panti",
    BEBAN_KANTOR: "Beban Kantor & Administrasi",
    BEBAN_FUNDRAISING: "Beban Pemasaran & Fundraising",
  };
  const verifiedIncomes = await prisma.financeIncome.findMany({
    where: { verification: "VERIFIED" },
  });
  for (const inc of verifiedIncomes) {
    const name =
      inc.fundCategory === "PENDAPATAN_USAHA"
        ? "Pendapatan Usaha"
        : "Donasi & Dana Sosial";
    await prisma.transaction.create({
      data: {
        date: inc.date,
        description: `${inc.refNumber} — ${inc.sourceName}`,
        categoryId: await catId(name),
        type: "DEBIT",
        amount: inc.amount,
        createdById: inc.createdById,
      },
    });
  }
  const selesaiExpenses = await prisma.financeExpense.findMany({
    where: { approval: "SELESAI" },
    include: { program: { select: { name: true } } },
  });
  for (const exp of selesaiExpenses) {
    await prisma.transaction.create({
      data: {
        date: exp.date,
        description: `${exp.voucherNumber}${exp.program ? ` — ${exp.program.name}` : ""}`,
        categoryId: await catId(COA_LABEL[exp.coa]),
        type: "CREDIT",
        amount: exp.amount,
        createdById: exp.createdById,
      },
    });
  }

  // ---------- Ringkasan ----------
  const counts = {
    anak: await prisma.child.count(),
    wali: await prisma.guardian.count(),
    logHarian: await prisma.dailyLog.count(),
    pegawai: await prisma.employee.count(),
    relawan: await prisma.volunteer.count(),
    mitra: await prisma.partner.count(),
    aset: await prisma.asset.count(),
    inventori: await prisma.inventory.count(),
    kasus: await prisma.case.count(),
    insiden: await prisma.incident.count(),
    kunjunganKeluarga: await prisma.familyVisit.count(),
    kunjunganRumah: await prisma.homeVisit.count(),
    kepulangan: await prisma.homeLeave.count(),
    donasi: await prisma.donation.count(),
    donatur: await prisma.donor.count(),
    program: await prisma.program.count(),
    kasMasuk: await prisma.financeIncome.count(),
    kasKeluar: await prisma.financeExpense.count(),
  };
  console.log("✅ Selesai! Ringkasan data:");
  console.table(counts);
}

main()
  .catch((e) => {
    console.error("❌ Seed gagal:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
