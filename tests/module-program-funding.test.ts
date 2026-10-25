import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { migrateProgramFunding, requireLocalFundingDatabase } from "../scripts/migrate-program-funding";
import { backfillProgramFunding } from "../scripts/backfill-program-funding";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getSchemas } from "../lib/validations";
import { createTranslator, localizeLabels } from "../lib/i18n/translate";
import { programFundingSourceOptions, expenseFundingSourceLabel } from "../components/finance/finance-labels";
import { ProgramFundingComposition, ProgramExpenseTable } from "../components/finance/program-funding-detail";
import type { DriveMetadata, DriveStorage } from "../lib/google-drive.server";
import { MANAGED_FORM_KEY } from "../lib/storage-contract";

let formLocale: "id" | "en" = "en";
let formAuthorized = true;
let databaseAccesses = 0;
let testDatabase: PrismaClient | undefined;
let formUserId = "user";
let formRole = "FINANCE";
const requestDatabase = new AsyncLocalStorage<PrismaClient>();
let uploadHook: (() => Promise<void>) | undefined;
function stub(name: string, exports: object) {
  const id = require.resolve(name);
  require.cache[id] = { id, filename: id, loaded: true, exports } as NodeModule;
}
stub("../lib/prisma", { prisma: new Proxy({}, { get(_target, key) {
  databaseAccesses++;
  const db = requestDatabase.getStore() ?? testDatabase;
  if (!db) throw new Error("Invalid submissions must not access storage");
  const value = Reflect.get(db, key);
  return typeof value === "function" ? value.bind(db) : value;
} }) });
const session = () => formAuthorized ? { user: { id: formUserId, name: "Funding Staff", role: formRole } } : null;
stub("../lib/auth-guard", { requireFinanceSession: async () => session(), requireSuperAdminSession: async () => formRole === "SUPER_ADMIN" ? session() : null });
stub("next/cache", { revalidatePath() {} });
stub("server-only", {});
const storage = require("../lib/managed-storage.server") as typeof import("../lib/managed-storage.server");
const signingSecret = "isolated-funding-storage-signing-secret";
const previousSigningSecret = process.env.STORAGE_SIGNING_SECRET;
process.env.STORAGE_SIGNING_SECRET = signingSecret;
after(() => {
  if (previousSigningSecret === undefined) delete process.env.STORAGE_SIGNING_SECRET;
  else process.env.STORAGE_SIGNING_SECRET = previousSigningSecret;
});
const driveMetadata = new Map<string, DriveMetadata>();
const proofBytes = Buffer.from("%PDF-1.4\nNon-sensitive fixture\n%%EOF");
const drive: DriveStorage = {
  folderId: "fixture-funding-folder", generateId: async () => `fixture-${randomUUID()}`,
  health: async () => {}, upload: async () => {}, trash: async () => {},
  download: async () => new Response(proofBytes), prefix: async () => proofBytes,
  metadata: async id => driveMetadata.get(id) ?? null,
  start: async file => {
    driveMetadata.set(file.id, { id: file.id, mimeType: file.mime, size: String(file.bytes), parents: [drive.folderId], ownedByMe: true, trashed: false,
      appProperties: { application: "kanakaos", managedId: file.managedId, purpose: file.purpose }, permissions: [{ type: "user", role: "owner" }] });
    return "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=fixture";
  },
};
stub("../lib/i18n/server", { getT: async () => ({ locale: formLocale, tr: createTranslator(formLocale) }) });
stub("../lib/i18n/client", { useI18n: () => ({ locale: formLocale, tr: createTranslator(formLocale) }) });
stub("next/navigation", {
  useRouter: () => ({ refresh() {} }),
  redirect: (url: string) => { throw new Error(`redirect:${url}`); },
  notFound: () => { throw new Error("not-found"); },
});
// Open the dialog frame for SSR inspection; funding controls and React hooks remain real.
const frame = ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children);
stub("../components/ui/dialog", Object.fromEntries([
  "Dialog", "DialogContent", "DialogDescription", "DialogFooter", "DialogHeader", "DialogTitle", "DialogTrigger",
].map(name => [name, frame])));
const programActions = require("../lib/actions/program") as typeof import("../lib/actions/program");
const incomeActions = require("../lib/actions/financeIncome") as typeof import("../lib/actions/financeIncome");
const expenseActions = require("../lib/actions/financeExpense") as typeof import("../lib/actions/financeExpense");
const balances = require("../lib/finance-balance") as typeof import("../lib/finance-balance");
const dashboard = require("../lib/dashboard-data") as typeof import("../lib/dashboard-data");
const expenseTools = require("../components/finance/expense-form") as typeof import("../components/finance/expense-form");
const programTools = require("../components/finance/program-tools") as typeof import("../components/finance/program-tools");

const directory = path.resolve(".npm-cache", `program-funding-${randomUUID()}`);
let legacySql: string;
let currentSql: string;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;

before(() => {
  mkdirSync(directory, { recursive: true });
  const current = readFileSync("prisma/schema.prisma", "utf8");
  // Reconstruct the immediately preceding schema, including other uncommitted work.
  const legacy = current
    .replace(/^enum ProgramFundingSource \{[^}]*\}\n/m, "")
    .replace(/^enum ProgramExpenseSource \{[^}]*\}\n/m, "")
    .replace(/^model ProgramInternalAllocation \{[^}]*\}\n/m, "")
    .split("\n")
    .filter(line => !/^\s+(sumberDana|porsiPenggalangan|internalAllocations|programInternalAllocations)\s/.test(line))
    .join("\n");
  assert.notEqual(legacy, current);
  assert.ok(!/\bProgramFundingSource\b|\bProgramExpenseSource\b|\bProgramInternalAllocation\b/.test(legacy));
  const schema = path.join(directory, "legacy.prisma");
  writeFileSync(schema, legacy);
  const diff = (filename: string) => execFileSync(process.execPath, [
    require.resolve("prisma/build/index.js"), "migrate", "diff", "--from-empty",
    "--to-schema-datamodel", filename, "--script",
  ], { encoding: "utf8", env: { ...process.env, DATABASE_URL: `file:${directory}/unused.db`, TURSO_AUTH_TOKEN: "" } });
  legacySql = diff(schema);
  currentSql = diff("prisma/schema.prisma");
});

