import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireFinanceSession } from "@/lib/auth-guard";
import { formatRupiah } from "@/lib/utils";
import {
  getAccountBalances,
  getUnrestrictedBalance,
} from "@/lib/finance-balance";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ArrowRight,
} from "lucide-react";
import {
  CashflowChart,
  type CashflowPoint,
} from "@/components/finance/cashflow-chart";
import { getT } from "@/lib/i18n/server";


export const dynamic = "force-dynamic";

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

export default async function FinanceOverviewPage() {
  const { tr, locale } = await getT();

  const session = await requireFinanceSession();
  if (!session) redirect("/dashboard");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  // Sumber data konsisten dengan modul Kas Masuk/Keluar & dashboard:
  // - Pemasukan dihitung yang sudah VERIFIED (dana riil).
  // - Pengeluaran dihitung semua status (dana teralokasi sejak voucher dibuat).
  const [accountBalances, unrestrictedBalance, incomes, expenses, pendingAgg] =
    await Promise.all([
      getAccountBalances(),
      getUnrestrictedBalance(),
      prisma.financeIncome.findMany({
        where: { verification: "VERIFIED", date: { gte: yearStart } },
        select: { date: true, amount: true },
      }),
      prisma.financeExpense.findMany({
        where: { date: { gte: yearStart } },
        select: { date: true, amount: true },
      }),
      prisma.financeIncome.aggregate({
        where: { verification: "PENDING" },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

  const saldoKas = accountBalances.reduce((sum, a) => sum + a.balance, 0);

  let kasMasukBulanIni = 0;
  let kasKeluarBulanIni = 0;
  const monthlyIn = new Array(12).fill(0);
  const monthlyOut = new Array(12).fill(0);

  for (const income of incomes) {
    monthlyIn[income.date.getMonth()] += income.amount;
    if (income.date >= monthStart) kasMasukBulanIni += income.amount;
  }
  for (const expense of expenses) {
    monthlyOut[expense.date.getMonth()] += expense.amount;
    if (expense.date >= monthStart) kasKeluarBulanIni += expense.amount;
  }

  const pendingSum = pendingAgg._sum.amount ?? 0;

  const chartData: CashflowPoint[] = MONTH_SHORT.map((month, i) => ({
    month,
    masuk: monthlyIn[i],
    keluar: monthlyOut[i],
  }));

  const stats = [
    {
      title: tr("Saldo Kas (Semua Rekening)"),
      value: formatRupiah(saldoKas, locale),
      description: tr("{0} rekening aktif", { "0": accountBalances.length }),
      icon: Wallet,
      accent: saldoKas >= 0 ? "text-green-600" : "text-destructive",
    },
    {
      title: tr("Kas Masuk Bulan Ini"),
      value: formatRupiah(kasMasukBulanIni, locale),
      description: tr("Pemasukan terverifikasi"),
      icon: TrendingUp,
      accent: "text-green-600",
    },
    {
      title: tr("Kas Keluar Bulan Ini"),
      value: formatRupiah(kasKeluarBulanIni, locale),
      description: tr("Semua voucher pengeluaran"),
      icon: TrendingDown,
      accent: "text-destructive",
    },
    {
      title: tr("Dana Tidak Terikat"),
      value: formatRupiah(unrestrictedBalance, locale),
      description: tr("Kas operasional umum"),
      icon: PiggyBank,
      accent: unrestrictedBalance >= 0 ? "text-green-600" : "text-destructive",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {tr("Ringkasan Keuangan")}</h2>
          <p className="text-sm text-muted-foreground">
            {tr("Posisi kas dan arus keuangan tahun ")}{now.getFullYear()}.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashboard/finance/income">{tr("Kas Masuk (Debit)")}</Link>
          </Button>
          <Button asChild className="w-full sm:w-auto" variant="secondary">
            <Link href="/dashboard/finance/expense">{tr("Kas Keluar (Kredit)")}</Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/dashboard/finance/programs">{tr("Program")}</Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/dashboard/finance/transactions">
              {tr("Detail Transaksi")}<ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {pendingAgg._count > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {tr("Ada ")}<b>{pendingAgg._count}</b> {tr(" pemasukan menunggu verifikasi senilai")}{" "}
          <b>{formatRupiah(pendingSum, locale)}</b> {tr(" — belum dihitung sebagai kas masuk riil.")}{" "}
          <Link
            href="/dashboard/finance/income"
            className="font-medium underline"
          >
            {tr("Verifikasi sekarang")}</Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.accent}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-xl font-bold md:text-2xl ${stat.accent}`}>
                  {stat.value}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Rincian saldo per rekening */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{tr("Saldo per Rekening")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y">
            {accountBalances.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span>{a.name}</span>
                <span
                  className={`font-semibold ${a.balance >= 0 ? "" : "text-destructive"}`}
                >
                  {formatRupiah(a.balance, locale)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {tr("Arus Kas Bulanan ")}{now.getFullYear()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CashflowChart data={chartData} />
        </CardContent>
      </Card>
    </div>
  );
}
