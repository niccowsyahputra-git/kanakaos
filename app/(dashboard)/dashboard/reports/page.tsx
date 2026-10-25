import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminSession } from "@/lib/auth-guard";
import { formatRupiah } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, HandCoins, Wallet, UserCheck } from "lucide-react";
import {
  DonationChart,
  type MonthlyDonationPoint,
} from "@/components/reports/donation-chart";
import { ReportButtons } from "@/components/reports/report-buttons";
import { getT } from "@/lib/i18n/server";


export const dynamic = "force-dynamic";

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

export default async function ReportsPage() {
  const { tr, locale } = await getT();

  const session = await requireSuperAdminSession();
  if (!session) redirect("/dashboard");

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [totalChildren, donationsYtd, activeVolunteers] = await Promise.all([
    prisma.child.count({ where: { status: "ACTIVE" } }),
    prisma.donation.findMany({
      where: { createdAt: { gte: yearStart } },
      select: { amount: true, createdAt: true },
    }),
    prisma.volunteer.count({ where: { status: "APPROVED" } }),
  ]);

  const totalDonationYtd = donationsYtd.reduce(
    (sum, d) => sum + Number(d.amount),
    0
  );

  // Agregasi donasi per bulan tahun berjalan untuk grafik
  const monthlyTotals = new Array(12).fill(0);
  for (const donation of donationsYtd) {
    monthlyTotals[donation.createdAt.getMonth()] += Number(donation.amount);
  }
  const chartData: MonthlyDonationPoint[] = MONTH_SHORT.map((month, i) => ({
    month: new Date(now.getFullYear(), i, 1).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", { month: "short" }),
    total: monthlyTotals[i],
  }));

  const stats = [
    {
      title: tr("Total Anak Asuh"),
      value: String(totalChildren),
      description: tr("Anak berstatus aktif"),
      icon: Users,
    },
    {
      title: tr("Total Donasi YTD"),
      value: formatRupiah(totalDonationYtd, locale),
      description: tr("{0} transaksi tahun {1}", { "0": donationsYtd.length, "1": now.getFullYear() }),
      icon: HandCoins,
    },
    {
      title: tr("Total Pengeluaran YTD"),
      value: formatRupiah(0, locale),
      description: tr("Modul keuangan menyusul di fase berikutnya"),
      icon: Wallet,
    },
    {
      title: tr("Relawan Aktif"),
      value: String(activeVolunteers),
      description: tr("Relawan berstatus approved"),
      icon: UserCheck,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{tr("Laporan")}</h2>
        <p className="text-sm text-muted-foreground">
          {tr("Ringkasan kinerja yayasan tahun ")}{now.getFullYear()}.
        </p>
      </div>

      {/* Card ringkasan */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold md:text-2xl">
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

      {/* Grafik donasi bulanan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {tr("Donasi Bulanan ")}{now.getFullYear()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DonationChart data={chartData} />
        </CardContent>
      </Card>

      {/* Generate laporan PDF */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{tr("Unduh Laporan PDF")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportButtons />
        </CardContent>
      </Card>
    </div>
  );
}