async function fixture() {
  const url = `file:${path.join(directory, `${randomUUID()}.db`)}`;
  const db = createClient({ url });
  await db.executeMultiple(legacySql);
  await db.batch([
    "INSERT INTO User (id, name, email, password) VALUES ('user', 'Legacy Staff', 'funding@example.test', 'unusable-fixture-hash')",
    "INSERT INTO CashAccount (id, name, openingBalance) VALUES ('account', 'Legacy Cash', 99)",
    ...[["positive", 1000000], ["zero", 0], ["negative", -1], ["fraction", 0.25]].map(([id, amount]) => ({
      sql: `INSERT INTO Program (id, code, name, field, fundraisingTarget, maxBudget, picId, leftoverRule, description, updatedAt)
        VALUES (?, ?, ?, 'PENDIDIKAN', ?, 7654321, 'user', 'KE_PROGRAM_LAIN', 'Keep original description', 1700000000000)`,
      args: [id, `PRG/${id}`, `Legacy ${id}`, amount],
    })),
    `INSERT INTO FinanceIncome (id, refNumber, date, sourceName, restriction, fundCategory, programId, amount, verification, accountId, createdById, updatedAt)
      VALUES ('income', 'KM/legacy', 1700000000000, 'Legacy Donor', 'TIDAK_TERIKAT', 'INFAQ_SEDEKAH', 'positive', 150, 'VERIFIED', 'account', 'user', 1700000000000)`,
    `INSERT INTO FinanceExpense (id, voucherNumber, date, accountId, pocket, programId, coa, amount, approval, createdById, updatedAt)
      VALUES ('expense', 'PV/legacy', 1700000000000, 'account', 'TERIKAT', 'positive', 'BEBAN_PROGRAM', 25, 'SELESAI', 'user', 1700000000000)`,
    "INSERT INTO Donation (id, donaturName, amount, receiptNumber) VALUES ('donation', 'Original Donor', 123.45, 'KW/legacy')",
    "INSERT INTO FinanceCategory (id, name) VALUES ('category', 'Legacy category')",
    `INSERT INTO "Transaction" (id, description, categoryId, type, amount, donationId, createdById)
      VALUES ('ledger', 'Original ledger entry', 'category', 'DEBIT', 123.45, 'donation', 'user')`,
  ], "write");
  return { db, url };
}

type Snapshot = Awaited<ReturnType<typeof snapshot>>;
async function snapshot(db: Client) {
  const tables = (await db.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).rows;
  return Promise.all(tables.map(async table => {
    const name = String(table.name);
    return {
      name,
      columns: (await db.execute(`PRAGMA table_info(${quote(name)})`)).rows,
      foreignKeys: (await db.execute(`PRAGMA foreign_key_list(${quote(name)})`)).rows,
      rows: (await db.execute(`SELECT * FROM ${quote(name)} ORDER BY id`)).rows,
    };
  }));
}

async function assertLegacyUnchanged(db: Client, original: Snapshot) {
  for (const table of original) {
    const columns = (await db.execute(`PRAGMA table_info(${quote(table.name)})`)).rows;
    assert.deepEqual(columns.slice(0, table.columns.length), table.columns, `${table.name}: original column definitions`);
    assert.deepEqual((await db.execute(`PRAGMA foreign_key_list(${quote(table.name)})`)).rows, table.foreignKeys);
    const selection = table.columns.map(column => quote(String(column.name))).join(", ");
    assert.deepEqual((await db.execute(`SELECT ${selection} FROM ${quote(table.name)} ORDER BY id`)).rows, table.rows, `${table.name}: original data`);
  }
  assert.equal((await db.execute("PRAGMA foreign_key_check")).rows.length, 0);
}

test("funding migration only adds schema, preserves every old field and row, and remains Prisma-readable", async () => {
  const { db, url } = await fixture();
  const prisma = new PrismaClient({ adapter: new PrismaLibSQL({ url }) });
  try {
    const original = await snapshot(db);
    const first = await migrateProgramFunding(db);
    assert.deepEqual(first.before, first.after);
    await assertLegacyUnchanged(db, original);
    assert.equal((await db.execute('SELECT COUNT(*) AS n FROM "Program" WHERE "sumberDana" IS NULL')).rows[0].n, 4);
    assert.equal((await db.execute('SELECT COUNT(*) AS n FROM "ProgramInternalAllocation"')).rows[0].n, 0);
    const migrated = await snapshot(db);
    await migrateProgramFunding(db);
    assert.deepEqual(await snapshot(db), migrated);
    const program = await prisma.program.findUniqueOrThrow({
      where: { id: "positive" }, include: { incomes: true, expenses: true, internalAllocations: true, pic: true },
    });
    assert.equal(program.fundraisingTarget, 1000000);
    assert.equal(program.maxBudget, 7654321);
    assert.equal(program.leftoverRule, "KE_PROGRAM_LAIN");
    assert.equal(program.sumberDana, null);
    assert.equal(program.incomes[0].amount, 150);
    assert.equal(program.expenses[0].amount, 25);
    assert.equal(program.expenses[0].sumberDana, null);
    assert.equal(program.pic?.name, "Legacy Staff");
    assert.deepEqual(program.internalAllocations, []);
  } finally { await prisma.$disconnect(); db.close(); }
});

test("separate backfill previews without writes, classifies by target, and never fabricates historical funds", async () => {
  const { db } = await fixture();
  try {
    const original = await snapshot(db);
    await migrateProgramFunding(db);
    const migrated = await snapshot(db);
    const preview = await backfillProgramFunding(db);
    assert.equal(preview.dryRun, true);
    assert.equal(preview.updated, 0);
    assert.deepEqual(preview.planned, { PENGGALANGAN: 2, INTERNAL: 2 });
    assert.deepEqual(await snapshot(db), migrated);
    const result = await backfillProgramFunding(db, true);
    assert.equal(result.updated, 4);
    assert.deepEqual(result.before, result.after);
    assert.deepEqual((await db.execute('SELECT id, "sumberDana" FROM "Program" ORDER BY id')).rows.map(row => [row.id, row.sumberDana]), [
      ["fraction", "PENGGALANGAN"], ["negative", "INTERNAL"], ["positive", "PENGGALANGAN"], ["zero", "INTERNAL"],
    ]);
    await assertLegacyUnchanged(db, original);
    assert.equal((await db.execute('SELECT "sumberDana" FROM "FinanceExpense"')).rows[0].sumberDana, null);
    assert.equal((await db.execute('SELECT COUNT(*) AS n FROM "ProgramInternalAllocation"')).rows[0].n, 0);
    assert.equal((await db.execute('SELECT COUNT(*) AS n FROM "Program" WHERE "porsiPenggalangan" IS NOT NULL')).rows[0].n, 0);
  } finally { db.close(); }
});

