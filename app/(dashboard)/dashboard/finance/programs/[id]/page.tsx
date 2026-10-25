import React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireFinanceSession } from "@/lib/auth-guard";
import { getProgramBalances } from "@/lib/finance-balance";
import { getT } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRupiah, leftoverRuleLabel, programStatusLabel } from "@/components/finance/finance-labels";
import { ProgramExpenseTable, ProgramFundingComposition } from "@/components/finance/program-funding-detail";

export const dynamic = "force-dynamic";

export default async function ProgramDetailPage({ params }: { params: { id: string } }) {
  const session = await requireFinanceSession();
  if (!session) redirect("/dashboard");
  const { tr, locale } = await getT();
  const program = await prisma.program.findUnique({ where: { id: params.id } });
  if (!program) notFound();
  const [[balance], expenses] = await Promise.all([
    getProgramBalances(prisma, program.id),
    prisma.financeExpense.findMany({
      where: { programId: program.id }, orderBy: { date: "desc" },
      select: { id: true, voucherNumber: true, date: true, amount: true, approval: true, programId: true, sumberDana: true },
    }),
  ]);
  if (!balance) notFound();
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm"><Link href="/dashboard/finance/programs"><ArrowLeft className="h-4 w-4" />{tr("Program")}</Link></Button>
      <div className="space-y-2">
        <p className="font-mono text-sm text-muted-foreground">{program.code}</p>
        <h2 className="text-2xl font-bold tracking-tight">{program.name}</h2>
        <Badge variant="outline">{tr(programStatusLabel[program.status])}</Badge>
        {program.description && <p className="whitespace-pre-wrap text-sm">{program.description}</p>}
        <p className="text-sm">{tr("Anggaran Biaya Maksimal (Rp)")}: {formatRupiah(program.maxBudget, locale)}</p>
        <p className="text-sm">{tr("Aturan Sisa Dana")}: {tr(leftoverRuleLabel[program.leftoverRule])}</p>
      </div>
      <ProgramFundingComposition balance={balance} share={program.porsiPenggalangan} locale={locale} />
      <ProgramExpenseTable expenses={expenses} locale={locale} />
    </div>
  );
}
