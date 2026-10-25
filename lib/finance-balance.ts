import { prisma } from "@/lib/prisma";
import { Prisma, type ProgramFundingSource, type ProgramExpenseSource } from "@prisma/client";

export class FundingRuleError extends Error {}

export async function lockFundingWallets(tx: Prisma.TransactionClient) {
  // The libSQL adapter starts deferred transactions. Acquire SQLite's write reservation
  // before any balance reads, including across server instances, without changing rows.
  try {
    await tx.$executeRaw`UPDATE "ProgramInternalAllocation" SET "amount" = "amount" WHERE 1 = 0`;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2010" &&
        ["5", "6", "SQLITE_BUSY", "SQLITE_LOCKED"].includes(String(error.meta?.code))) {
      throw new FundingRuleError("Saldo sedang diperbarui. Muat ulang dan coba lagi.");
    }
    throw error;
  }
}

export function effectiveProgramFundingSource(program: {
  sumberDana: ProgramFundingSource | null;
  fundraisingTarget: number;
}): ProgramFundingSource {
  return program.sumberDana ?? (program.fundraisingTarget > 0 ? "PENGGALANGAN" : "INTERNAL");
}

// Match the separate legacy backfill without changing historical rows on read.
export const fundraisingProgramWhere: Prisma.ProgramWhereInput = {
  OR: [
    { sumberDana: { in: ["PENGGALANGAN", "CAMPURAN"] } },
    { sumberDana: null, fundraisingTarget: { gt: 0 } },
  ],
};

export async function assertFundraisingProgram(db: Prisma.TransactionClient, programId: string) {
  const program = await db.program.findUnique({ where: { id: programId } });
  if (!program) throw new FundingRuleError("Program tidak ditemukan");
  if (effectiveProgramFundingSource(program) === "INTERNAL") {
    throw new FundingRuleError("Program dana internal tidak menerima donasi atau penggalangan dana");
  }
}

/**
 * Utilitas saldo keuangan.
 *
 * Aturan perhitungan:
 * - Pemasukan dihitung hanya yang VERIFIED (dana sudah masuk riil).
 * - Pengeluaran dihitung SEMUA status (dana dianggap teralokasi sejak
 *   voucher dibuat) agar kantong tidak bisa overdraft oleh draft ganda.
 */

// Sum stored amounts in decimal arithmetic: floating-point SQL SUM can create a phantom balance.
function moneyTotals<T extends { amount: number }>(rows: T[], key: (row: T) => string) {
  const totals = new Map<string, Prisma.Decimal>();
  for (const row of rows) {
    const id = key(row);
    totals.set(id, (totals.get(id) ?? new Prisma.Decimal(0)).plus(row.amount));
  }
  return totals;
}

export async function getUnrestrictedBalance(db: Prisma.TransactionClient = prisma): Promise<number> {
  const [income, expense, allocated] = await Promise.all([
    db.financeIncome.findMany({
      select: { amount: true },
      where: { verification: "VERIFIED", restriction: "TIDAK_TERIKAT", programId: null },
    }),
    db.financeExpense.findMany({
      select: { amount: true },
      where: { pocket: "TIDAK_TERIKAT", programId: null },
    }),
    db.programInternalAllocation.findMany({ select: { amount: true } }),
  ]);
  const total = (rows: { amount: number }[]) => moneyTotals(rows, () => "total").get("total") ?? new Prisma.Decimal(0);
  // The transfer reserves general funds once; subsequent program spending does not debit them again.
  return total(income).minus(total(expense)).minus(total(allocated)).toNumber();
}

export type ProgramBalance = {
  id: string;
  code: string;
  name: string;
  status: string;
  sumberDana: ProgramFundingSource;
  balance: number;
  fundraising: { received: number; used: number; balance: number };
  internal: { received: number; used: number; balance: number };
  legacyReserved: number;
};