test("backfill retries preserve explicit sources and percentages, while supporting old writers", async () => {
  const { db } = await fixture();
  try {
    await migrateProgramFunding(db);
    await db.batch([
      'UPDATE Program SET sumberDana = \'CAMPURAN\', porsiPenggalangan = 42.5 WHERE id = \'positive\'',
      'UPDATE Program SET sumberDana = \'PENGGALANGAN\' WHERE id = \'zero\'',
      'UPDATE Program SET sumberDana = \'INTERNAL\' WHERE id = \'fraction\'',
    ], "write");
    assert.equal((await backfillProgramFunding(db, true)).updated, 1);
    const first = await snapshot(db);
    assert.equal((await backfillProgramFunding(db, true)).updated, 0);
    assert.deepEqual(await snapshot(db), first);
    const row = (await db.execute("SELECT * FROM Program WHERE id = 'positive'")).rows[0];
    assert.equal(row.sumberDana, "CAMPURAN");
    assert.equal(row.porsiPenggalangan, 42.5);
    await db.execute(`INSERT INTO Program (id, code, name, field, fundraisingTarget, updatedAt)
      VALUES ('old-writer', 'PRG/old-writer', 'Created without new fields', 'PENDIDIKAN', 12, 1700000000000)`);
    assert.equal((await backfillProgramFunding(db, true)).updated, 1);
    assert.equal((await db.execute("SELECT sumberDana FROM Program WHERE id = 'old-writer'")).rows[0].sumberDana, "PENGGALANGAN");
  } finally { db.close(); }
});

test("additive funding constraints reject invalid sources, amounts, percentages and foreign references", async () => {
  const { db, url } = await fixture();
  const prisma = new PrismaClient({ adapter: new PrismaLibSQL({ url }) });
  try {
    await migrateProgramFunding(db);
    await assert.rejects(db.execute("UPDATE Program SET sumberDana = 'OTHER' WHERE id = 'positive'"));
    await assert.rejects(db.execute("UPDATE FinanceExpense SET sumberDana = 'CAMPURAN' WHERE id = 'expense'"));
    for (const percentage of [-1, 101]) {
      await assert.rejects(db.execute({ sql: "UPDATE Program SET porsiPenggalangan = ? WHERE id = 'positive'", args: [percentage] }));
    }
    for (const [programId, createdById, amount] of [["missing", "user", 10], ["positive", "missing", 10], ["positive", "user", 0], ["positive", "user", -5]]) {
      await assert.rejects(db.execute({
        sql: "INSERT INTO ProgramInternalAllocation (id, programId, createdById, amount) VALUES (?, ?, ?, ?)",
        args: [randomUUID(), programId, createdById, amount],
      }));
    }
    const allocation = await prisma.programInternalAllocation.create({
      data: { programId: "positive", createdById: "user", amount: 123.5 },
      include: { program: true, createdBy: true },
    });
    assert.equal(allocation.amount, 123.5);
    assert.equal(allocation.program.code, "PRG/positive");
    assert.equal(allocation.createdBy.name, "Legacy Staff");
    assert.ok(allocation.createdAt instanceof Date);
    assert.equal((await db.execute("PRAGMA foreign_key_check")).rows.length, 0);
  } finally { await prisma.$disconnect(); db.close(); }
});

test("schema migration rolls back additions on failure; backfill cannot run before migration", async () => {
  const { db } = await fixture();
  try {
    const original = await snapshot(db);
    await assert.rejects(backfillProgramFunding(db, true), /sumberDana/);
    assert.deepEqual(await snapshot(db), original);
    // A conflicting preexisting table forces failure after the ADD COLUMN operations.
    await db.execute("CREATE TABLE ProgramInternalAllocation (id TEXT PRIMARY KEY)");
    const conflict = await snapshot(db);
    await assert.rejects(migrateProgramFunding(db));
    assert.deepEqual(await snapshot(db), conflict);
  } finally { db.close(); }
});

test("additive SQL matches fresh Prisma columns, relations and indexes", async () => {
  const { db } = await fixture();
  const fresh = createClient({ url: `file:${path.join(directory, `${randomUUID()}-fresh.db`)}` });
  try {
    await migrateProgramFunding(db);
    await fresh.executeMultiple(currentSql);
    for (const table of ["Program", "FinanceExpense", "ProgramInternalAllocation"]) {
      const columns = async (client: Client) => (await client.execute(`PRAGMA table_info(${quote(table)})`)).rows
        .map(({ cid: _cid, ...column }) => column).sort((a, b) => String(a.name).localeCompare(String(b.name)));
      assert.deepEqual(await columns(db), await columns(fresh), table);
      assert.deepEqual((await db.execute(`PRAGMA foreign_key_list(${quote(table)})`)).rows, (await fresh.execute(`PRAGMA foreign_key_list(${quote(table)})`)).rows, table);
      const indexes = async (client: Client) => (await client.execute(`PRAGMA index_list(${quote(table)})`)).rows
        .map(({ seq: _seq, ...index }) => index).sort((a, b) => String(a.name).localeCompare(String(b.name)));
      assert.deepEqual(await indexes(db), await indexes(fresh), table);
    }
  } finally { db.close(); fresh.close(); }
});

test("funding CLIs require explicit existing local targets and never infer a production database", async () => {
  const { db, url } = await fixture();
  try {
    for (const value of [undefined, "libsql://example.turso.io", "https://db", "file://remote/db", "file:", "file::memory:", `${url}?mode=rw`, `${url}#fragment`, `file:${directory}/missing.db`]) {
      assert.throws(() => requireLocalFundingDatabase(value));
    }
    assert.equal(requireLocalFundingDatabase(url), url);
    for (const script of ["migrate-program-funding.ts", "backfill-program-funding.ts"]) {
      for (const args of [[], ["--database", "libsql://example.turso.io"]]) {
        const result = spawnSync(process.execPath, ["--import", "tsx", `scripts/${script}`, ...args], {
          encoding: "utf8", env: { ...process.env, DATABASE_URL: "libsql://must-not-be-used.example" },
        });
        assert.equal(result.status, 1);
        assert.match(result.stderr, /Supply --database/);
      }
    }
    const original = await snapshot(db);
    assert.equal(original.find(table => table.name === "Program")?.rows.length, 4);
  } finally { db.close(); }
});

const fundingDraft = Object.freeze({
  sumberDana: "CAMPURAN", fundraisingTarget: "250000", alokasiDanaInternal: "750000", porsiPenggalangan: "25",
});
function renderFunding(sumberDana: string, extra = {}) {
  return renderToStaticMarkup(React.createElement(programTools.ProgramFundingFields, {
    values: { ...fundingDraft, sumberDana }, onChange() {}, ...extra,
  }));
}

test("program form shows exactly the requested funding fields and localizes labels without changing values", () => {
  for (const locale of ["id", "en"] as const) {
    formLocale = locale;
    const options = localizeLabels(programFundingSourceOptions, createTranslator(locale));
    assert.deepEqual(options.map(option => option.value), ["PENGGALANGAN", "INTERNAL", "CAMPURAN"]);
    assert.deepEqual(options.map(option => option.label), locale === "en"
      ? ["Fundraising", "Internal Funds", "Mixed"] : ["Penggalangan Dana", "Dana Internal", "Campuran"]);
    for (const source of ["", "PENGGALANGAN", "INTERNAL", "CAMPURAN"]) {
      const html = renderFunding(source);
      assert.ok(html.includes(locale === "en" ? "Funding Source *" : "Sumber Pendanaan *"));
      assert.equal(html.includes('id="prg-target"'), source === "PENGGALANGAN" || source === "CAMPURAN");
      assert.equal(html.includes('id="prg-internal-allocation"'), source === "INTERNAL" || source === "CAMPURAN");
      assert.equal(html.includes('id="prg-fundraising-share"'), source === "CAMPURAN");
      if (source === "CAMPURAN") {
        assert.ok(html.indexOf('id="prg-funding-source"') < html.indexOf('id="prg-target"'));
        assert.ok(html.includes(locale === "en" ? "Internal fund share: 75%" : "Porsi dana internal: 75%"));
      }
    }
  }
});

