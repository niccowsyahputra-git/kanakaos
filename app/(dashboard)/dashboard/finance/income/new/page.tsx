import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireFinanceSession } from "@/lib/auth-guard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { IncomeForm } from "@/components/finance/income-form";

export const dynamic = "force-dynamic";

export default async function NewIncomePage() {
  const session = await requireFinanceSession();
  if (!session) redirect("/dashboard");

  const [donors, programs, accounts] = await Promise.all([
    prisma.donor.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.program.findMany({
      where: { status: { in: ["AKTIF", "PENYALURAN", "DRAFT"] } },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.cashAccount.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/dashboard/finance/income">
          <ArrowLeft className="h-4 w-4" />
          Daftar Kas Masuk
        </Link>
      </Button>
      <IncomeForm
        donorOptions={donors}
        programOptions={programs}
        accountOptions={accounts}
      />
    </div>
  );
}
