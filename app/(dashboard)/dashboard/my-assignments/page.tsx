import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClipboardPlus, History } from "lucide-react";
import { AssignCaregiverSelect } from "@/components/assignments/assign-caregiver-select";
import { getT } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";


export const dynamic = "force-dynamic";

const moodEmoji: Record<number, string> = {
  1: "😢",
  2: "😟",
  3: "😐",
  4: "🙂",
  5: "😄",
};

function formatAge(dob: Date, locale: Locale = "id") {
  const tr = createTranslator(locale);

  const years = Math.floor(
    (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
  return tr("{0} tahun", { "0": years });
}

function formatDate(date: Date, locale: Locale = "id") {
  const tr = createTranslator(locale);

  return new Intl.DateTimeFormat((locale === "en" ? "en-US" : "id-ID"), { dateStyle: "medium" }).format(
    date
  );
}

export default async function MyAssignmentsPage() {
  const { tr, locale } = await getT();

  const session = await auth();
  if (!session?.user) redirect("/login");

  const isStaff =
    session.user.role === "SUPER_ADMIN" ||
    session.user.role === "SOCIAL_WORKER";

  // Pengasuh melihat anak asuhannya; staff melihat semua + bisa atur penugasan
  const [children, caregivers] = await Promise.all([
    prisma.child.findMany({
      where: {
        status: "ACTIVE",
        ...(isStaff ? {} : { assignedCaregiverId: session.user.id }),
      },
      include: {
        assignedCaregiver: { select: { id: true, name: true } },
        dailyLogs: {
          orderBy: { date: "desc" },
          take: 1,
          select: {
            date: true,
            moodScore: true,
            mealPercentage: true,
            evaluationNotes: true,
          },
        },
      },
      orderBy: { fullName: "asc" },
    }),
    isStaff
      ? prisma.user.findMany({
          where: { role: "CAREGIVER", isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          {isStaff ? tr("Penugasan Pengasuh") : tr("Anak Asuhan Saya")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isStaff
            ? tr("Atur pengasuh penanggung jawab untuk {0} anak aktif.", { "0": children.length })
            : tr("{0} anak menjadi tanggung jawab Anda.", { "0": children.length })}
        </p>
      </div>

      {children.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {isStaff
              ? tr("Belum ada anak aktif.")
              : tr("Belum ada anak yang ditugaskan ke Anda. Hubungi pekerja sosial.")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {children.map((child) => {
            const lastLog = child.dailyLogs[0];
            return (
              <Card key={child.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    {child.photoUrl ? (
                      <Image
                        src={child.photoUrl}
                        unoptimized={child.photoUrl.startsWith("/api/files/")}
                        alt={child.fullName}
                        width={48}
                        height={48}
                        className="h-12 w-12 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                        {child.fullName[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">
                        {child.fullName}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {child.gender === "MALE" ? tr("Laki-laki") : tr("Perempuan")} ·{" "}
                        {formatAge(child.dob, locale)}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Kondisi terakhir dari daily log */}
                  {lastLog ? (
                    <div className="rounded-md bg-muted/60 p-3 text-sm">
                      <p className="text-xs text-muted-foreground">
                        {tr("Log terakhir: ")}{formatDate(lastLog.date, locale)}
                      </p>
                      <p className="mt-1">
                        {moodEmoji[lastLog.moodScore] ?? "😐"} {tr(" Mood")}{" "}
                        {lastLog.moodScore}{tr("/5 · 🍽️ Makan")}{" "}
                        {lastLog.mealPercentage}%
                      </p>
                      {lastLog.evaluationNotes && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          📝 {lastLog.evaluationNotes}
                        </p>
                      )}
                    </div>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-transparent bg-yellow-100 text-yellow-800"
                    >
                      {tr("Belum ada log harian")}</Badge>
                  )}

                  {/* Staff: atur penugasan pengasuh */}
                  {isStaff && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {tr("Pengasuh penanggung jawab:")}</p>
                      <AssignCaregiverSelect
                        childId={child.id}
                        currentCaregiverId={child.assignedCaregiver?.id ?? null}
                        caregivers={caregivers}
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button asChild size="sm" className="w-full sm:flex-1">
                      <Link
                        href={`/dashboard/daily-logs/new?childId=${child.id}`}
                      >
                        <ClipboardPlus className="h-4 w-4" />
                        {tr("Input Daily Log")}</Link>
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="w-full sm:flex-1"
                    >
                      <Link href={`/dashboard/children/${child.id}`}>
                        <History className="h-4 w-4" />
                        {tr("Lihat Riwayat")}</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