test("mixed share updates its localized remainder and displays accessible inline errors", () => {
  for (const locale of ["id", "en"] as const) {
    formLocale = locale;
    const html = renderFunding("CAMPURAN", { values: { ...fundingDraft, porsiPenggalangan: "37.5" } });
    assert.ok(html.includes(locale === "en" ? "Internal fund share: 62.5%" : "Porsi dana internal: 62,5%"));
    const invalid = renderFunding("CAMPURAN", {
      values: { ...fundingDraft, porsiPenggalangan: "101" },
      errors: { porsiPenggalangan: "Invalid share" }, disabled: true,
    });
    assert.ok(invalid.includes('id="prg-fundraising-share-error"'));
    assert.ok(invalid.includes('aria-describedby="prg-fundraising-share-error"'));
    assert.ok(invalid.includes('role="alert"'));
    assert.ok(invalid.includes('aria-invalid="true"'));
    assert.ok(invalid.includes('disabled=""'));
    assert.ok(!invalid.includes("-1%"));
  }
});

test("switching source retains controlled input values but excludes hidden fields from the submission", () => {
  for (const locale of ["id", "en"] as const) {
    const schema = getSchemas(locale).programFundingSchema;
    const fundraising = schema.parse({ ...fundingDraft, sumberDana: "PENGGALANGAN", alokasiDanaInternal: "invalid hidden value", porsiPenggalangan: "invalid" });
    assert.deepEqual(fundraising, { sumberDana: "PENGGALANGAN", fundraisingTarget: 250000, alokasiDanaInternal: 0, porsiPenggalangan: null });
    const internal = schema.parse({ ...fundingDraft, sumberDana: "INTERNAL", fundraisingTarget: "invalid hidden value" });
    assert.deepEqual(internal, { sumberDana: "INTERNAL", fundraisingTarget: 0, alokasiDanaInternal: 750000, porsiPenggalangan: null });
    assert.deepEqual(schema.parse(fundingDraft), { sumberDana: "CAMPURAN", fundraisingTarget: 250000, alokasiDanaInternal: 750000, porsiPenggalangan: 25 });
    assert.equal(fundingDraft.fundraisingTarget, "250000");
    assert.equal(fundingDraft.alokasiDanaInternal, "750000");
    assert.ok(renderFunding("PENGGALANGAN").includes('value="250000"'));
    assert.ok(renderFunding("INTERNAL").includes('value="750000"'));
  }
});

test("funding form validation rejects missing sources, invalid amounts and missing or out-of-range mixed shares", () => {
  for (const locale of ["id", "en"] as const) {
    const schema = getSchemas(locale).programFundingSchema;
    for (const source of ["", "NONE", "OTHER", undefined]) {
      const result = schema.safeParse({ ...fundingDraft, sumberDana: source });
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.error.issues[0].message, locale === "en" ? "Select a funding source" : "Pilih sumber pendanaan");
    }
    for (const value of [-1, "NaN", Infinity, "Infinity"]) {
      assert.equal(schema.safeParse({ ...fundingDraft, fundraisingTarget: value }).success, false);
      assert.equal(schema.safeParse({ ...fundingDraft, alokasiDanaInternal: value }).success, false);
    }
    for (const value of ["", " ", null, undefined, -1, 101, "NaN", Infinity]) {
      const result = schema.safeParse({ ...fundingDraft, porsiPenggalangan: value });
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.error.issues[0].message, createTranslator(locale)("Isi porsi penggalangan antara 0–100%."));
    }
    for (const value of [0, 37.5, 100]) {
      assert.equal(schema.parse({ ...fundingDraft, porsiPenggalangan: value }).porsiPenggalangan, value);
    }
  }
});

test("new program form keeps existing budget and leftover controls; edit form and legacy validation are unchanged", () => {
  formLocale = "en";
  const staffOptions = [{ id: "cm111111111111111111111111", name: "Staff member" }];
  const created = renderToStaticMarkup(React.createElement(programTools.AddProgramDialog, { staffOptions }));
  const program = {
    id: "cm222222222222222222222222", code: "PRG/legacy", name: "Legacy Program", field: "PENDIDIKAN",
    fundraisingTarget: 123, maxBudget: 7654321, startDate: null, picId: staffOptions[0].id,
    status: "DRAFT", leftoverRule: "KE_PROGRAM_LAIN", description: "Original text",
  };
  const edited = renderToStaticMarkup(React.createElement(programTools.EditProgramDialog, { program, staffOptions }));
  assert.ok(created.indexOf('id="prg-funding-source"') < created.indexOf('id="prg-name"'));
  for (const html of [created, edited]) {
    assert.ok(html.includes('id="prg-budget"'));
    assert.ok(html.includes(createTranslator("en")("Anggaran Biaya Maksimal (Rp)")));
    assert.ok(html.includes(createTranslator("en")("Aturan Sisa Dana")));
  }
  assert.ok(!edited.includes('id="prg-funding-source"'));
  assert.ok(edited.includes('value="123"'));
  assert.ok(edited.includes('value="7654321"'));
  const result = getSchemas("en").programSchema.parse({ ...program, startDate: undefined });
  assert.equal(result.maxBudget, 7654321);
  assert.equal(result.leftoverRule, "KE_PROGRAM_LAIN");
  assert.equal(result.fundraisingTarget, 123);
});

test("server rejects missing or invalid funding and unauthorized writes before accessing storage", async () => {
  const before = databaseAccesses;
  for (const locale of ["id", "en"] as const) {
    formLocale = locale;
    formAuthorized = true;
    for (const source of ["", "OTHER"]) {
      const form = new FormData();
      form.set("sumberDana", source);
      const result = await programActions.createProgram(form);
      assert.deepEqual(result, { success: false, error: createTranslator(locale)("Pilih sumber pendanaan") });
    }
    const invalid = new FormData();
    invalid.set("sumberDana", "CAMPURAN");
    invalid.set("porsiPenggalangan", "101");
    assert.equal((await programActions.createProgram(invalid)).success, false);
  }
  formAuthorized = false;
  assert.equal((await programActions.createProgram(new FormData())).success, false);
  assert.equal((await expenseActions.createFinanceExpense(new FormData())).success, false);
  assert.equal((await incomeActions.setIncomeVerification("invalid", "VERIFIED")).success, false);
  assert.equal(databaseAccesses, before);
  formAuthorized = true;
});

