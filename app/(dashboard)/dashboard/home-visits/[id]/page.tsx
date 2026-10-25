import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { VisitStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { CompleteVisitForm } from "@/components/home-visits/complete-visit-form";
import { getT } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";
import { localizeLabels } from "@/lib/i18n/translate";


export const dynamic = "force-dynamic";

const statusLabel: Record<VisitStatus, string> = {
  PLANNED: "Terjadwal",
  DONE: "Selesai",
  CANCELLED: "Dibatalkan",
};

const statusClass: Record<VisitStatus, string> = {
  PLANNED: "border-transparent bg-yellow-100 text-yellow-800",
  DONE: "border-transparent bg-green-100 text-green-800",
  CANCELLED: "border-transparent bg-gray-100 text-gray-600",
};

const CHECKLIST_LABELS: { key: keyof ChecklistShape; label: string }[] = [
  { key: "sanitationOk", label: "Sanitasi layak" },
  { key: "safetyOk", label: "Keamanan rumah" },
  { key: "cleanWaterOk", label: "Air bersih" },
  { key: "childSpaceOk", label: "Ruang untuk anak" },
  { key: "foodSecurityOk", label: "Ketahanan pangan" },
];

type ChecklistShape = {
  sanitationOk: boolean | null;
  safetyOk: boolean | null;
  cleanWaterOk: boolean | null;
  childSpaceOk: boolean | null;
  foodSecurityOk: boolean | null;
};

function formatDate(date: Date, locale: Locale = "id") {
  const tr = createTranslator(locale);

  return new Intl.DateTimeFormat((locale === "en" ? "en-US" : "id-ID"), { dateStyle: "long" }).format(date);
}

export default async function HomeVisitDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { tr, locale } = await getT();
  const CHECKLIST_LABELS = localizeLabels(__CHECKLIST_LABELS, tr);

  const session = await requireStaffSession();
  if (!session) redirect("/dashboard");

  const visit = await prisma.homeVisit.findUnique({
    where: { id: params.id },
    include: {
      child: {
        select: {
          id: true,
          fullName: true,
          guardian: { select: { name: true, phone: true, address: true } },
        },
      },
      createdBy: { select: { name: true } },
      officer: { select: { name: true } },
    },
  });

  if (!visit) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/dashboard/home-visits">
          <ArrowLeft className="h-4 w-4" />
          {tr("Semua Kunjungan")}</Link>
      </Button>

      {/* Info kunjungan */}
      <Card>
        <CardContent className="space-y-3 p-4 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight md:text-2xl">
              {tr("Kunjungan: ")}{visit.child.fullName}
            </h2>
            <Badge variant="outline" className={statusClass[visit.status]}>
              {tr(statusLabel[visit.status])}
            </Badge>
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between sm:block">
              <dt className="text-muted-foreground">{tr("Tanggal")}</dt>
              <dd className="font-medium">{formatDate(visit.scheduledDate, locale)}</dd>
            </div>
            <div className="flex justify-between sm:block">
              <dt className="text-muted-foreground">{tr("Petugas Kunjungan")}</dt>
              <dd className="font-medium">{visit.officer?.name ?? "-"}</dd>
            </div>
            <div className="flex justify-between sm:block">
              <dt className="text-muted-foreground">{tr("Dijadwalkan oleh")}</dt>
              <dd className="font-medium">{visit.createdBy.name}</dd>
            </div>
            <div className="flex justify-between sm:block">
              <dt className="text-muted-foreground">{tr("Wali")}</dt>
              <dd className="font-medium">
                {visit.child.guardian?.name ?? "-"}
                {visit.child.guardian?.phone
                  ? ` (${visit.child.guardian.phone})`
                  : ""}
              </dd>
            </div>
            <div className="flex justify-between sm:block">
              <dt className="text-muted-foreground">{tr("Alamat")}</dt>
              <dd className="font-medium">
                {visit.child.guardian?.address ?? "-"}
              </dd>
            </div>
          </dl>

          <div className="rounded-md bg-muted/60 p-3">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              {tr("Tujuan Kunjungan")}</p>
            <p className="mt-1 whitespace-pre-line text-sm">{visit.purpose}</p>
          </div>
        </CardContent>
      </Card>

      {/* Terjadwal -> tampilkan form penyelesaian; selesai -> tampilkan hasil */}
      {visit.status === "PLANNED" ? (
        <CompleteVisitForm visitId={visit.id} />
      ) : visit.status === "DONE" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{tr("Hasil Asesmen")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {CHECKLIST_LABELS.map((item) => {
                const passed = visit[item.key] === true;
                return (
                  <div
                    key={item.key}
                    className={`flex items-center gap-2 rounded-md border p-3 text-sm ${
                      passed
                        ? "border-green-200 bg-green-50"
                        : "border-red-200 bg-red-50"
                    }`}
                  >
                    {passed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    {tr(item.label)}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm font-medium">
                {tr("Skor Kerentanan Keluarga")}</span>
              <Badge
                variant="outline"
                className={
                  (visit.vulnerabilityScore ?? 0) <= 3
                    ? "border-transparent bg-green-100 text-green-800"
                    : (visit.vulnerabilityScore ?? 0) <= 6
                      ? "border-transparent bg-yellow-100 text-yellow-800"
                      : "border-transparent bg-red-100 text-red-800"
                }
              >
                {visit.vulnerabilityScore ?? "-"}/10
              </Badge>
            </div>

            {visit.visitNotes && (
              <div className="rounded-md bg-muted/60 p-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  {tr("Hasil Kunjungan")}</p>
                <p className="mt-1 whitespace-pre-line text-sm">
                  {visit.visitNotes}
                </p>
              </div>
            )}

            {visit.photoUrl && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                  {tr("Foto Rumah")}</p>
                <Image
                  src={visit.photoUrl}
                  alt={tr("Foto rumah")}
                  width={600}
                  height={400}
                  className="w-full max-w-md rounded-lg object-cover"
                />
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {tr("Kunjungan ini dibatalkan.")}</CardContent>
        </Card>
      )}
    </div>
  );
}

const __CHECKLIST_LABELS = CHECKLIST_LABELS;
