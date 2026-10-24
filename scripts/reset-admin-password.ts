import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';

// Usage: DATABASE_URL=... TURSO_AUTH_TOKEN=... ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/reset-admin-password.ts
const { DATABASE_URL, TURSO_AUTH_TOKEN, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

async function main() {
  if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('DATABASE_URL, ADMIN_EMAIL, dan ADMIN_PASSWORD wajib diisi');
  }

  const db = createClient({ url: DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
  try {
    const { rows } = await db.execute({
      sql: 'SELECT password FROM User WHERE email = ?',
      args: [ADMIN_EMAIL],
    });
    if (rows.length === 0) throw new Error(`User ${ADMIN_EMAIL} tidak ditemukan`);

    const matches = await bcrypt.compare(ADMIN_PASSWORD, String(rows[0].password));
    console.log(`Password saat ini cocok: ${matches}`);

    if (!matches) {
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await db.execute({ sql: 'UPDATE User SET password = ? WHERE email = ?', args: [hash, ADMIN_EMAIL] });
      const check = await db.execute({ sql: 'SELECT password FROM User WHERE email = ?', args: [ADMIN_EMAIL] });
      console.log(`Password diperbarui, verifikasi: ${await bcrypt.compare(ADMIN_PASSWORD, String(check.rows[0].password))}`);
    }
  } finally {
    db.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