async function businessFixture() {
  const { db, url } = await fixture();
  await migrateProgramFunding(db);
  const prisma = new PrismaClient({ adapter: new PrismaLibSQL({ url }) });
  const peer = new PrismaClient({ adapter: new PrismaLibSQL({ url }) });
  testDatabase = prisma;
  formLocale = "en";
  formAuthorized = true;
  formRole = "FINANCE";
  const user = await prisma.user.create({ data: { name: "Funding staff", email: "staff@example.test", password: "fixture-only", role: "FINANCE" } });
  formUserId = user.id;
  const account = await prisma.cashAccount.create({ data: { name: "Funding account", openingBalance: 99 } });
  const incomeData = {
    date: new Date(), sourceName: "General funds", restriction: "TIDAK_TERIKAT" as const,
    fundCategory: "INFAQ_SEDEKAH" as const, contactCategory: "PERORANGAN" as const,
    method: "TUNAI" as const, amount: 1000, accountId: account.id,
  };
  await prisma.financeIncome.create({ data: { ...incomeData, refNumber: "KM/general", verification: "VERIFIED", createdById: user.id } });
  const programForm = (source: string, allocation = 0, extra: Record<string, string> = {}) => {
    const form = new FormData();
    for (const [key, value] of Object.entries({
      name: `Program ${source}`, field: "PENDIDIKAN", picId: user.id, status: "AKTIF",
      maxBudget: "7654321", leftoverRule: "KE_PROGRAM_LAIN", fundraisingTarget: "250",
      sumberDana: source, alokasiDanaInternal: String(allocation), porsiPenggalangan: "35", ...extra,
    })) form.set(key, value);
    return form;
  };
  const create = async (source: string, allocation = 0, extra: Record<string, string> = {}) => {
    const result = await programActions.createProgram(programForm(source, allocation, extra));
    assert.equal(result.success, true, JSON.stringify(result));
    assert.ok(result.success && result.id);
    return result.id;
  };
  const expenseForm = async (programId: string | undefined, source: string | undefined, amount: number) => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ date: "2026-10-25", accountId: account.id,
      pocket: programId ? "TERIKAT" : "TIDAK_TERIKAT", coa: "BEBAN_KANTOR", amount: String(amount),
    })) form.set(key, value);
    if (programId) form.set("programId", programId);
    if (source) form.set("sumberDana", source);
    const nonce = randomUUID();
    const actor = { id: user.id };
    const upload = await storage.startManagedUpload(prisma, drive, { nonce, mode: "staff", file: {
      purpose: "EXPENSE_PROOF", filename: "proof.pdf", mime: "application/pdf", bytes: proofBytes.length,
    } }, actor, signingSecret);
    const claim = { id: upload.id, ticket: upload.ticket };
    await storage.finalizeManagedUpload(prisma, drive, claim, actor, signingSecret);
    form.set(MANAGED_FORM_KEY, JSON.stringify({ nonce, claims: [claim] }));
    await uploadHook?.();
    return form;
  };
  const spend = async (programId: string | undefined, source: string | undefined, amount: number) => {
    const result = await expenseActions.createFinanceExpense(await expenseForm(programId, source, amount));
    assert.equal(result.success, true, JSON.stringify(result));
    assert.ok(result.success && result.id);
    return result.id;
  };
  const wallet = async (id: string) => (await balances.getProgramBalances(prisma, id))[0];
  const close = async () => {
    uploadHook = undefined;
    testDatabase = undefined;
    await prisma.$disconnect(); await peer.$disconnect(); db.close();
  };
  return { db, prisma, peer, account, user, incomeData, programForm, create, expenseForm, spend, wallet, close };
}

async function expectFundingError(result: { success: boolean; error?: string }, key: string) {
  assert.deepEqual(result, { success: false, error: createTranslator(formLocale)(key) });
}

test("funding reads preserve all legacy rows and never credit linked receipts to the general wallet", async () => {
  const { db, url } = await fixture();
  const prisma = new PrismaClient({ adapter: new PrismaLibSQL({ url }) });
  try {
    await migrateProgramFunding(db);
    const original = await snapshot(db);
    assert.equal(await balances.getUnrestrictedBalance(prisma), 0);
    const [program] = await balances.getProgramBalances(prisma, "positive");
    assert.equal(program.balance, 125);
    assert.equal(program.legacyReserved, 25);
    assert.deepEqual(program.fundraising, { received: 150, used: 0, balance: 125 });
    assert.deepEqual(program.internal, { received: 0, used: 0, balance: 0 });
    assert.equal(program.sumberDana, "PENGGALANGAN");
    assert.equal((await balances.getProgramBalances(prisma, "zero"))[0].sumberDana, "INTERNAL");
    assert.deepEqual(await snapshot(db), original);
    await prisma.$transaction(tx => balances.lockFundingWallets(tx));
    assert.deepEqual(await snapshot(db), original, "acquiring the write reservation changes no rows");
  } finally { await prisma.$disconnect(); db.close(); }
});

test("program creation atomically saves source and allocation without creating income or changing cash, budget or leftover rules", async () => {
  const f = await businessFixture();
  try {
    const cashBefore = await balances.getAccountBalances();
    const incomesBefore = await f.prisma.financeIncome.count();
    const ledgerBefore = await f.prisma.transaction.count();
    const internal = await f.create("INTERNAL", 300, { fundraisingTarget: "invalid hidden draft" });
    const mixed = await f.create("CAMPURAN", 400);
    const fundraising = await f.create("PENGGALANGAN", 999999);
    const zero = await f.create("INTERNAL");
    for (const id of [internal, mixed, fundraising, zero]) {
      const row = await f.prisma.program.findUniqueOrThrow({ where: { id } });
      assert.equal(row.maxBudget, 7654321);
      assert.equal(row.leftoverRule, "KE_PROGRAM_LAIN");
      assert.equal(row.fundraisingTarget, id === internal || id === zero ? 0 : 250);
      assert.equal(row.porsiPenggalangan, id === mixed ? 35 : null);
    }
    assert.equal((await f.wallet(mixed)).sumberDana, "CAMPURAN");
    assert.equal((await f.wallet(internal)).internal.balance, 300);
    assert.equal((await f.wallet(mixed)).internal.balance, 400);
    assert.equal((await f.wallet(fundraising)).balance, 0, "a target is not money received");
    assert.equal(await f.prisma.programInternalAllocation.count(), 2);
    assert.equal(await balances.getUnrestrictedBalance(), 300);
    assert.equal(await f.prisma.financeIncome.count(), incomesBefore);
    assert.equal(await f.prisma.transaction.count(), ledgerBefore);
    assert.deepEqual(await balances.getAccountBalances(), cashBefore);
    const allocations = await f.prisma.programInternalAllocation.findMany();
    assert.ok(allocations.every(a => a.createdById === f.user.id));
    await expectFundingError(await programActions.createProgram(f.programForm("INTERNAL", 301)), "Saldo dana tidak terikat tidak cukup untuk alokasi internal");
    assert.equal(await f.prisma.programInternalAllocation.count(), 2);
    assert.equal((await programActions.deleteProgram(internal)).success, false);
    assert.equal(await f.prisma.programInternalAllocation.count(), 2);
    assert.ok(!renderFunding("INTERNAL").includes("not enabled yet"));
  } finally { await f.close(); }
});