export async function getProgramBalances(
  db: Prisma.TransactionClient = prisma,
  programId?: string,
): Promise<ProgramBalance[]> {
  const where = { programId: programId ?? { not: null } };
  const [programs, incomes, expenses, allocations] = await Promise.all([
    db.program.findMany({
      where: programId ? { id: programId } : undefined,
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, status: true, sumberDana: true, fundraisingTarget: true },
    }),
    db.financeIncome.findMany({
      select: { programId: true, amount: true },
      where: { ...where, verification: "VERIFIED" },
    }),
    db.financeExpense.findMany({
      select: { programId: true, sumberDana: true, amount: true }, where,
    }),
    db.programInternalAllocation.findMany({
      select: { programId: true, amount: true },
      where: programId ? { programId } : undefined,
    }),
  ]);

  const incomeMap = moneyTotals(incomes, i => i.programId!);
  const allocationMap = moneyTotals(allocations, a => a.programId);
  const expenseMap = moneyTotals(expenses, e => `${e.programId}:${e.sumberDana ?? "legacy"}`);

  return programs.map(p => {
    const received = incomeMap.get(p.id)?.toNumber() ?? 0;
    const allocated = allocationMap.get(p.id)?.toNumber() ?? 0;
    const fundraisingUsed = expenseMap.get(`${p.id}:PENGGALANGAN`)?.toNumber() ?? 0;
    const internalUsed = expenseMap.get(`${p.id}:INTERNAL`)?.toNumber() ?? 0;
    const legacyReserved = expenseMap.get(`${p.id}:legacy`)?.toNumber() ?? 0;
    // Unsourced historical vouchers still reserve the old receipt-funded wallet.
    // Keep them separate from explicit source usage; never backfill a guessed source.
    const fundraisingBalance = new Prisma.Decimal(received).minus(fundraisingUsed).minus(legacyReserved).toNumber();
    const internalBalance = new Prisma.Decimal(allocated).minus(internalUsed).toNumber();
    return {
      id: p.id, code: p.code, name: p.name, status: p.status,
      sumberDana: effectiveProgramFundingSource(p),
      fundraising: { received, used: fundraisingUsed, balance: fundraisingBalance },
      internal: { received: allocated, used: internalUsed, balance: internalBalance },
      legacyReserved,
      balance: new Prisma.Decimal(fundraisingBalance).plus(internalBalance).toNumber(),
    };
  });
}

// Call inside the same database transaction that inserts the expense reservation.
export async function assertExpenseFunding(db: Prisma.TransactionClient, expense: {
  pocket: "TIDAK_TERIKAT" | "TERIKAT";
  programId?: string;
  sumberDana?: ProgramExpenseSource;
  amount: number;
}) {
  if (expense.pocket === "TIDAK_TERIKAT") {
    if (expense.programId || expense.sumberDana) throw new FundingRuleError("Sumber dana program memerlukan kantong program");
    if (expense.amount > await getUnrestrictedBalance(db)) {
      throw new FundingRuleError("Saldo dana tidak terikat tidak cukup");
    }
    return;
  }
  if (!expense.programId || !expense.sumberDana) throw new FundingRuleError("Pilih sumber dana pengeluaran program");
  const [program] = await getProgramBalances(db, expense.programId);
  if (!program) throw new FundingRuleError("Program tidak ditemukan");
  if (program.sumberDana !== "CAMPURAN" && program.sumberDana !== expense.sumberDana) {
    throw new FundingRuleError("Sumber dana tidak diizinkan untuk program ini");
  }
  const balance = expense.sumberDana === "INTERNAL" ? program.internal.balance : program.fundraising.balance;
  if (expense.amount > balance) throw new FundingRuleError("Saldo sumber dana program tidak cukup");
}

export type AccountBalance = { id: string; name: string; balance: number };

export async function getAccountBalances(): Promise<AccountBalance[]> {
  const [accounts, incomes, expenses] = await Promise.all([
    prisma.cashAccount.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.financeIncome.groupBy({
      by: ["accountId"],
      _sum: { amount: true },
      where: { verification: "VERIFIED", accountId: { not: null } },
    }),
    prisma.financeExpense.groupBy({
      by: ["accountId"],
      _sum: { amount: true },
    }),
  ]);

  const incomeMap = new Map(
    incomes.map((i) => [i.accountId, i._sum.amount ?? 0])
  );
  const expenseMap = new Map(
    expenses.map((e) => [e.accountId, e._sum.amount ?? 0])
  );

  return accounts.map((a) => ({
    id: a.id,
    name: a.name,
    balance:
      a.openingBalance +
      (incomeMap.get(a.id) ?? 0) -
      (expenseMap.get(a.id) ?? 0),
  }));
}

/** Nomor urut otomatis: PREFIX/YYS/YYYY/MM/XXX */
export async function nextDocNumber(
  prefix: "KM" | "PV",
  count: number
): Promise<string> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${prefix}/YYS/${yyyy}/${mm}/${String(count + 1).padStart(3, "0")}`;
}
