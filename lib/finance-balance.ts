import { prisma } from "@/lib/prisma";

/**
 * Utilitas saldo keuangan.
 *
 * Aturan perhitungan:
 * - Pemasukan dihitung hanya yang VERIFIED (dana sudah masuk riil).
 * - Pengeluaran dihitung SEMUA status (dana dianggap teralokasi sejak
 *   voucher dibuat) agar kantong tidak bisa overdraft oleh draft ganda.
 */

export async function getUnrestrictedBalance(): Promise<number> {
  const [income, expense] = await Promise.all([
    prisma.financeIncome.aggregate({
      _sum: { amount: true },
      where: { verification: "VERIFIED", restriction: "TIDAK_TERIKAT" },
    }),
    prisma.financeExpense.aggregate({
      _sum: { amount: true },
      where: { pocket: "TIDAK_TERIKAT" },
    }),
  ]);
  return (income._sum.amount ?? 0) - (expense._sum.amount ?? 0);
}

export type ProgramBalance = {
  id: string;
  code: string;
  name: string;
  status: string;
  balance: number;
};

export async function getProgramBalances(): Promise<ProgramBalance[]> {
  const [programs, incomes, expenses] = await Promise.all([
    prisma.program.findMany({
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, status: true },
    }),
    prisma.financeIncome.groupBy({
      by: ["programId"],
      _sum: { amount: true },
      where: { verification: "VERIFIED", programId: { not: null } },
    }),
    prisma.financeExpense.groupBy({
      by: ["programId"],
      _sum: { amount: true },
      where: { programId: { not: null } },
    }),
  ]);

  const incomeMap = new Map(
    incomes.map((i) => [i.programId, i._sum.amount ?? 0])
  );
  const expenseMap = new Map(
    expenses.map((e) => [e.programId, e._sum.amount ?? 0])
  );

  return programs.map((p) => ({
    ...p,
    balance: (incomeMap.get(p.id) ?? 0) - (expenseMap.get(p.id) ?? 0),
  }));
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