test("an allocation storage failure rolls back the whole program and leaves general funds untouched", async t => {
  t.mock.method(console, "error", () => {});
  const f = await businessFixture();
  try {
    const original = await snapshot(f.db);
    await f.db.execute(`CREATE TRIGGER fail_allocation BEFORE INSERT ON ProgramInternalAllocation BEGIN SELECT RAISE(ABORT, 'Fixture allocation failure'); END`);
    assert.equal((await programActions.createProgram(f.programForm("INTERNAL", 200))).success, false);
    assert.equal(await balances.getUnrestrictedBalance(), 1000);
    assert.deepEqual(await snapshot(f.db), original);
  } finally { await f.close(); }
});

test("linked receipts and verification credit only their own program; internal-only donations are rejected", async () => {
  const f = await businessFixture();
  try {
    const fundraiser = await f.create("PENGGALANGAN");
    const internal = await f.create("INTERNAL", 100);
    const mixed = await f.create("CAMPURAN", 100);
    const linked = { ...f.incomeData, programId: fundraiser, amount: 80 };
    const result = await incomeActions.createFinanceIncome(linked);
    assert.equal(result.success, true, JSON.stringify(result));
    assert.ok(result.success && result.id);
    const row = await f.prisma.financeIncome.findUniqueOrThrow({ where: { id: result.id } });
    assert.equal(row.programId, fundraiser);
    assert.equal(row.restriction, "TIDAK_TERIKAT");
    assert.equal((await f.wallet(fundraiser)).fundraising.balance, 80);
    assert.equal((await f.wallet(mixed)).fundraising.balance, 0);
    assert.equal(await balances.getUnrestrictedBalance(), 800);
    const pending = await incomeActions.createFinanceIncome({ ...linked, method: "TRANSFER_BANK", amount: 25 });
    assert.ok(pending.success && pending.id);
    assert.equal((await f.wallet(fundraiser)).fundraising.balance, 80);
    assert.equal((await incomeActions.setIncomeVerification(pending.id, "VERIFIED")).success, true);
    assert.equal((await f.wallet(fundraiser)).fundraising.balance, 105);
    assert.equal((await incomeActions.setIncomeVerification(pending.id, "VERIFIED")).success, false);
    const rejected = await incomeActions.createFinanceIncome({ ...linked, method: "TRANSFER_BANK", amount: 40 });
    assert.ok(rejected.success && rejected.id);
    assert.equal((await incomeActions.setIncomeVerification(rejected.id, "REJECTED")).success, true);
    assert.equal((await f.wallet(fundraiser)).fundraising.balance, 105);
    for (const restriction of ["TIDAK_TERIKAT", "TERIKAT_TEMPORER"] as const) {
      await expectFundingError(await incomeActions.createFinanceIncome({ ...linked, restriction, programId: internal }), "Program dana internal tidak menerima donasi atau penggalangan dana");
    }
    assert.equal((await incomeActions.createFinanceIncome({ ...linked, programId: mixed, amount: 12 })).success, true);
    assert.equal((await f.wallet(mixed)).fundraising.balance, 12);
    assert.equal((await f.wallet(mixed)).internal.balance, 100);
    assert.equal(await balances.getUnrestrictedBalance(), 800);
    const legacyPending = await f.prisma.financeIncome.create({ data: { ...f.incomeData, refNumber: "KM/legacy-pending", programId: internal, verification: "PENDING", createdById: f.user.id } });
    await expectFundingError(await incomeActions.setIncomeVerification(legacyPending.id, "VERIFIED"), "Program dana internal tidak menerima donasi atau penggalangan dana");
    assert.equal((await f.prisma.financeIncome.findUniqueOrThrow({ where: { id: legacyPending.id } })).verification, "PENDING");
    assert.equal((await incomeActions.setIncomeVerification(legacyPending.id, "REJECTED")).success, true);
  } finally { await f.close(); }
});

test("expense sources are required, restricted by type, and cannot borrow another source or program's funds", async () => {
  const f = await businessFixture();
  try {
    const mixed = await f.create("CAMPURAN", 200);
    const internal = await f.create("INTERNAL", 100);
    const fundraising = await f.create("PENGGALANGAN");
    assert.equal((await incomeActions.createFinanceIncome({ ...f.incomeData, programId: mixed, amount: 120 })).success, true);
    const raisedExpense = await f.spend(mixed, "PENGGALANGAN", 100);
    const internalExpense = await f.spend(mixed, "INTERNAL", 150);
    assert.equal((await f.wallet(mixed)).fundraising.balance, 20);
    assert.equal((await f.wallet(mixed)).internal.balance, 50);
    assert.equal(await balances.getUnrestrictedBalance(), 700);
    assert.equal((await f.prisma.financeExpense.findUniqueOrThrow({ where: { id: internalExpense } })).sumberDana, "INTERNAL");
    for (const [program, source, amount, message] of [
      [mixed, "PENGGALANGAN", 21, "Saldo sumber dana program tidak cukup"],
      [mixed, "INTERNAL", 51, "Saldo sumber dana program tidak cukup"],
      [fundraising, "PENGGALANGAN", 1, "Saldo sumber dana program tidak cukup"],
      [fundraising, "INTERNAL", 1, "Sumber dana tidak diizinkan untuk program ini"],
      [internal, "PENGGALANGAN", 1, "Sumber dana tidak diizinkan untuk program ini"],
    ] as const) {
      await expectFundingError(await expenseActions.createFinanceExpense(await f.expenseForm(program, source, amount)), message);
    }
    for (const source of [undefined, "CAMPURAN", "OTHER"]) {
      assert.equal((await expenseActions.createFinanceExpense(await f.expenseForm(mixed, source, 1))).success, false);
    }
    const bypass = await f.expenseForm(mixed, "INTERNAL", 1);
    bypass.set("pocket", "TIDAK_TERIKAT");
    await expectFundingError(await expenseActions.createFinanceExpense(bypass), "Sumber dana program memerlukan kantong program");
    for (const expected of ["REVIEW", "APPROVAL", "SELESAI"]) {
      formRole = "SUPER_ADMIN";
      assert.equal((await expenseActions.advanceExpenseApproval(internalExpense)).success, true);
      assert.equal((await f.prisma.financeExpense.findUniqueOrThrow({ where: { id: internalExpense } })).approval, expected);
      assert.equal((await f.wallet(mixed)).internal.balance, 50, "every approval status reserves funds exactly once");
    }
    assert.equal((await expenseActions.deleteFinanceExpense(internalExpense)).success, false);
    assert.equal((await expenseActions.deleteFinanceExpense(raisedExpense)).success, true);
    assert.equal((await f.wallet(mixed)).fundraising.balance, 120);
    assert.equal((await f.wallet(mixed)).internal.balance, 50);
    await f.spend(internal, "INTERNAL", 100);
    assert.equal((await f.wallet(internal)).internal.balance, 0);
    await f.spend(undefined, undefined, 700);
    assert.equal(await balances.getUnrestrictedBalance(), 0);
    await expectFundingError(await expenseActions.createFinanceExpense(await f.expenseForm(undefined, undefined, 1)), "Saldo dana tidak terikat tidak cukup");
  } finally { await f.close(); }
});

