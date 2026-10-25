import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@kanakaos.id";
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log("User admin sudah ada");
  } else {
    const password = await bcrypt.hash("kanakaos123", 10);

    await prisma.user.create({
      data: {
        name: "Super Admin",
        email,
        password,
        role: UserRole.SUPER_ADMIN,
      },
    });

    console.log("User admin berhasil dibuat:");
    console.log("Email:", email);
    console.log("Password: kanakaos123");
  }

  // Sample wali untuk dropdown form anak
  const guardianCount = await prisma.guardian.count();
  if (guardianCount === 0) {
    await prisma.guardian.createMany({
      data: [
        {
          name: "Siti Aminah",
          phone: "081234567890",
          relationship: "Nenek",
          vulnerabilityScore: 3,
        },
        {
          name: "Budi Santoso",
          phone: "081298765432",
          relationship: "Paman",
          vulnerabilityScore: 2,
        },
      ],
    });
    console.log("2 sample wali berhasil dibuat");
  }

  // User caregiver untuk menguji proteksi role
  const caregiverEmail = "caregiver@kanakaos.id";
  const caregiverExisting = await prisma.user.findUnique({
    where: { email: caregiverEmail },
  });
  if (!caregiverExisting) {
    await prisma.user.create({
      data: {
        name: "Ibu Pengasuh",
        email: caregiverEmail,
        password: await bcrypt.hash("caregiver123", 10),
        role: UserRole.CAREGIVER,
      },
    });
    console.log("User caregiver dibuat (caregiver@kanakaos.id / caregiver123)");
  }

  // Sample relawan & mitra
  const volunteerCount = await prisma.volunteer.count();
  if (volunteerCount === 0) {
    await prisma.volunteer.createMany({
      data: [
        {
          name: "Made Wirawan",
          phone: "081311112222",
          skill: "Mengajar Bahasa Inggris",
          skillsJson: JSON.stringify(["FORMAL_EDUCATION"]),
          hasSafeguardingCert: true,
          status: "APPROVED",
        },
        {
          name: "Rina Kusuma",
          phone: "081333334444",
          skill: "Psikolog anak",
          skillsJson: JSON.stringify(["MENTAL_HEALTH"]),
          hasSafeguardingCert: false,
          status: "PENDING",
        },
      ],
    });
    console.log("2 sample relawan berhasil dibuat");
  }

  const partnerCount = await prisma.partner.count();
  if (partnerCount === 0) {
    const in10Days = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const in6Months = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
    await prisma.partner.createMany({
      data: [
        {
          name: "RSUD Wangaya",
          type: "RS",
          picName: "dr. Putu Eka",
          picPhone: "081355556666",
          mouExpiryDate: in10Days, // memicu badge "MoU Segera Habis"
        },
        {
          name: "SDN 5 Denpasar",
          type: "SEKOLAH",
          picName: "I Wayan Sudira",
          picPhone: "081377778888",
          mouExpiryDate: in6Months,
        },
      ],
    });
    console.log("2 sample mitra berhasil dibuat");
  }

  // Penugasan awal: anak tanpa pengasuh ditugaskan ke akun caregiver pertama
  const firstCaregiver = await prisma.user.findFirst({
    where: { role: UserRole.CAREGIVER, isActive: true },
  });
  if (firstCaregiver) {
    const assigned = await prisma.child.updateMany({
      where: { assignedCaregiverId: null, status: "ACTIVE" },
      data: { assignedCaregiverId: firstCaregiver.id },
    });
    if (assigned.count > 0) {
      console.log(`${assigned.count} anak ditugaskan ke ${firstCaregiver.name}`);
    }
  }

  // User bendahara untuk modul keuangan
  const financeEmail = "finance@kanakaos.id";
  if (!(await prisma.user.findUnique({ where: { email: financeEmail } }))) {
    await prisma.user.create({
      data: {
        name: "Bendahara Yayasan",
        email: financeEmail,
        password: await bcrypt.hash("finance123", 10),
        role: UserRole.FINANCE,
      },
    });
    console.log("User bendahara dibuat (finance@kanakaos.id / finance123)");
  }

  // Kategori keuangan default
  const defaultCategories: { name: string; monthlyBudget: number }[] = [
    { name: "Donasi", monthlyBudget: 0 },
    { name: "Makanan", monthlyBudget: 5000000 },
    { name: "Pendidikan", monthlyBudget: 3000000 },
    { name: "Kesehatan", monthlyBudget: 2000000 },
    { name: "Operasional", monthlyBudget: 4000000 },
  ];
  for (const category of defaultCategories) {
    await prisma.financeCategory.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    });
  }
  console.log("Kategori keuangan default siap");

  // User logistik
  const logisticsEmail = "logistik@kanakaos.id";
  if (!(await prisma.user.findUnique({ where: { email: logisticsEmail } }))) {
    await prisma.user.create({
      data: {
        name: "Staf Logistik",
        email: logisticsEmail,
        password: await bcrypt.hash("logistik123", 10),
        role: UserRole.LOGISTICS,
      },
    });
    console.log("User logistik dibuat (logistik@kanakaos.id / logistik123)");
  }

  // Sample inventory (1 item sengaja stok menipis untuk menguji badge)
  if ((await prisma.inventory.count()) === 0) {
    await prisma.inventory.createMany({
      data: [
        { itemName: "Beras", category: "MAKANAN", quantity: 50, unit: "kg", minStock: 20 },
        { itemName: "Minyak Goreng", category: "MAKANAN", quantity: 4, unit: "liter", minStock: 10 },
        { itemName: "Buku Tulis", category: "ATK", quantity: 100, unit: "pcs", minStock: 30 },
        { itemName: "Paracetamol Sirup", category: "OBAT", quantity: 3, unit: "botol", minStock: 5 },
        { itemName: "Sabun Mandi", category: "PERLENGKAPAN", quantity: 24, unit: "pcs", minStock: 12 },
      ],
    });
    console.log("5 sample barang inventory dibuat");
  }

  // Sample aset
  if ((await prisma.asset.count()) === 0) {
    await prisma.asset.createMany({
      data: [
        {
          name: "Mobil Operasional Avanza",
          category: "KENDARAAN",
          acquisitionDate: new Date("2020-05-10"),
          value: 150000000,
          location: "Garasi",
          condition: "BAIK",
        },
        {
          name: "Kulkas 2 Pintu",
          category: "ELEKTRONIK",
          acquisitionDate: new Date("2022-01-15"),
          value: 4500000,
          location: "Dapur",
          condition: "PERLU_PERBAIKAN",
        },
      ],
    });
    console.log("2 sample aset dibuat");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
