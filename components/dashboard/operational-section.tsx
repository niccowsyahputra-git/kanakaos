import Link from "next/link";
import {
  Users,
  HeartPulse,
  GraduationCap,
  CalendarX,
  Smile,
  AlertTriangle,
} from "lucide-react";
import { getOperationalData } from "@/lib/dashboard-data";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  EducationDonut,
  MoodTrendChart,
} from "@/components/dashboard/dashboard-charts";
import { getT } from "@/lib/i18n/server";


export async function OperationalSection() {
  const { tr, locale } = await getT();

  const data = await getOperationalData();

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-blue-100 p-1.5 text-blue-700">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold tracking-tight">
            {tr("Operasional Anak")}</h3>
          <p className="text-xs text-muted-foreground">
            {tr("Monitoring & care kondisi riil anak asuh.")}</p>
        </div>
      </div>

      {/* Metrik ringkasan */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {tr("Total Anak Asuh Aktif")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalActive}</div>
            <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                {data.male} {tr(" Laki-laki")}</span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-pink-500" />
                {data.female} {tr(" Perempuan")}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {tr("Anak Sakit Hari Ini")}</CardTitle>
            <HeartPulse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${data.sickToday > 0 ? "text-orange-600" : ""}`}
            >
              {data.sickToday}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.sickToday > 0
                ? tr("Butuh perhatian medis")
                : tr("Semua sehat hari ini")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {tr("Tingkat Pendidikan")}</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <EducationDonut data={data.education} />
          </CardContent>
        </Card>
      </div>

      {/* Widget monitoring harian */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarX className="h-4 w-4 text-amber-600" />
              {tr("Alarm Kehadiran Hari Ini")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.attendanceAlerts.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {tr("Semua anak masuk sekolah/madrasah hari ini. ✅")}</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {data.attendanceAlerts.map((a, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span className="font-medium">{a.childName}</span>
                    <Badge
                      variant="outline"
                      className="border-transparent bg-amber-100 text-amber-800"
                    >
                      {a.reason}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Smile className="h-4 w-4 text-blue-600" />
              {tr("Tren Emosional (7 Hari)")}</CardTitle>
          </CardHeader>
          <CardContent>
            <MoodTrendChart data={data.moodTrend} />
            {data.atRiskChildren.length > 0 && (
              <div className="mt-3 rounded-md bg-red-50 p-3">
                <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-red-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {tr("Perlu konseling personal (murung berturut-turut):")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.atRiskChildren.map((c) => (
                    <Link
                      key={c.id}
                      href={`/dashboard/children/${c.id}`}
                      className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 hover:bg-red-200"
                    >
                      {c.name} ({c.lowCount}×)
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Strategis akademik */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-4 w-4 text-purple-600" />
            {tr("Akan Lulus Tahun Ini")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.graduatingSoon.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {tr("Belum ada anak yang terdeteksi di jenjang akhir. Lengkapi kolom \"kelas\" pada data anak untuk perencanaan beasiswa lanjutan.")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.graduatingSoon.map((c) => (
                <Link
                  key={c.id}
                  href={`/dashboard/children/${c.id}`}
                  className="rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({c.grade})
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