test("source balances are rechecked after upload before a voucher is saved", async () => {
  const f = await businessFixture();
  try {
    const program = await f.create("INTERNAL", 100);
    uploadHook = async () => {
      await f.prisma.financeExpense.create({ data: { voucherNumber: "PV/intervening", date: new Date(), accountId: f.account.id,
        pocket: "TERIKAT", programId: program, sumberDana: "INTERNAL", coa: "BEBAN_KANTOR", amount: 80, createdById: f.user.id,
      } });
    };
    await expectFundingError(await expenseActions.createFinanceExpense(await f.expenseForm(program, "INTERNAL", 80)), "Saldo sumber dana program tidak cukup");
    assert.equal((await f.wallet(program)).internal.balance, 20);
    assert.equal(await f.prisma.financeExpense.count({ where: { programId: program } }), 1);
  } finally { await f.close(); }
});

test("concurrent allocations and general expenses cannot reserve the same unrestricted balance", async () => {
  const f = await businessFixture();
  try {
    const expenseForm = await f.expenseForm(undefined, undefined, 700);
    const results = await Promise.all([
      programActions.createProgram(f.programForm("INTERNAL", 700)),
      requestDatabase.run(f.peer, () => expenseActions.createFinanceExpense(expenseForm)),
    ]);
    assert.equal(results.filter(r => r.success).length, 1, JSON.stringify(results));
    assert.equal(await balances.getUnrestrictedBalance(), 300);
    const allocated = (await f.prisma.programInternalAllocation.aggregate({ _sum: { amount: true } }))._sum.amount ?? 0;
    const expenses = (await f.prisma.financeExpense.aggregate({ where: { programId: null }, _sum: { amount: true } }))._sum.amount ?? 0;
    assert.equal(allocated + expenses, 700);
  } finally { await f.close(); }
});

test("concurrent program expenses and receipt verification preserve one reservation and one ledger credit", async () => {
  const f = await businessFixture();
  try {
    const program = await f.create("INTERNAL", 100);
    const firstForm = await f.expenseForm(program, "INTERNAL", 70);
    const secondForm = await f.expenseForm(program, "INTERNAL", 70);
    const results = await Promise.all([
      expenseActions.createFinanceExpense(firstForm),
      requestDatabase.run(f.peer, () => expenseActions.createFinanceExpense(secondForm)),
    ]);
    assert.equal(results.filter(r => r.success).length, 1, JSON.stringify(results));
    assert.equal((await f.wallet(program)).internal.balance, 30);
    assert.equal(await f.prisma.financeExpense.count({ where: { programId: program } }), 1);
    const pending = await incomeActions.createFinanceIncome({ ...f.incomeData, method: "TRANSFER_BANK", amount: 17 });
    assert.ok(pending.success && pending.id);
    const pendingId = pending.id;
    const verified = await Promise.all([
      incomeActions.setIncomeVerification(pendingId, "VERIFIED"),
      requestDatabase.run(f.peer, () => incomeActions.setIncomeVerification(pendingId, "VERIFIED")),
    ]);
    assert.equal(verified.filter(r => r.success).length, 1, JSON.stringify(verified));
    assert.equal(await balances.getUnrestrictedBalance(), 917);
    assert.equal(await f.prisma.transaction.count({ where: { description: { startsWith: pending.refNumber } } }), 1);
  } finally { await f.close(); }
});

test("internal campaigns are excluded while legacy data, explicit classifications and edit behavior stay readable", async () => {
  const f = await businessFixture();
  try {
    const internal = await f.create("INTERNAL", 100);
    const fundraising = await f.create("PENGGALANGAN");
    const mixed = await f.create("CAMPURAN");
    const legacy = await f.prisma.program.create({ data: { code: "PRG/old-caller", name: "Old caller", field: "PENDIDIKAN", fundraisingTarget: 10, picId: f.user.id, status: "AKTIF" } });
    const form = f.programForm("INTERNAL", 999999, { fundraisingTarget: "500" });
    for (const key of ["sumberDana", "alokasiDanaInternal", "porsiPenggalangan"]) form.delete(key);
    assert.equal((await programActions.updateProgram(internal, form)).success, true);
    assert.equal((await f.wallet(internal)).sumberDana, "INTERNAL");
    assert.equal((await f.wallet(internal)).internal.balance, 100);
    form.set("fundraisingTarget", "0");
    assert.equal((await programActions.updateProgram(legacy.id, form)).success, true);
    assert.equal((await f.wallet(legacy.id)).sumberDana, "PENGGALANGAN");
    const visible = (await dashboard.getProgramDonorData()).programs.map(p => p.id);
    assert.ok(!visible.includes(internal));
    for (const id of [fundraising, mixed, legacy.id]) assert.ok(visible.includes(id));
    const options = await f.prisma.program.findMany({ where: { ...balances.fundraisingProgramWhere, status: { in: ["AKTIF", "PENYALURAN", "DRAFT"] } } });
    assert.ok(!options.some(p => p.id === internal || p.id === "zero" || p.id === "negative"));
    assert.ok(options.some(p => p.id === "positive"));
    assert.equal((await f.prisma.financeExpense.findUniqueOrThrow({ where: { id: "expense" } })).sumberDana, null);
    assert.equal(await f.prisma.donation.count(), 1);
  } finally { await f.close(); }
});

test("fractional receipts and reservations do not create spendable floating-point remainders", async () => {
  const f = await businessFixture();
  try {
    const program = await f.create("CAMPURAN", 0.3);
    for (const amount of [0.1, 0.2]) {
      assert.equal((await incomeActions.createFinanceIncome({ ...f.incomeData, programId: program, amount })).success, true);
      await f.spend(program, "INTERNAL", amount);
    }
    await f.spend(program, "PENGGALANGAN", 0.3);
    assert.equal((await f.wallet(program)).balance, 0);
    for (const source of ["PENGGALANGAN", "INTERNAL"]) {
      await expectFundingError(await expenseActions.createFinanceExpense(await f.expenseForm(program, source, 0.01)), "Saldo sumber dana program tidak cukup");
    }
    assert.equal(await balances.getUnrestrictedBalance(), 999.7);
    await f.spend(undefined, undefined, 999.7);
    assert.equal(await balances.getUnrestrictedBalance(), 0);
  } finally { await f.close(); }
});

