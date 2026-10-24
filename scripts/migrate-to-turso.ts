import { createClient } from '@libsql/client';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';

// Usage: DATABASE_URL=... TURSO_AUTH_TOKEN=... ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/migrate-to-turso.ts
const TURSO_URL = process.env.DATABASE_URL as string;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL as string;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD as string;

async function migrateToTurso() {
  if (!TURSO_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('DATABASE_URL, ADMIN_EMAIL, dan ADMIN_PASSWORD wajib diisi');
  }
  console.log('🚀 Starting migration to Turso...');

  // Create libSQL client for schema check
  const libsql = createClient({
    url: TURSO_URL,
    authToken: TURSO_TOKEN,
  });

  // Create Prisma client with libSQL adapter
  const adapter = new PrismaLibSQL({
    url: TURSO_URL,
    authToken: TURSO_TOKEN,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    // Push schema
    console.log('📦 Pushing schema to Turso...');
    // Note: Prisma doesn't have a direct db push API, so we'll use raw SQL
    // For now, we'll just seed the data assuming schema is already there
    
    // Check if schema exists
    const tables = await libsql.execute({
      sql: "SELECT name FROM sqlite_master WHERE type='table'",
      args: []
    });
    
    console.log('Tables in Turso:', tables.rows.map(r => r[0]));
    
    if (tables.rows.length === 0) {
      console.log('❌ Schema not found in Turso. Please run schema migration first.');
      console.log('💡 Tip: Use Prisma Migrate or manually create tables.');
      return;
    }

    // Seed super admin
    console.log('👤 Creating super admin...');
    const bcrypt = await import('bcryptjs');
    const password = await bcrypt.default.hash(ADMIN_PASSWORD, 10);

    const user = await prisma.user.create({
      data: {
        name: ADMIN_EMAIL.split('@')[0],
        email: ADMIN_EMAIL,
        password,
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });
    console.log('✅ Super admin created:', user.email);

    // Seed finance categories
    console.log('💰 Creating finance categories...');
    const categories = ['Donasi', 'Makanan', 'Pendidikan', 'Kesehatan', 'Operasional'];
    for (const name of categories) {
      await prisma.financeCategory.create({
        data: { name, monthlyBudget: 0 },
      });
    }
    console.log('✅ Finance categories created');

    console.log('\n🎉 Migration to Turso completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await libsql.close();
  }
}

migrateToTurso().catch((e) => {
  console.error(e);
  process.exit(1);
});
