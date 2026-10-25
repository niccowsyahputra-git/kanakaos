import { createClient } from "@libsql/client";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import bcrypt from "bcryptjs";
import { EMPLOYEE_DEPARTMENTS, EMPLOYEE_POSITIONS } from "../lib/option-catalogs";

// Creates a fresh disposable fixture only; never loads production environment files.
async function main() {
  const target = process.argv[2];
  if (!target || !/^module-smoke-[a-z0-9-]+\.db$/.test(target)) throw new Error("Supply a new module-smoke-<name>.db filename");
  const filename = path.resolve(".npm-cache", target);
  if (existsSync(filename)) throw new Error("Refusing to modify an existing database");
  mkdirSync(path.dirname(filename), { recursive: true });
  const url = `file:${filename}`;
  const sql = execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { encoding: "utf8", env: { ...process.env, DATABASE_URL: url, TURSO_AUTH_TOKEN: "" } });
  const client = createClient({ url });
  try { await client.executeMultiple(sql); } finally { client.close(); }
  const db = new PrismaClient({ adapter: new PrismaLibSQL({ url }) });
  const password = `Local-${randomUUID()}`;
  try {
    const hash = await bcrypt.hash(password, 10);
    const admin = await db.user.create({ data: { name: "Smoke Test Admin", email: "smoke-admin@example.test", password: hash, role: "SUPER_ADMIN" } });
    const worker = await db.user.create({ data: { name: "Smoke Test Staff", email: "smoke-staff@example.test", password: hash, role: "SOCIAL_WORKER" } });
    const location = await db.employeeLocation.create({ data: { name: "Smoke Test Office", normalizedName: "smoke test office" } });
    await db.employee.create({ data: { firstName: "Smoke", lastName: "Employee", employeeCode: "SMOKE-EMP", gender: "MALE", department: EMPLOYEE_DEPARTMENTS[0], position: EMPLOYEE_POSITIONS[0], entityLocationId: location.id, userId: worker.id, basicSalary: 1000, fullAddress: "Isolated test address", employmentStatus: "KONTRAK" } });
    const need = await db.volunteerNeed.create({ data: { title: "Legal", field: "LEGAL", quantity: 2, startDate: new Date("2027-01-01T00:00:00Z"), endDate: new Date("2027-01-31T00:00:00Z") } });
    await db.volunteer.create({ data: { name: "Smoke Legacy Volunteer", email: "smoke-volunteer@example.test", skill: "Legacy example skill", skillsJson: '["LEGAL","IT"]', highestEducation: "S1", major: "Test Major", needId: need.id } });
    const item = await db.inventory.create({ data: { itemName: "Smoke Test Rice", category: "MAKANAN", quantity: 17, minStock: 5, unit: "kg" } });
    await db.stockAdjustment.create({ data: { inventoryId: item.id, delta: 17, reason: "Fixture stock", createdById: admin.id } });
    await db.purchaseRequest.create({ data: { inventoryId: item.id, quantity: 2, requestedById: admin.id } });
    await db.asset.create({ data: { name: "Smoke Legacy Asset", category: "LAINNYA", acquisitionDate: new Date("2020-01-01T00:00:00Z"), value: 100, location: "Unmapped legacy location" } });
    const account = await db.cashAccount.create({ data: { name: "Smoke Test Cash" } });
    const receipt = { date: new Date(), sourceName: "Smoke receipt", fundCategory: "INFAQ_SEDEKAH" as const, verification: "VERIFIED" as const, amount: 1000000, createdById: admin.id, accountId: account.id };
    await db.financeIncome.create({ data: { ...receipt, refNumber: "SMOKE-GENERAL" } });
    const program = await db.program.create({ data: { id: "cm000000000000000000000001", code: "SMOKE-MIXED", name: "Smoke Mixed Program", field: "PENDIDIKAN", status: "AKTIF", sumberDana: "CAMPURAN", porsiPenggalangan: 40, fundraisingTarget: 400000, maxBudget: 1000000, picId: admin.id, internalAllocations: { create: { amount: 600000, createdById: admin.id } } } });
    await db.program.create({ data: { code: "SMOKE-INTERNAL", name: "Smoke Internal Program", field: "PENDIDIKAN", status: "AKTIF", sumberDana: "INTERNAL", picId: admin.id } });
    await db.financeIncome.create({ data: { ...receipt, amount: 400000, refNumber: "SMOKE-PROGRAM", programId: program.id, restriction: "TERIKAT_TEMPORER" } });
    for (const source of ["PENGGALANGAN", "INTERNAL"] as const) await db.financeExpense.create({ data: { voucherNumber: `SMOKE-${source}`, date: new Date(), accountId: account.id, pocket: "TERIKAT", programId: program.id, sumberDana: source, coa: "BEBAN_KANTOR", amount: 100000, createdById: admin.id } });
    writeFileSync(path.resolve(".npm-cache/module-smoke-photo.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=", "base64"));
    console.log(JSON.stringify({ databaseUrl: url, admin: "smoke-admin@example.test", staff: "smoke-staff@example.test", password, photo: path.resolve(".npm-cache/module-smoke-photo.png") }));
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