test("failed ledger writes roll back cash receipts and pending verification without crediting any wallet", async t => {
  t.mock.method(console, "error", () => {});
  const f = await businessFixture();
  try {
    const pending = await incomeActions.createFinanceIncome({ ...f.incomeData, method: "TRANSFER_BANK", amount: 50 });
    assert.ok(pending.success && pending.id);
    await f.db.execute(`CREATE TRIGGER fail_ledger BEFORE INSERT ON "Transaction" BEGIN SELECT RAISE(ABORT, 'Fixture ledger failure'); END`);
    const original = await snapshot(f.db);
    assert.equal((await incomeActions.createFinanceIncome({ ...f.incomeData, amount: 30 })).success, false);
    assert.deepEqual(await snapshot(f.db), original);
    assert.equal((await incomeActions.setIncomeVerification(pending.id, "VERIFIED")).success, false);
    assert.deepEqual(await snapshot(f.db), original);
    assert.equal(await balances.getUnrestrictedBalance(), 1000);
  } finally { await f.close(); }
});

test("expense-source controls offer only permitted sources and validation rejects nonfinite money", () => {
  for (const locale of ["id", "en"] as const) {
    formLocale = locale;
    for (const source of ["PENGGALANGAN", "INTERNAL", "CAMPURAN"] as const) {
      const props = {
        program: { id: "program", name: "Program", code: "PRG/test", sumberDana: source, balance: 120,
          fundraising: { received: 50, used: 0, balance: 50 }, internal: { received: 70, used: 0, balance: 70 } },
        value: "NONE", onChange() {},
      };
      const html = renderToStaticMarkup(React.createElement(expenseTools.ProgramExpenseSourceSelect, props));
      assert.ok(html.includes('id="ex-funding-source"'));
      assert.ok(html.includes('aria-required="true"'));
      assert.ok(html.includes(createTranslator(locale)("Sumber Dana Pengeluaran *")));
      // Radix's closed portal is not emitted by SSR. Inspect the real component's option elements.
      const { SelectItem } = require("../components/ui/select");
      const values: string[] = [];
      const visit = (node: React.ReactNode) => React.Children.forEach(node, child => {
        if (!React.isValidElement<{ value: string; children?: React.ReactNode }>(child)) return;
        if (child.type === SelectItem) values.push(child.props.value);
        if (child.props.children) visit(child.props.children);
      });
      visit(expenseTools.ProgramExpenseSourceSelect(props));
      assert.deepEqual(values, source === "CAMPURAN" ? ["PENGGALANGAN", "INTERNAL"] : [source]);
    }
    const id = "cm111111111111111111111111";
    const expense = { date: new Date(), accountId: id, pocket: "TERIKAT", programId: id, sumberDana: "INTERNAL", coa: "BEBAN_KANTOR", amount: 10 };
    const schema = getSchemas(locale).financeExpenseSchema;
    assert.equal(schema.safeParse(expense).success, true);
    for (const amount of [NaN, Infinity, -Infinity, 0, -1]) assert.equal(schema.safeParse({ ...expense, amount }).success, false);
    assert.equal(schema.safeParse({ ...expense, sumberDana: undefined }).success, false);
    assert.equal(schema.safeParse({ ...expense, sumberDana: "CAMPURAN" }).success, false);
  }
});

test("funding detail renders both source wallets, legacy reservations and expense sources in both languages", async () => {
  const f = await businessFixture();
  try {
    const id = await f.create("CAMPURAN", 300);
    await incomeActions.createFinanceIncome({ ...f.incomeData, programId: id, amount: 200 });
    await f.spend(id, "PENGGALANGAN", 50);
    await f.spend(id, "INTERNAL", 80);
    const wallet = await f.wallet(id);
    for (const locale of ["id", "en"] as const) {
      const tr = createTranslator(locale);
      const html = renderToStaticMarkup(React.createElement(ProgramFundingComposition, { balance: wallet, share: 35, locale }));
      for (const text of ["Komposisi Pendanaan", "Penggalangan Dana", "Dana Internal", "Terpakai / Dicadangkan"]) assert.ok(html.includes(tr(text)), text);
      assert.ok(html.includes(tr("Porsi dana internal: {0}%", { 0: 65 })));
      const legacy = renderToStaticMarkup(React.createElement(ProgramFundingComposition, { balance: await f.wallet("positive"), share: null, locale }));
      assert.ok(legacy.includes(tr("Pengeluaran lama tanpa sumber")));
      const expenses = await f.prisma.financeExpense.findMany({ where: { programId: { in: [id, "positive"] } } });
      const table = renderToStaticMarkup(React.createElement(ProgramExpenseTable, { expenses, locale }));
      for (const text of ["Sumber Dana", "Dana Internal", "Penggalangan Dana", "Belum tercatat (data lama)"]) assert.ok(table.includes(tr(text)), text);
      assert.ok(renderToStaticMarkup(React.createElement(ProgramExpenseTable, { expenses: [], locale })).includes(tr("Belum ada voucher pengeluaran.")));
    }
    assert.equal(expenseFundingSourceLabel({ programId: null, sumberDana: null }), "Dana Tidak Terikat");
    assert.equal(expenseFundingSourceLabel({ programId: id, sumberDana: null }), "Belum tercatat (data lama)");
  } finally { await f.close(); }
});

test("program detail enforces finance access, handles missing programs and scopes expenses without writes", async () => {
  const page = require("../app/(dashboard)/dashboard/finance/programs/[id]/page").default;
  formAuthorized = false;
  const accesses = databaseAccesses;
  await assert.rejects(page({ params: { id: "positive" } }), /redirect:\/dashboard/);
  assert.equal(databaseAccesses, accesses);
  const f = await businessFixture();
  try {
    await assert.rejects(page({ params: { id: "missing" } }), /not-found/);
    const id = await f.create("INTERNAL", 300);
    const expense = await f.spend(id, "INTERNAL", 80);
    const voucher = await f.prisma.financeExpense.findUniqueOrThrow({ where: { id: expense } });
    const before = await snapshot(f.db);
    for (const locale of ["id", "en"] as const) {
      formLocale = locale;
      const html = renderToStaticMarkup(await page({ params: { id } }));
      assert.ok(html.includes(voucher.voucherNumber));
      assert.ok(!html.includes("PV/legacy"));
      assert.ok(html.includes(createTranslator(locale)("Komposisi Pendanaan")));
    }
    assert.deepEqual(await snapshot(f.db), before);
  } finally { await f.close(); }
});
