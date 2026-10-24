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
import { ArrowLeft, Plus, FileText } from "lucide-react";
import { ExpenseWorkflowButtons } from "@/components/finance/expense-workflow-buttons";
import {
  expenseCoaLabel,
  approvalShortLabel,
  approvalClass,
  formatRupiah,
} from "@/components/finance/finance-labels";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    date
  );
}

export default async function ExpenseListPage() {
  const session = await requireFinanceSession();
  if (!session) redirect("/dashboard");

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";

  const expenses = await prisma.financeExpense.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      account: { select: { name: true } },
      program: { select: { code: true, name: true } },
      beneficiaryChild: { select: { fullName: true } },
    },
  });

  const waiting = expenses.filter(
    (e) => e.approval !== "SELESAI"
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
            Kas Keluar (Kredit)
          </h2>
          <p className="text-sm text-muted-foreground">
            {expenses.length} voucher · {waiting} dalam proses persetujuan.
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/dashboard/finance/expense/new">
            <Plus className="h-4 w-4" />
            Buat Voucher Keluar
          </Link>
        </Button>
      </div>

      {expenses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Belum ada voucher pengeluaran.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile */}
          <div className="flex flex-col gap-3 md:hidden">
            {expenses.map((expense) => (
              <Card key={expense.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-muted-foreground">
                        {expense.voucherNumber}
                      </p>
                      <p className="truncate font-semibold">
                        {expenseCoaLabel[expense.coa]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(expense.date)} · {expense.account.name}
                        {expense.program ? ` · ${expense.program.name}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold text-red-600">
                      {formatRupiah(expense.amount)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={approvalClass[expense.approval]}
                    >
                      {approvalShortLabel[expense.approval]}
                    </Badge>
                    {(expense.beneficiaryChild || expense.beneficiaryName) && (
                      <span className="text-xs text-muted-foreground">
                        Penerima:{" "}
                        {expense.beneficiaryChild?.fullName ??
                          expense.beneficiaryName}
                      </span>
                    )}
                  </div>
                  <ExpenseWorkflowButtons
                    expenseId={expense.id}
                    approval={expense.approval}
                    isSuperAdmin={isSuperAdmin}
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Voucher</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Rekening</TableHead>
                  <TableHead>Kantong Dana</TableHead>
                  <TableHead>Kategori (COA)</TableHead>
                  <TableHead>Penerima</TableHead>
                  <TableHead className="text-right">Nilai</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {expense.voucherNumber}
                      {expense.proofUrl && (
                        <a
                          href={expense.proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <FileText className="h-3 w-3" />
                          Bukti
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDate(expense.date)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {expense.account.name}
                    </TableCell>
                    <TableCell className="text-sm">
                      {expense.pocket === "TIDAK_TERIKAT" ? (
                        "Dana Tidak Terikat"
                      ) : (
                        <span>
                          Dana Terikat
                          {expense.program && (
                            <span className="block text-xs text-muted-foreground">
                              {expense.program.code} {expense.program.name}
                            </span>
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {expenseCoaLabel[expense.coa]}
                    </TableCell>
                    <TableCell className="text-sm">
                      {expense.beneficiaryChild?.fullName ??
                        expense.beneficiaryName ??
                        "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium text-red-600">
                      {formatRupiah(expense.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={approvalClass[expense.approval]}
                      >
                        {approvalShortLabel[expense.approval]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <ExpenseWorkflowButtons
                        expenseId={expense.id}
                        approval={expense.approval}
                        isSuperAdmin={isSuperAdmin}
                      />
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
