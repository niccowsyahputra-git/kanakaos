import { redirect } from "next/navigation";
import { Prisma, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireFinanceSession } from "@/lib/auth-guard";
import { formatRupiah } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Paperclip } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ExportTransactionsButton } from "@/components/finance/transaction-dialog";
import { TransactionFilters } from "@/components/finance/transaction-filters";
import { getT } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";


export const dynamic = "force-dynamic";

function formatDate(date: Date, locale: Locale = "id") {
  const tr = createTranslator(locale);

  return new Intl.DateTimeFormat((locale === "en" ? "en-US" : "id-ID"), { dateStyle: "medium" }).format(
    date
  );
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: {
    type?: string;
    categoryId?: string;
    from?: string;
    to?: string;
  };
}) {
  const { tr, locale } = await getT();

  const session = await requireFinanceSession();
  if (!session) redirect("/dashboard");

  const typeFilter = Object.values(TransactionType).includes(
    searchParams.type as TransactionType
  )
    ? (searchParams.type as TransactionType)
    : undefined;

  const fromDate =
    searchParams.from && !Number.isNaN(Date.parse(searchParams.from))
      ? new Date(searchParams.from)
      : undefined;
  const toDate =
    searchParams.to && !Number.isNaN(Date.parse(searchParams.to))
      ? new Date(new Date(searchParams.to).setHours(23, 59, 59, 999))
      : undefined;

  const where: Prisma.TransactionWhereInput = {
    ...(typeFilter && { type: typeFilter }),
    ...(searchParams.categoryId && { categoryId: searchParams.categoryId }),
    ...((fromDate || toDate) && {
      date: {
        ...(fromDate && { gte: fromDate }),
        ...(toDate && { lte: toDate }),
      },
    }),
  };

  const [allTransactions, categories] = await Promise.all([
    // Ambil semua (ascending) untuk hitung saldo berjalan yang akurat,
    // filter diterapkan setelah saldo dihitung
    prisma.transaction.findMany({
      include: { category: { select: { name: true } } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    prisma.financeCategory.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Saldo berjalan dihitung dari SEMUA transaksi (bukan hasil filter),
  // agar kolom "saldo setelah transaksi" selalu benar
  let running = 0;
  const withBalance = allTransactions.map((transaction) => {
    const amount = Number(transaction.amount);
    running += transaction.type === "DEBIT" ? amount : -amount;
    return { ...transaction, balanceAfter: running };
  });

  // Terapkan filter untuk tampilan (urut terbaru dulu)
  const visible = withBalance
    .filter((transaction) => {
      if (typeFilter && transaction.type !== typeFilter) return false;
      if (
        searchParams.categoryId &&
        transaction.categoryId !== searchParams.categoryId
      )
        return false;
      if (fromDate && transaction.date < fromDate) return false;
      if (toDate && transaction.date > toDate) return false;
      return true;
    })
    .reverse();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{tr("Transaksi Kas")}</h2>
          <p className="text-sm text-muted-foreground">
            {visible.length} {tr(" transaksi ditampilkan · saldo akhir")}{" "}
            <span className="font-semibold text-foreground">
              {formatRupiah(running, locale)}
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <ExportTransactionsButton />
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashboard/finance/income/new">{tr("Catat Kas Masuk")}</Link>
          </Button>
          <Button asChild variant="secondary" className="w-full sm:w-auto">
            <Link href="/dashboard/finance/expense/new">{tr("Buat Voucher Keluar")}</Link>
          </Button>
        </div>
      </div>

      <TransactionFilters categories={categories} />

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {tr("Tidak ada transaksi untuk filter ini.")}</CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {visible.map((transaction) => (
              <Card key={transaction.id}>
                <CardContent className="space-y-1.5 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-sm font-medium">
                      {transaction.description}
                    </p>
                    <span
                      className={`shrink-0 text-sm font-bold ${
                        transaction.type === "DEBIT"
                          ? "text-green-600"
                          : "text-destructive"
                      }`}
                    >
                      {transaction.type === "DEBIT" ? "+" : "−"}
                      {formatRupiah(Number(transaction.amount), locale)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDate(transaction.date, locale)}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {transaction.category.name}
                    </Badge>
                    {transaction.proofUrl && (
                      <a
                        href={transaction.proofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-primary"
                      >
                        <Paperclip className="h-3 w-3" />
                        {tr("bukti")}</a>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tr("Saldo: ")}{formatRupiah(transaction.balanceAfter, locale)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr("Tanggal")}</TableHead>
                  <TableHead>{tr("Deskripsi")}</TableHead>
                  <TableHead>{tr("Kategori")}</TableHead>
                  <TableHead className="text-right">{tr("Kas Masuk")}</TableHead>
                  <TableHead className="text-right">{tr("Kas Keluar")}</TableHead>
                  <TableHead className="text-right">{tr("Saldo")}</TableHead>
                  <TableHead>{tr("Bukti")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(transaction.date, locale)}
                    </TableCell>
                    <TableCell className="max-w-xs font-medium">
                      {transaction.description}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {transaction.category.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {transaction.type === "DEBIT"
                        ? formatRupiah(Number(transaction.amount), locale)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      {transaction.type === "CREDIT"
                        ? formatRupiah(Number(transaction.amount), locale)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatRupiah(transaction.balanceAfter, locale)}
                    </TableCell>
                    <TableCell>
                      {transaction.proofUrl ? (
                        <a
                          href={transaction.proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Paperclip className="h-3 w-3" />
                          {tr("Lihat")}</a>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
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
