import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { IncidentUpdateForm } from "@/components/incidents/incident-update-form";
import { HandlingForm } from "@/components/shared/handling-form";
import {
  incidentTypeLabel,
  incidentStatusLabel,
  incidentStatusClass,
  incidentUrgencyLabel,
  incidentUrgencyClass,
} from "@/components/incidents/incident-labels";
import { getT } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";
import { localizeLabels } from "@/lib/i18n/translate";


export const dynamic = "force-dynamic";

function formatDateTime(date: Date, locale: Locale = "id") {
  const tr = createTranslator(locale);

  return new Intl.DateTimeFormat((locale === "en" ? "en-US" : "id-ID"), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function IncidentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { tr, locale } = await getT();
  const incidentStatusClass = localizeLabels(__incidentStatusClass, tr);
  const incidentUrgencyClass = localizeLabels(__incidentUrgencyClass, tr);

  const session = await auth();
  if (!session?.user) redirect("/login");

  const incident = await prisma.incident.findUnique({
    where: { id: params.id },
    include: {
      child: { select: { id: true, fullName: true } },
      reportedBy: { select: { name: true } },
      updates: {
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
    },
  });

  if (!incident) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/dashboard/incidents">
          <ArrowLeft className="h-4 w-4" />
          {tr("Semua Insiden")}</Link>
      </Button>

      {/* Info insiden */}
      <Card>
        <CardContent className="space-y-3 p-4 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight md:text-2xl">
              {tr("Insiden ")}{tr(incidentTypeLabel[incident.incidentType])}
            </h2>
            <Badge
              variant="outline"
              className={incidentStatusClass[incident.status]}
            >
              {tr(incidentStatusLabel[incident.status])}
            </Badge>
            <Badge
              variant="outline"
              className={incidentUrgencyClass[incident.urgency]}
            >
              {tr(incidentUrgencyLabel[incident.urgency])}
            </Badge>
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between sm:block">
              <dt className="text-muted-foreground">{tr("Anak Terlibat")}</dt>
              <dd className="font-medium">
                <Link
                  href={`/dashboard/children/${incident.child.id}`}
                  className="text-primary hover:underline"
                >
                  {incident.child.fullName}
                </Link>
              </dd>
            </div>
            <div className="flex justify-between sm:block">
              <dt className="text-muted-foreground">{tr("Dilaporkan oleh")}</dt>
              <dd className="font-medium">{incident.reportedBy.name}</dd>
            </div>
            <div className="flex justify-between sm:block">
              <dt className="text-muted-foreground">{tr("Waktu Laporan")}</dt>
              <dd className="font-medium">
                {formatDateTime(incident.createdAt, locale)}
              </dd>
            </div>
          </dl>

          <div className="rounded-md bg-muted/60 p-3">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              {tr("Deskripsi Kejadian")}</p>
            <p className="mt-1 whitespace-pre-line text-sm">
              {incident.description}
            </p>
          </div>

          {incident.photoUrl && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                {tr("Foto Pendukung")}</p>
              <Image
                src={incident.photoUrl}
                alt={tr("Foto insiden")}
                width={600}
                height={400}
                className="w-full max-w-md rounded-lg object-cover"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Penanganan & status sederhana */}
      <HandlingForm
        entity="incident"
        entityId={incident.id}
        initialHandling={incident.handling}
        initialDone={incident.status === "RESOLVED"}
      />

      {/* Timeline penanganan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {tr("Timeline Penanganan")}<span className="ml-2 text-sm font-normal text-muted-foreground">
              ({incident.updates.length} {tr(" update)")}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <IncidentUpdateForm
            incidentId={incident.id}
            currentStatus={incident.status}
          />

          {incident.updates.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {tr("Belum ada update penanganan.")}</p>
          ) : (
            <ol className="relative border-l border-border pl-6">
              {incident.updates.map((update) => (
                <li key={update.id} className="relative pb-5 last:pb-0">
                  <span className="absolute -left-[31px] flex h-4 w-4 items-center justify-center rounded-full border-2 border-primary bg-background" />
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(update.createdAt, locale)} ·{" "}
                      {update.createdBy.name}
                    </p>
                    <p className="whitespace-pre-line text-sm">
                      {update.notes}
                    </p>
                    {update.newStatus && (
                      <Badge
                        variant="outline"
                        className={incidentStatusClass[update.newStatus]}
                      >
                        {tr("Status → ")}{tr(incidentStatusLabel[update.newStatus])}
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const __incidentStatusClass = incidentStatusClass;
const __incidentUrgencyClass = incidentUrgencyClass;
