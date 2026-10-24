import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireFinanceSession } from "@/lib/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus } from "lucide-react";
import { IncomeVerifyButtons } from "@/components/finance/income-verify-buttons";
import {
  incomeFundCategoryLabel,
  fundRestrictionLabel,
  incomeMethodLabel,
  verificationShortLabel,
  verificationClass,
  formatRupiah,
} from "@/components/finance/finance-labels";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    date
  );
}

export default async function IncomeListPage() {
  const session = await requireFinanceSession();
  if (!session) redirect("/dashboard");

  const incomes = await prisma.financeIncome.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      program: { select: { code: true, name: true } },
      donor: { select: { name: true } },
    },
  });

  const pendingCount = incomes.filter(
    (i) => i.verification === "PENDING"
  ).length;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/dashboard/finance">
          <ArrowLeft className="h-4 w-4" />
          Keuangan
        </Link>
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Kas Masuk (Debit)
          </h2>
          <p className="text-sm text-muted-foreground">
            {incomes.length} pemasukan · {pendingCount} menunggu verifikasi.
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/dashboard/finance/income/new">
            <Plus className="h-4 w-4" />
            Catat Kas Masuk
          </Link>
        </Button>
      </div>

      {incomes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Belum ada pemasukan tercatat.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile */}
          <div className="flex flex-col gap-3 md:hidden">
            {incomes.map((income) => (
              <Card key={income.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-muted-foreground">
                        {income.refNumber}
                      </p>
                      <p className="truncate font-semibold">
                        {income.sourceName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(income.date)} ·{" "}
                        {incomeFundCategoryLabel[income.fundCategory]}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold text-green-600">
                      {formatRupiah(income.amount)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={verificationClass[income.verification]}
                    >
                      {verificationShortLabel[income.verification]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {fundRestrictionLabel[income.restriction]}
                      {income.program ? ` → ${income.program.name}` : ""}
                    </span>
                  </div>
                  {income.verification === "PENDING" && (
                    <IncomeVerifyButtons incomeId={income.id} />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Ref</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Donatur/Sumber</TableHead>
                  <TableHead>Kategori Dana</TableHead>
                  <TableHead>Keterikatan</TableHead>
                  <TableHead>Metode</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomes.map((income) => (
                  <TableRow key={income.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {income.refNumber}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDate(income.date)}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{income.sourceName}</span>
                      {income.donor && (
                        <span className="block text-xs text-muted-foreground">
                          profil terdaftar
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {incomeFundCategoryLabel[income.fundCategory]}
                    </TableCell>
                    <TableCell className="text-sm">
                      {fundRestrictionLabel[income.restriction]}
                      {income.program && (
                        <span className="block text-xs text-muted-foreground">
                          → {income.program.code} {income.program.name}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {incomeMethodLabel[income.method]}
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      {formatRupiah(income.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={verificationClass[income.verification]}
                      >
                        {verificationShortLabel[income.verification]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {income.verification === "PENDING" ? (
                        <div className="flex justify-end">
                          <IncomeVerifyButtons incomeId={income.id} />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
