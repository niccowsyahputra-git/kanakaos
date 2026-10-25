import React from "react";
import type { FinanceExpense } from "@prisma/client";
import type { ProgramBalance } from "@/lib/finance-balance";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { approvalShortLabel, expenseFundingSourceLabel, formatRupiah, programFundingSourceLabel } from "./finance-labels";

export function ProgramFundingComposition({ balance, share, locale }: {
  balance: ProgramBalance;
  share: number | null;
  locale: Locale;
}) {
  const tr = createTranslator(locale);
  const percent = (value: number) => new Intl.NumberFormat(locale === "en" ? "en-US" : "id-ID", { maximumFractionDigits: 2 }).format(value);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr("Komposisi Pendanaan")}</CardTitle>
        <p className="text-sm text-muted-foreground">{tr(programFundingSourceLabel[balance.sumberDana])}</p>
        {balance.sumberDana === "CAMPURAN" && share !== null && (
          <p className="text-sm">{tr("Porsi Penggalangan (%)")}: {percent(share)} · {tr("Porsi dana internal: {0}%", { 0: percent(100 - share) })}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{tr("Sumber Dana")}</TableHead>
            <TableHead className="text-right">{tr("Dana Masuk / Alokasi")}</TableHead>
            <TableHead className="text-right">{tr("Terpakai / Dicadangkan")}</TableHead>
            <TableHead className="text-right">{tr("Sisa Saldo")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {([ ["PENGGALANGAN", balance.fundraising], ["INTERNAL", balance.internal] ] as const).map(([source, wallet]) => (
              <TableRow key={source}>
                <TableCell>{tr(programFundingSourceLabel[source])}</TableCell>
                <TableCell className="text-right">{formatRupiah(wallet.received, locale)}</TableCell>
                <TableCell className="text-right">{formatRupiah(wallet.used, locale)}</TableCell>
                <TableCell className="text-right">{formatRupiah(wallet.balance, locale)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-sm font-medium">{tr("Saldo Dana Program")}: {formatRupiah(balance.balance, locale)}</p>
        <p className="text-xs text-muted-foreground">{tr("Semua status pengeluaran mencadangkan saldo sejak voucher dibuat.")}</p>
        {balance.legacyReserved !== 0 && (
          <p className="text-sm text-muted-foreground">
            {tr("Pengeluaran lama tanpa sumber")}: {formatRupiah(balance.legacyReserved, locale)}. {tr("Tetap mengurangi saldo penggalangan lama; sumber historis tidak diasumsikan.")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

type ExpenseRow = Pick<FinanceExpense, "id" | "voucherNumber" | "date" | "amount" | "approval" | "programId" | "sumberDana">;

export function ProgramExpenseTable({ expenses, locale }: { expenses: ExpenseRow[]; locale: Locale }) {
  const tr = createTranslator(locale);
  const date = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "id-ID", { dateStyle: "medium" });
  return (
    <Card>
      <CardHeader><CardTitle>{tr("Pengeluaran Program")}</CardTitle></CardHeader>
      <CardContent>
        {expenses.length === 0 ? <p className="text-sm text-muted-foreground">{tr("Belum ada voucher pengeluaran.")}</p> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>{tr("No. Voucher")}</TableHead><TableHead>{tr("Tanggal")}</TableHead>
              <TableHead>{tr("Sumber Dana")}</TableHead><TableHead className="text-right">{tr("Nilai")}</TableHead>
              <TableHead>{tr("Status")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>{expenses.map(expense => (
              <TableRow key={expense.id}>
                <TableCell className="font-mono text-xs">{expense.voucherNumber}</TableCell>
                <TableCell>{date.format(expense.date)}</TableCell>
                <TableCell>{tr(expenseFundingSourceLabel(expense))}</TableCell>
                <TableCell className="text-right">{formatRupiah(expense.amount, locale)}</TableCell>
                <TableCell>{tr(approvalShortLabel[expense.approval])}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
