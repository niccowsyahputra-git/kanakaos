import Link from "next/link";
import {
  Wallet,
  Gauge,
  PieChart as PieIcon,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { getFinancialData } from "@/lib/dashboard-data";
import { formatRupiah } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FundAllocationPie,
  CashflowTrendChart,
} from "@/components/dashboard/dashboard-charts";
import { getT } from "@/lib/i18n/server";


export async function FinancialSection() {
  const { tr, locale } = await getT();

  const data = await getFinancialData();

  // Ambang alarm runway
  const runwayAlert =
    data.runwayMonths !== null && data.runwayMonths < 3;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-green-100 p-1.5 text-green-700">
          <Wallet className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold tracking-tight">
            {tr("Finansial Strategis")}</h3>
          <p className="text-xs text-muted-foreground">
            {tr("Kesehatan napas keuangan jangka panjang yayasan.")}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Runway */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {tr("Rasio Kesehatan Kas (Cash Runway)")}</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">
                {tr("Sisa Dana Tidak Terikat (Operasional)")}</p>
              <p className="text-2xl font-bold text-green-600">
                {formatRupiah(data.unrestrictedBalance, locale)}
              </p>
            </div>
            <div
              className={`rounded-md p-3 ${
                runwayAlert ? "bg-red-50" : "bg-muted/60"
              }`}
            >
              {data.runwayMonths === null ? (
                <p className="text-sm text-muted-foreground">
                  {tr("Belum ada data pengeluaran operasional untuk menghitung runway.")}</p>
              ) : (
                <>
                  <p className="text-sm">
                    {tr("Kas operasional cukup untuk")}{" "}
                    <span
                      className={`font-bold ${runwayAlert ? "text-red-600" : "text-foreground"}`}
                    >
                      {data.runwayMonths.toLocaleString((locale === "en" ? "en-US" : "id-ID"))} {tr(" bulan")}</span>{" "}
                    {tr("ke depan.")}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {tr("Rata-rata pengeluaran")}{" "}
                    {formatRupiah(data.avgMonthlyExpense, locale)}{tr("/bulan.")}</p>
                  {runwayAlert && (
                    <p className="mt-2 flex items-center gap-1 text-xs font-medium text-red-700">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {tr("Alarm: saatnya menggenjot kampanye donasi operasional baru!")}</p>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alokasi dompet dana */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {tr("Alokasi Dompet Dana")}</CardTitle>
            <PieIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <FundAllocationPie
              restricted={data.restrictedTotal}
              unrestricted={data.unrestrictedTotal}
            />
            {data.unrestrictedTotal < data.restrictedTotal &&
              data.restrictedTotal > 0 && (
                <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
                  {tr("Dana terikat mendominasi sementara kas umum menipis — sinyal untuk mengarahkan kampanye ke \"Sedekah Operasional Panti\".")}</p>
              )}
          </CardContent>
        </Card>
      </div>

      {/* Tren arus kas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            {tr("Tren Arus Kas ")}{new Date().getFullYear()}
          </CardTitle>
          <Link
            href="/dashboard/finance/overview"
            className="text-xs text-primary hover:underline"
          >
            {tr("Detail keuangan →")}</Link>
        </CardHeader>
        <CardContent>
          <CashflowTrendChart data={data.cashflow} />
        </CardContent>
      </Card>
    </section>
  );
}
