import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting production seed...");

  // Create Super Admin user
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_EMAIL dan ADMIN_PASSWORD wajib diisi");
  }
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (existing) {
    console.log("ℹ️  Super admin already exists");
  } else {
    const password = await bcrypt.hash(adminPassword, 10);

    await prisma.user.create({
      data: {
        name: adminEmail.split("@")[0],
        email: adminEmail,
        password,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      },
    });

    console.log(`✅ Super admin created: ${adminEmail}`);
  }

  // Create default finance categories
  const defaultCategories: { name: string; monthlyBudget: number }[] = [
    { name: "Donasi", monthlyBudget: 0 },
    { name: "Makanan", monthlyBudget: 0 },
    { name: "Pendidikan", monthlyBudget: 0 },
    { name: "Kesehatan", monthlyBudget: 0 },
    { name: "Operasional", monthlyBudget: 0 },
  ];

  for (const category of defaultCategories) {
    await prisma.financeCategory.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    });
  }
  console.log("✅ Default finance categories created");

  console.log("\n🎉 Production seed completed successfully!");
  console.log("\n📝 Next steps:");
  console.log("   1. Login with super admin credentials");
  console.log("   2. Configure system settings in Admin Panel");
  console.log("   3. Add employees, children, and other data");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
