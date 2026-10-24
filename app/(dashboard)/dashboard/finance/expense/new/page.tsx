import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireFinanceSession } from "@/lib/auth-guard";
import {
  getAccountBalances,
  getProgramBalances,
  getUnrestrictedBalance,
} from "@/lib/finance-balance";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ExpenseForm } from "@/components/finance/expense-form";

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  const session = await requireFinanceSession();
  if (!session) redirect("/dashboard");

  const [accounts, programBalances, unrestrictedBalance, children] =
    await Promise.all([
      getAccountBalances(),
      getProgramBalances(),
      getUnrestrictedBalance(),
      prisma.child.findMany({
        where: { status: "ACTIVE" },
        orderBy: { fullName: "asc" },
        select: { id: true, fullName: true },
      }),
    ]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/dashboard/finance/expense">
          <ArrowLeft className="h-4 w-4" />
          Daftar Kas Keluar
        </Link>
      </Button>
      <ExpenseForm
        accounts={accounts}
        programs={programBalances.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          balance: p.balance,
        }))}
        childrenOptions={children}
        unrestrictedBalance={unrestrictedBalance}
      />
    </div>
  );
}
